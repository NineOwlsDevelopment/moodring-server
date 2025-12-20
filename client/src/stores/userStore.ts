import { PublicKey } from "@solana/web3.js";
import { create } from "zustand";

export type UserRole = "user" | "admin";

interface User {
  id: string;
  username: string;
  display_name: string;
  email?: string; // Email if logged in via magic link
  avatar_url?: string; // Profile picture URL
  isAdmin: boolean;
  wallet: {
    id: string;
    publicKey: PublicKey;
    balance_sol: number;
    balance_usdc: number;
  };
}

interface UserState {
  user: User | null;
  isAdmin: boolean;
  isInitializing: boolean; // True while checking for existing session on app load
  tokenExpiresAt: number | null; // Unix timestamp (ms) when access token expires
  setUser: (user: User | null) => void;
  setIsInitializing: (isInitializing: boolean) => void;
  setTokenExpiresAt: (expiresAt: number | null) => void;
  updateBalance: (balance: number) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAdmin: false,
  isInitializing: true, // Start as true - we need to check for session first
  tokenExpiresAt: null,
  setUser: (user) => set({ user, isAdmin: user?.isAdmin }),
  setIsInitializing: (isInitializing) => set({ isInitializing }),
  setTokenExpiresAt: (expiresAt) => set({ tokenExpiresAt: expiresAt }),
  updateBalance: (balance_usdc: number) =>
    set((state) => ({
      user: state.user
        ? {
            ...state.user,
            wallet: {
              ...state.user.wallet,
              balance_usdc,
            },
          }
        : null,
    })),
  logout: () => {
    // Clear persisted token expiry from sessionStorage
    try {
      sessionStorage.removeItem("tokenExpiresAt");
      localStorage.removeItem("hasPreviousSession");
      localStorage.removeItem("walletName");
    } catch {
      // storage might be disabled
    }
    set({ user: null, isAdmin: false, tokenExpiresAt: null });
  },
}));
