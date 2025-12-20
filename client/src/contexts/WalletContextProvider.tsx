import { FC, ReactNode, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { useWallet } from "@solana/wallet-adapter-react";
import { ENDPOINT } from "@/config/solana";
import { useWalletStore } from "@/stores/walletStore";
import { useUserStore } from "@/stores/userStore";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";
import api, { setTokenExpiry } from "@/config/axios";

interface WalletContextProviderProps {
  children: ReactNode;
}

// Wrapper to sync wallet state with Zustand
const WalletSync: FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, connected, connecting, signMessage, wallet, disconnect } =
    useWallet();
  const { setPublicKey, setConnected, setConnecting, setWalletName } =
    useWalletStore();
  const { setUser, logout } = useUserStore();
  const hasSignedRef = useRef(false);
  const previousPublicKeyRef = useRef<string | null>(null);
  const isAuthenticatingRef = useRef(false);

  /**
   * Sign up with Solana wallet
   */
  const signupWithWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not connected or signMessage not available");
    }

    // Prevent concurrent authentication attempts
    if (isAuthenticatingRef.current) {
      console.log("Authentication already in progress...");
      return;
    }

    isAuthenticatingRef.current = true;

    try {
      const wallet_address: string = publicKey?.toString() || "";

      console.log("🔐 Authenticating wallet:", wallet_address);
      console.log("📦 Selected wallet:", wallet?.adapter?.name || "Unknown");

      // Step 1: Request nonce from backend
      console.log("📝 Requesting nonce from backend...");
      const nonceResponse = await api.post(`/auth/wallet/nonce`, {
        wallet_address,
      });

      const { nonce, message } = nonceResponse.data;

      if (!nonce || !message) {
        throw new Error("Failed to get nonce from backend");
      }

      console.log("✅ Nonce received, signing message...");

      // Step 2: Sign the message returned from backend
      const encodedMessage = new TextEncoder().encode(message);

      // Request signature from user
      const signedMessage = await signMessage(encodedMessage);

      // Convert signature to base58 string
      const signature = bs58.encode(signedMessage);

      console.log("✅ Message signed, sending to backend...");

      // Step 3: Send to backend with nonce
      const response = await api.post(`/auth/wallet/authenticate`, {
        wallet_address,
        message,
        signature,
        nonce,
      });

      const data = response.data;

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(data.error || "Failed to sign up with wallet");
      }

      // Store wallet name for future reference
      if (wallet?.adapter?.name) {
        const walletName = wallet.adapter.name;
        localStorage.setItem("walletName", walletName);
        setWalletName(walletName);
      }

      console.log("✅ Wallet authentication successful:", data);

      localStorage.setItem("hasPreviousSession", "true");
      // Update user store with data from backend
      // Convert public_key string to PublicKey object
      const walletPublicKeyString =
        data.user.wallet.publicKey || data.user.wallet.public_key;
      const walletPublicKey = walletPublicKeyString
        ? typeof walletPublicKeyString === "string"
          ? new PublicKey(walletPublicKeyString)
          : walletPublicKeyString
        : null;

      if (!walletPublicKey) {
        throw new Error("No public key found in wallet data");
      }

      setUser({
        id: data.user.id,
        username: data.user.username,
        display_name: data.user.display_name,
        email: data.user.email,
        isAdmin: data.user.isAdmin || false,
        wallet: {
          id: data.user.wallet.id,
          publicKey: walletPublicKey,
          balance_sol: data.user.wallet.balance_sol,
          balance_usdc: data.user.wallet.balance_usdc,
        },
      });

      // Set token expiry for proactive refresh
      setTokenExpiry();

      return data;
    } catch (error: any) {
      console.error("❌ Wallet authentication error:", error);

      // If user rejected the signature request, disconnect wallet
      if (error?.message?.includes("User rejected") || error?.code === 4001) {
        console.log("User rejected signature, disconnecting wallet...");
        try {
          await disconnect();
        } catch (disconnectError) {
          console.error("Error disconnecting wallet:", disconnectError);
        }
      }

      throw error;
    } finally {
      isAuthenticatingRef.current = false;
    }
  }, [publicKey, signMessage, wallet, setUser, disconnect]);

  // Sync wallet state to Zustand store
  useEffect(() => {
    setPublicKey(publicKey);
    setConnected(connected);
    setConnecting(connecting);

    // Sync wallet name from localStorage on mount
    const storedWalletName = localStorage.getItem("walletName");
    if (storedWalletName && wallet?.adapter?.name === storedWalletName) {
      setWalletName(storedWalletName);
    }
  }, [
    publicKey,
    connected,
    connecting,
    wallet,
    setPublicKey,
    setConnected,
    setConnecting,
    setWalletName,
  ]);

  // Handle wallet selection and connection events
  useEffect(() => {
    // Check if user is already logged in via email
    const currentPublicKey = publicKey?.toString() || null;

    // Detect wallet selection/connection
    if (
      connected &&
      publicKey &&
      currentPublicKey !== previousPublicKeyRef.current
    ) {
      console.log("🎯 Wallet selected and connected:", {
        address: currentPublicKey,
        walletName: wallet?.adapter?.name || "Unknown",
        previousAddress: previousPublicKeyRef.current,
      });

      previousPublicKeyRef.current = currentPublicKey;

      // Store wallet info
      if (wallet?.adapter?.name) {
        const walletName = wallet.adapter.name;
        localStorage.setItem("walletName", walletName);
        setWalletName(walletName);
      }
    }

    if (
      connected &&
      publicKey &&
      signMessage &&
      !hasSignedRef.current &&
      !isAuthenticatingRef.current
    ) {
      console.log("🚀 Auto-authenticating with wallet...");
      hasSignedRef.current = true;

      signupWithWallet().catch((error) => {
        console.error("❌ Failed to authenticate with wallet:", error);
        hasSignedRef.current = false; // Reset to allow retry

        // Handle different error types
        if (error?.message?.includes("User rejected") || error?.code === 4001) {
          console.log("User rejected the signature request");
        } else if (error?.message?.includes("Unexpected error")) {
          console.error(
            "Wallet connection error - this may be a browser compatibility issue"
          );
          // Try to disconnect and allow user to reconnect
          disconnect().catch((disconnectError) => {
            console.error("Error disconnecting wallet:", disconnectError);
          });
        }
      });
    }

    // Reset hasSignedRef if wallet changes
    if (
      connected &&
      publicKey &&
      currentPublicKey !== previousPublicKeyRef.current
    ) {
      hasSignedRef.current = false;
    }

    // Reset refs when wallet disconnects to allow fresh authentication
    if (!connected && !publicKey) {
      hasSignedRef.current = false;
      previousPublicKeyRef.current = null;
    }
  }, [publicKey, connected, signMessage, wallet, signupWithWallet, logout]);

  return <>{children}</>;
};

export const WalletContextProvider: FC<WalletContextProviderProps> = ({
  children,
}) => {
  const wallets = useMemo(() => {
    // Create wallet adapters - only explicitly configured Solana wallets
    // This prevents auto-detection of browser extensions that might cause duplicates
    const phantom = new PhantomWalletAdapter();
    const solflare = new SolflareWalletAdapter();

    // Return only the wallets we explicitly configure
    // The WalletProvider will only use these wallets, preventing auto-detection issues
    return [phantom, solflare];
  }, []);

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletSync>{children}</WalletSync>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
