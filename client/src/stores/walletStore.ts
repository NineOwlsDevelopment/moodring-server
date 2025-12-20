import { create } from "zustand";
import { PublicKey } from "@solana/web3.js";

interface WalletState {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  walletName: string | null;
  setPublicKey: (publicKey: PublicKey | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setWalletName: (walletName: string | null) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  publicKey: null,
  connected: false,
  connecting: false,
  walletName: null,
  setPublicKey: (publicKey) => set({ publicKey }),
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setWalletName: (walletName) => set({ walletName }),
  disconnect: () =>
    set({
      publicKey: null,
      connected: false,
      connecting: false,
      walletName: null,
    }),
}));
