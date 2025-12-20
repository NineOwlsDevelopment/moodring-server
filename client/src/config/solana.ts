import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";

// Solana network configuration
export const NETWORK = "localnet"; // Change to 'mainnet-beta' for production
export const ENDPOINT = "http://127.0.0.1:8899";

// Create connection
export const connection = new Connection(ENDPOINT, "confirmed");

// Program ID - Replace with your actual program ID
export const PROGRAM_ID = "BARTLZY1PLNUm2aNhdmvBsRRksVovqXRie3FGo9KZZZf";

/**
 * USDC Token Configuration
 *
 * USDC has 6 decimals on Solana
 * Users deposit USDC and receive virtual tokens representing their position
 *
 * Virtual Token System:
 * - Users deposit USDC (6 decimals)
 * - They receive an equivalent amount of virtual tokens on-chain
 * - These tokens represent their YES or NO votes for a given option
 * - 1 USDC = 1 virtual token (both with 6 decimals)
 * - Virtual tokens are market-specific and option-specific
 */

// USDC Mint addresses
export const USDC_MINT = {
  localnet: new PublicKey("2uXs1qMB6oAmFC8CH7MbnJWv8cxUmPqxkaV37CUPPzrz"), // USDC Devnet
  mainnet: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC Mainnet
};

export const USDC_DECIMALS = 6;

// Get USDC mint address based on network
export const getUsdcMint = (): PublicKey => {
  return NETWORK === "localnet" ? USDC_MINT.mainnet : USDC_MINT.mainnet;
};

// Create Anchor provider
export const getProvider = (wallet: any) => {
  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
};
