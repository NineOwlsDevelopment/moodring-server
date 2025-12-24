import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useUserStore } from "@/stores/userStore";
import { withMinimumDelay } from "@/utils/delay";

axios.defaults.withCredentials = true;

// Access token lifetime in ms (should match server's JWT expiry)
const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes
// Refresh threshold - refresh if less than this time remaining
const REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
// SessionStorage key for persisting token expiry across page reloads
const TOKEN_EXPIRY_KEY = "tokenExpiresAt";

// Track if a refresh is in progress to prevent concurrent refresh calls
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Get token expiry from sessionStorage (survives page reload)
 */
const getPersistedTokenExpiry = (): number | null => {
  try {
    const stored = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
};

/**
 * Persist token expiry to sessionStorage
 */
const persistTokenExpiry = (expiresAt: number): void => {
  try {
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  } catch {
    // sessionStorage might be disabled
  }
};

/**
 * Clear persisted token expiry (on logout)
 */
const clearPersistedTokenExpiry = (): void => {
  try {
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // sessionStorage might be disabled
  }
};

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

/**
 * Refresh the access token and update expiry time in store + sessionStorage
 * Returns true if successful, false otherwise
 */
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const response = await api.post("/auth/refresh", {});
    if (response.status === 200) {
      // Update token expiry time in store and persist to sessionStorage
      const newExpiresAt = Date.now() + ACCESS_TOKEN_LIFETIME_MS;
      useUserStore.getState().setTokenExpiresAt(newExpiresAt);
      persistTokenExpiry(newExpiresAt);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Check if token needs refresh (within threshold of expiry)
 * Checks both Zustand store and sessionStorage (for page reload resilience)
 */
const shouldRefreshToken = (): boolean => {
  const { tokenExpiresAt, user } = useUserStore.getState();

  // No user logged in, no need to refresh
  if (!user) return false;

  // Try store first, then fall back to sessionStorage (for page reload case)
  const expiresAt = tokenExpiresAt ?? getPersistedTokenExpiry();

  // No expiry tracked yet, don't proactively refresh
  if (!expiresAt) return false;

  // Sync store with persisted value if needed
  if (!tokenExpiresAt && expiresAt) {
    useUserStore.getState().setTokenExpiresAt(expiresAt);
  }

  const timeRemaining = expiresAt - Date.now();
  return timeRemaining < REFRESH_THRESHOLD_MS;
};

// Request interceptor - proactively refresh if token is about to expire
api.interceptors.request.use(
  async (config) => {
    // Skip refresh check for auth endpoints
    if (config.url?.includes("/auth/")) {
      return config;
    }

    // Check if we need to proactively refresh
    if (shouldRefreshToken()) {
      // If already refreshing, wait for that to complete
      if (isRefreshing && refreshPromise) {
        await refreshPromise;
      } else {
        // Start a new refresh
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
        await refreshPromise;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - fallback for when proactive refresh didn't happen
// Also adds minimum delay to responses for better UX (prevents jarring fast loads)
api.interceptors.response.use(
  async (response) => {
    // Skip delay for auth endpoints (login, refresh) - these should be fast
    const url = response.config.url || "";
    if (url.includes("/auth/") || url.includes("/refresh")) {
      return response;
    }

    // Add minimum delay to all other responses (about 1 second with variation)
    // This makes the UI feel more natural and less jarring
    // The response is already received, we're just delaying when it's returned to the caller
    await withMinimumDelay(Promise.resolve(response), 100, 50);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If refresh endpoint fails, logout and clear persisted expiry
    if (originalRequest?.url?.includes("/auth/refresh")) {
      clearPersistedTokenExpiry();
      useUserStore.getState().logout();
      return Promise.reject(error);
    }

    // If 401 and not already retried, refresh token and retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const success = await refreshAccessToken();
        if (success) {
          return api(originalRequest);
        } else {
          clearPersistedTokenExpiry();
          useUserStore.getState().logout();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        clearPersistedTokenExpiry();
        useUserStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // Don't show toasts here - let calling code handle toast display
    // This prevents duplicate toasts when errors are caught and displayed by components
    return Promise.reject(error);
  }
);

/**
 * Call this after successful login/token refresh to set the expiry time
 * Persists to both Zustand store and sessionStorage
 */
export const setTokenExpiry = () => {
  const expiresAt = Date.now() + ACCESS_TOKEN_LIFETIME_MS;
  useUserStore.getState().setTokenExpiresAt(expiresAt);
  persistTokenExpiry(expiresAt);
};

/**
 * Call this on logout to clear the persisted token expiry
 */
export const clearTokenExpiry = () => {
  clearPersistedTokenExpiry();
};

export default api;
