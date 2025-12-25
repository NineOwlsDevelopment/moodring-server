import dotenv from "dotenv";
dotenv.config();
import { Keypair, PublicKey } from "@solana/web3.js";

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// USDC mint addresses for different networks
export const USDC_MINT_ADDRESSES = {
  mainnet: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Mainnet USDC
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
  // local: "7ZhjpnzW4J5SgPyCrnvZTWHgmPxq6JXv8vRuKbgwK2mh", // Local USDC (commented out)
};

// Legacy export for backward compatibility (defaults to devnet)
// Use getUsdcMintAddress() instead for network-aware selection
export const USDC_MINT_ADDRESS = USDC_MINT_ADDRESSES.devnet;

/**
 * Get the USDC mint address based on the RPC URL
 * Detects mainnet vs devnet from the RPC URL
 * @param rpcUrl - Solana RPC URL
 * @returns USDC mint address for the detected network
 */
export function getUsdcMintAddress(rpcUrl?: string): string {
  const urlToCheck = (rpcUrl || process.env.RPC_URL || "").toLowerCase();

  // Explicitly check for devnet/testnet/local indicators
  if (
    urlToCheck.includes("devnet") ||
    urlToCheck.includes("testnet") ||
    urlToCheck.includes("localhost") ||
    urlToCheck.includes("127.0.0.1") ||
    urlToCheck.includes("localnet")
  ) {
    return USDC_MINT_ADDRESSES.devnet;
  }

  // Check for explicit mainnet indicators
  if (urlToCheck.includes("mainnet")) {
    return USDC_MINT_ADDRESSES.mainnet;
  }

  // For URLs without explicit network indicators (like custom RPC providers),
  // check if they're likely mainnet by looking for common mainnet RPC patterns
  // Common mainnet RPC providers: helius, quicknode, alchemy, etc. (without devnet in name)
  // If URL doesn't contain devnet/testnet/local, assume mainnet for production
  if (
    urlToCheck &&
    !urlToCheck.includes("devnet") &&
    !urlToCheck.includes("testnet")
  ) {
    // Default to mainnet for production RPC URLs without network indicators
    return USDC_MINT_ADDRESSES.mainnet;
  }

  // Default to devnet for safety (better to fail on devnet than miss mainnet deposits)
  return USDC_MINT_ADDRESSES.devnet;
}

// local and devnet USDC mint
export const USDC_MINT_KEYPAIR = Keypair.fromSecretKey(
  new Uint8Array([
    40, 10, 169, 30, 71, 80, 96, 99, 78, 207, 13, 125, 123, 49, 24, 65, 163,
    253, 236, 83, 240, 170, 173, 140, 193, 31, 57, 58, 79, 207, 137, 199, 28,
    80, 200, 254, 89, 126, 48, 64, 214, 14, 104, 141, 28, 88, 220, 108, 131,
    149, 81, 105, 212, 251, 208, 149, 25, 54, 205, 214, 223, 139, 8, 199,
  ])
);
