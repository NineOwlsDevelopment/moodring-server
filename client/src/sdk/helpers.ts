import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Helper function to calculate the current YES/NO price based on LMSR
 * @param option - the option to calculate price for
 * @returns YES and NO prices (sum to 1)
 */
export async function getLMSRPrices(
  program: Program<any>,
  option: PublicKey
): Promise<{ yesPrice: number; noPrice: number }> {
  const optionAccount: any = await program.account.marketOption.fetch(option);

  const yesQty = optionAccount.yesQuantity.toNumber();
  const noQty = optionAccount.noQuantity.toNumber();
  const b = optionAccount.liquidityParameter.toNumber();

  // If no trades yet, 50/50
  if (yesQty === 0 && noQty === 0) {
    return { yesPrice: 0.5, noPrice: 0.5 };
  }

  // LMSR: P_yes = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
  const expYes = Math.exp(yesQty / b);
  const expNo = Math.exp(noQty / b);
  const yesPrice = expYes / (expYes + expNo);

  return {
    yesPrice,
    noPrice: 1 - yesPrice,
  };
}

/**
 * Helper function to format USDC amounts
 * @param amount - amount in base units
 * @returns formatted string
 */
export function formatUSDC(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(2)}`;
}

/**
 * Helper function to format share amounts
 * @param amount - amount in base units
 * @returns formatted string
 */
export function formatShares(amount: number): string {
  return `${(amount / 1_000_000).toFixed(2)}`;
}
