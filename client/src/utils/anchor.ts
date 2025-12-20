import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { connection, PROGRAM_ID, USDC_DECIMALS } from "@/config/solana";

/**
 * Initialize Anchor program
 *
 * Usage:
 * ```typescript
 * import idl from './idl/your_program.json';
 * const program = initProgram(wallet, idl);
 * ```
 */
export const initProgram = (wallet: any, idl: Idl): Program => {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const programId = new PublicKey(PROGRAM_ID);
  return new Program(idl, programId, provider);
};

/**
 * Convert USDC amount to lamports (base units with 6 decimals)
 * Example: 1.5 USDC = 1,500,000 lamports
 */
export const usdcToLamports = (usdcAmount: number): number => {
  return Math.floor(usdcAmount * Math.pow(10, USDC_DECIMALS));
};

/**
 * Convert lamports to USDC amount
 * Example: 1,500,000 lamports = 1.5 USDC
 */
export const lamportsToUsdc = (lamports: number): number => {
  return lamports / Math.pow(10, USDC_DECIMALS);
};

/**
 * Example function to create a market
 * Replace with your actual program instructions
 */
export const createMarket = async (
  program: Program,
  title: string,
  description: string,
  endDate: Date
) => {
  try {
    // Example - replace with your actual instruction
    const tx = await program.methods
      .createMarket(title, description, endDate.getTime())
      .accounts({
        // Add your accounts here
      })
      .rpc();

    console.log("Transaction signature:", tx);
    return tx;
  } catch (error) {
    console.error("Error creating market:", error);
    throw error;
  }
};

/**
 * Place a trade using USDC
 * 
 * @param program - The initialized Anchor program
 * @param marketId - Public key of the market
 * @param optionId - The option to bet on (for multiple choice) or "yes"/"no" (for binary)
 * @param side - "yes" or "no" 
 * @param usdcAmount - Amount of USDC to spend (will be converted to lamports)
 * 
 * Flow:
 * 1. User deposits USDC (6 decimals)
 * 2. Program locks the USDC in market escrow
 * 3. User receives virtual tokens (1:1 ratio) representing their position
 * 4. Virtual tokens are minted as on-chain tokens specific to market+option+side
 * 
 * Example: User deposits 10 USDC for "YES" on option "btc"
 *          They receive 10,000,000 virtual token lamports (10 tokens with 6 decimals)
 */
export const placeTrade = async (
  program: Program,
  marketId: PublicKey,
  optionId: string,
  side: "yes" | "no",
  usdcAmount: number
) => {
  try {
    const lamports = usdcToLamports(usdcAmount);
    
    // Example - replace with your actual instruction
    const tx = await program.methods
      .placeTrade(optionId, side, lamports)
      .accounts({
        market: marketId,
        // userUsdcAccount: user's USDC token account
        // marketUsdcVault: market's USDC vault/escrow
        // userPositionAccount: PDA to track user's position
        // virtualTokenMint: mint for virtual position tokens
        // userVirtualTokenAccount: user's virtual token account
        // Add other accounts here
      })
      .rpc();

    console.log("Transaction signature:", tx);
    console.log(`Deposited ${usdcAmount} USDC, received ${usdcAmount} virtual tokens`);
    return tx;
  } catch (error) {
    console.error("Error placing trade:", error);
    throw error;
  }
};

/**
 * Example function to resolve a market
 * Replace with your actual program instructions
 */
export const resolveMarket = async (
  program: Program,
  marketId: PublicKey,
  outcome: "yes" | "no"
) => {
  try {
    // Example - replace with your actual instruction
    const tx = await program.methods
      .resolveMarket(outcome)
      .accounts({
        market: marketId,
        // Add other accounts here
      })
      .rpc();

    console.log("Transaction signature:", tx);
    return tx;
  } catch (error) {
    console.error("Error resolving market:", error);
    throw error;
  }
};
