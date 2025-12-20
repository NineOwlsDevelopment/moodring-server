import { useUserStore } from "@/stores/userStore";
import api from "@/config/axios";
import { PublicKey } from "@solana/web3.js";
/**
 * Restore user session from localStorage
 * This should be called on app initialization
 */
export const restoreUserSession = async () => {
  const store = useUserStore.getState();

  try {
    const response = await api.get("/auth/me");

    if (response.status === 200) {
      const user = response.data.user;

      // Use getState to access the store outside of a component
      // Convert public_key string to PublicKey object
      const publicKeyString = user.wallet.publicKey || user.wallet.public_key;
      const publicKey = publicKeyString
        ? typeof publicKeyString === "string"
          ? new PublicKey(publicKeyString)
          : publicKeyString
        : null;

      if (!publicKey) {
        console.error("No public key found in wallet data");
        return false;
      }

      store.setUser({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        avatar_url: user.avatar_url || undefined,
        isAdmin: user.isAdmin || false,
        wallet: {
          id: user.wallet.id,
          publicKey,
          balance_sol: user.wallet.balance_sol,
          balance_usdc: user.wallet.balance_usdc,
        },
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to restore user session:", error);
    return false;
  } finally {
    // Always mark initialization as complete
    store.setIsInitializing(false);
  }
};

/**
 * Initialize auth state - call this on app startup
 * Checks for existing session and restores it if found
 */
export const initializeAuth = async () => {
  const hasPreviousSession = localStorage.getItem("hasPreviousSession");

  if (hasPreviousSession) {
    await restoreUserSession();
  } else {
    // No previous session, just mark initialization as complete
    useUserStore.getState().setIsInitializing(false);
  }
};
