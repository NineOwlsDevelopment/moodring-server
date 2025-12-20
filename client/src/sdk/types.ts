import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface InitializeProgramParams {
  payer: PublicKey;
  mint: PublicKey;
}

export interface CreateMarketParams {
  payer: PublicKey;
  base: PublicKey;
  marketQuestion: string;
  marketMetadataUri: string;
  marketExpirationDate: number; // Unix timestamp
  usdcMint: PublicKey;
  isBinary: boolean;
  resolvers: PublicKey[];
  requiredVotes: number;
  resolverReward: number;
}

export interface CreateOptionParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  optionLabel: string;
  usdcMint: PublicKey;
}

export interface InitializeMarketParams {
  payer: PublicKey;
  market: PublicKey;
}

export interface CreateResolverParams {
  payer: PublicKey;
  usdcMint: PublicKey;
  amount: number;
}

export interface ResolveMarketParams {
  payer: PublicKey;
  market: PublicKey;
  resolver: PublicKey;
  winningOptionIndex: number;
  winningSide: number; // 0 = YES, 1 = NO
}

export interface ClaimResolverFeeParams {
  payer: PublicKey;
  market: PublicKey;
  resolver: PublicKey;
}

export interface ReportVoteParams {
  payer: PublicKey;
  market: PublicKey;
  resolver: PublicKey;
}

export interface WithdrawResolverStakeParams {
  payer: PublicKey;
  resolver: PublicKey;
  usdcMint: PublicKey;
}

export interface InitUserPositionParams {
  payer: PublicKey;
  option: PublicKey;
  market: PublicKey;
}

export interface DepositTokensParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  amount: number;
  usdcMint: PublicKey;
}

// ============================================
// Liquidity Provider Types
// ============================================

export interface AddLiquidityParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  amount: number; // USDC amount in base units (1 USDC = 1_000_000)
  usdcMint: PublicKey;
}

export interface RemoveLiquidityParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  shares: number | BN; // LP shares to burn
  usdcMint: PublicKey;
}

// ============================================
// Trading Types (LMSR)
// ============================================

export interface BuySharesParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  buyYes: number | BN; // YES shares to buy (0 if buying NO)
  buyNo: number | BN; // NO shares to buy (0 if buying YES)
  maxCost: number | BN; // Slippage protection
  usdcMint: PublicKey;
}

export interface SellSharesParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  sellYes: number | BN; // YES shares to sell (0 if selling NO)
  sellNo: number | BN; // NO shares to sell (0 if selling YES)
  minPayout: number | BN; // Slippage protection
  usdcMint: PublicKey;
}

export interface BuyWithSlippageParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  buyYes: number; // 0 if buying NO
  buyNo: number; // 0 if buying YES
  slippageBps: number; // e.g., 100 = 1%
  usdcMint: PublicKey;
}

export interface SellWithSlippageParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  sellYes: number; // 0 if selling NO
  sellNo: number; // 0 if selling YES
  slippageBps: number; // e.g., 100 = 1%
  usdcMint: PublicKey;
}

export interface WithdrawParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  amount: number | BN;
  usdcMint: PublicKey;
}

export interface ClaimWinningsParams {
  payer: PublicKey;
  market: PublicKey;
  option: PublicKey;
  usdcMint: PublicKey;
}

export interface WithdrawCreatorFeeParams {
  payer: PublicKey; // market authority
  market: PublicKey;
  option: PublicKey;
  usdcMint: PublicKey;
}

// ============================================
// Admin Types
// ============================================

export interface SetPauseFlagsParams {
  pauseAdmin: PublicKey;
  isPaused?: boolean;
  pauseTrading?: boolean;
  pauseLiquidity?: boolean;
  pauseResolution?: boolean;
}

export interface UpdateAdminsParams {
  admin: PublicKey;
  newFeeAdmin?: PublicKey;
  newPauseAdmin?: PublicKey;
}

export interface RedeemUsdcFeeParams {
  feeAdmin: PublicKey;
  usdcMint: PublicKey;
}

export interface RedeemSolFeeParams {
  feeAdmin: PublicKey;
}
