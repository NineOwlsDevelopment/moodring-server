import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import * as types from "./types";

const PRECISION = new BN(1_000_000);

export default class MoodringClient {
  program: any;
  programData: PublicKey;
  connection: anchor.web3.Connection;

  constructor(
    program: any,
    programData: PublicKey,
    connection: anchor.web3.Connection
  ) {
    this.program = program;
    this.programData = programData;
    this.connection = connection;
  }

  /**
   * Get the current balance of the fee vault
   * @param admin - the admin public key
   * @returns the balance in lamports
   */
  async getFeeVaultBalance(admin: PublicKey): Promise<number> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      // Get the fee vault account info to check balance
      const feeVaultAccount = await this.connection.getAccountInfo(feeVaultPda);
      return feeVaultAccount ? feeVaultAccount.lamports : 0;
    } catch (err) {
      console.error("Error getting fee vault balance", err);
      throw err;
    }
  }

  /**
   *
   * @param params.payer - the payer of the transaction
   * @param params.mint - the mint of the token to be used for paying fees
   */
  async initializeProgram(
    params: types.InitializeProgramParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      const feeVaultAta = await getAssociatedTokenAddress(
        params.mint,
        feeVaultPda,
        true
      );

      const initProgramInstruction = await this.program.methods
        .initialize()
        .accounts({
          moodring: moodringPda,
          program: this.program.programId,
          programData: this.programData,
          feeVault: feeVaultPda,
          feeVaultAta: feeVaultAta,
          payer: params.payer,
          mint: params.mint,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return initProgramInstruction;
    } catch (err) {
      console.error("Error initializing program", err);
      throw err;
    }
  }

  /**
   * Create a new market
   * @param params.payer - the payer of the transaction
   * @param params.base - the base mint of the market
   * @param params.marketQuestion - the name of the market
   * @param params.marketMetadataUri - the metadata URI of the market
   * @param params.marketExpirationDate - the expiration of the market (Unix timestamp)
   * @param params.usdcMint - the USDC mint
   * @param params.isBinary - whether the market is binary
   * @param params.resolvers - the resolvers of the market
   * @param params.requiredVotes - the required votes of the market
   * @param params.resolverReward - the resolver reward of the market
   * @returns the transaction instruction
   */
  async createMarket(params: types.CreateMarketParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          params.payer.toBuffer(),
          params.base.toBuffer(),
        ],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      const marketUsdcVaultPda = await getAssociatedTokenAddress(
        params.usdcMint,
        marketPda,
        true
      );

      const creatorUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer,
        true
      );

      let createMarketParams = {
        marketQuestion: params.marketQuestion,
        marketMetadataUri: params.marketMetadataUri,
        marketExpirationDate: new BN(params.marketExpirationDate),
        isBinary: params.isBinary,
        resolvers: params.resolvers,
        requiredVotes: params.requiredVotes,
        resolverReward: new BN(params.resolverReward),
      };

      const createMarketInstruction = await this.program.methods
        .createMarket(createMarketParams)
        .accounts({
          moodring: moodringPda,
          base: params.base,
          market: marketPda,
          marketUsdcVault: marketUsdcVaultPda,
          creatorUsdcAta: creatorUsdcAta,
          feeVault: feeVaultPda,
          usdcMint: params.usdcMint,
          payer: params.payer,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return createMarketInstruction;
    } catch (err) {
      console.error("Error creating market", err);
      throw err;
    }
  }

  /**
   * Create a new option
   * @param params.payer - the payer of the transaction
   * @param params.market - the market to create the option for
   * @param params.option - the option to create
   * @param params.optionLabel - the name of the option
   * @param params.usdcMint - the USDC mint
   * @returns the transaction instruction
   */
  async createOption(
    params: types.CreateOptionParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [optionUsdcVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("option_vault"), params.option.toBuffer()],
        this.program.programId
      );

      const createOptionInstruction = await this.program.methods
        .createOption(params.optionLabel)
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          optionUsdcVault: optionUsdcVaultPda,
          payer: params.payer,
          usdcMint: params.usdcMint,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return createOptionInstruction;
    } catch (err) {
      console.error("Error creating option", err);
      throw err;
    }
  }

  /**
   * Initialize a market
   * @param params.payer - the payer of the transaction
   * @param params.market - the market to initialize
   * @returns the transaction instruction
   */
  async initializeMarket(params: types.InitializeMarketParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const initializeMarketInstruction = await this.program.methods
        .initializeMarket()
        .accounts({
          moodring: moodringPda,
          market: params.market,
          payer: params.payer,
        })
        .instruction();

      return initializeMarketInstruction;
    } catch (err) {
      console.error("Error initializing market", err);
      throw err;
    }
  }

  /**
   * Initialize a user position
   * @param params.payer - the payer of the transaction
   * @param params.option - the option to initialize the user position for
   * @param params.market - the market to initialize the user position for
   * @param params.usdcMint - the USDC mint
   * @returns the transaction instruction
   */
  async initUserPosition(params: types.InitUserPositionParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [userPosPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_pos"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const initializeUserPositionInstruction = await this.program.methods
        .initUserPos()
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          userPos: userPosPda,
          payer: params.payer,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return initializeUserPositionInstruction;
    } catch (err) {
      console.error("Error initializing user position", err);
      throw err;
    }
  }

  /**
   * Deposit tokens into a user position
   * @param params.payer - the payer of the transaction
   * @param params.market - the market to deposit tokens into
   * @param params.option - the option to deposit tokens into
   * @param params.amount - the amount of tokens to deposit
   * @param params.usdcMint - the USDC mint public key
   * @returns the transaction instruction
   */
  async depositTokens(params: types.DepositTokensParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [userPosPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_pos"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const [optionUsdcVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("option_vault"), params.option.toBuffer()],
        this.program.programId
      );

      const userUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer,
        true
      );

      const depositTokensInstruction = await this.program.methods
        .deposit(new BN(params.amount))
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          userPos: userPosPda,
          optionUsdcVault: optionUsdcVaultPda,
          userUsdcAta: userUsdcAta,
          payer: params.payer,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return depositTokensInstruction;
    } catch (err) {
      console.error("Error depositing tokens", err);
      throw err;
    }
  }

  /**
   * Create a new resolver
   * @param params.payer - the payer of the transaction
   * @param params.usdcMint - the USDC mint
   * @param params.amount - the amount of USDC to stake
   * @returns the transaction instruction
   */
  async createResolver(params: types.CreateResolverParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [resolverPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("resolver"), params.payer.toBuffer()],
        this.program.programId
      );

      const [resolverUsdcVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("resolver_vault"), resolverPda.toBuffer()],
        this.program.programId
      );

      const resolverUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer,
        true
      );

      const createResolverInstruction = await this.program.methods
        .createResolver(new BN(params.amount))
        .accounts({
          moodring: moodringPda,
          resolver: resolverPda,
          resolverUsdcAta: resolverUsdcAta,
          resolverStakeVault: resolverUsdcVaultPda,
          payer: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return createResolverInstruction;
    } catch (err) {
      console.error("Error creating resolver", err);
      throw err;
    }
  }

  /**
   * Resolve a market
   * @param params.payer - the payer of the transaction
   * @param params.market - the market to resolve
   * @param params.resolver - the resolver to resolve the market
   * @param params.winningOptionIndex - the index of the winning option
   * @param params.winningSide - the side of the winning option
   * @returns the transaction instruction
   */
  async resolveMarket(params: types.ResolveMarketParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [resolverVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("resolver_vote"),
          params.market.toBuffer(),
          params.resolver.toBuffer(),
        ],
        this.program.programId
      );

      const resolveMarketInstruction = await this.program.methods
        .resolveMarket(params.winningOptionIndex, params.winningSide)
        .accounts({
          moodring: moodringPda,
          market: params.market,
          resolver: params.resolver,
          resolverVote: resolverVotePda,
          payer: params.payer,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      return resolveMarketInstruction;
    } catch (err) {
      console.error("Error resolving market", err);
      throw err;
    }
  }

  /**
   * Claim resolver fee after market resolution
   * @param params.payer - the payer of the transaction
   * @param params.market - the market to claim fees from
   * @param params.resolver - the resolver claiming fees
   * @param resolver - the resolver claiming fees
   * @returns the transaction instruction
   */
  async claimResolverFee(params: types.ClaimResolverFeeParams) {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [resolverVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("resolver_vote"),
          params.market.toBuffer(),
          params.resolver.toBuffer(),
        ],
        this.program.programId
      );

      const claimResolverFeeInstruction = await this.program.methods
        .claimResolverFee()
        .accounts({
          moodring: moodringPda,
          market: params.market,
          resolver: params.resolver,
          resolverVote: resolverVotePda,
          payer: params.payer,
        })
        .instruction();

      return claimResolverFeeInstruction;
    } catch (err) {
      console.error("Error claiming resolver fee", err);
      throw err;
    }
  }

  /**
   * Report an incorrect resolver vote for reputation adjustment
   * @param params.payer - the reporter signing the transaction
   * @param params.market - the resolved market public key
   * @param params.resolver - the resolver PDA being reported
   * @returns the transaction instruction
   */
  async reportVote(
    params: types.ReportVoteParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [resolverVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("resolver_vote"),
          params.market.toBuffer(),
          params.resolver.toBuffer(),
        ],
        this.program.programId
      );

      const ix = await (this.program as any).methods
        .reportVote()
        .accounts({
          moodring: moodringPda,
          market: params.market,
          resolver: params.resolver,
          resolverVote: resolverVotePda,
          reporter: params.payer,
        })
        .instruction();

      return ix;
    } catch (err) {
      console.error("Error reporting resolver vote", err);
      throw err;
    }
  }

  /**
   * @param params.payer - the payer of the transaction
   * @param params.resolver - the resolver to withdraw stake from
   * @param params.usdcMint - the USDC mint
   * Withdraw resolver stake if cooldown elapsed and reputation above minimum
   * @returns the transaction instruction
   */
  async withdrawResolverStake(
    params: types.WithdrawResolverStakeParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [resolverStakeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("resolver_vault"), params.resolver.toBuffer()],
        this.program.programId
      );

      const resolverUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      const ix = await (this.program as any).methods
        .withdrawStake()
        .accounts({
          moodring: moodringPda,
          resolver: params.resolver,
          resolverStakeVault: resolverStakeVaultPda,
          resolverUsdcAta,
          usdcMint: params.usdcMint,
          payer: params.payer,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      return ix;
    } catch (err) {
      console.error("Error withdrawing resolver stake", err);
      throw err;
    }
  }

  /**
   * Get fair value and allowed price range for an option
   * @param option - the option pubkey
   * @returns fair value, min/max prices, and vote counts
   */
  async getFairValueAndRange(option: PublicKey): Promise<{
    fairValue: number;
    minPrice: number;
    maxPrice: number;
    yesQuantity: number;
    noQuantity: number;
  }> {
    try {
      const optionAccount = await this.program.account.marketOption.fetch(
        option
      );
      const yesQuantity = optionAccount.yesQuantity.toNumber();
      const noQuantity = optionAccount.noQuantity.toNumber();
      const total = yesQuantity + noQuantity;

      const fairValue =
        total === 0 ? 500_000 : Math.floor((yesQuantity * 1_000_000) / total);

      const minPrice = Math.max(0, fairValue - 100_000); // -$0.10
      const maxPrice = Math.min(1_000_000, fairValue + 100_000); // +$0.10

      return {
        fairValue,
        minPrice,
        maxPrice,
        yesQuantity,
        noQuantity,
      };
    } catch (err) {
      console.error("Error getting fair value and range", err);
      throw err;
    }
  }

  /**
   * Validate that a price is within the spread constraint
   * @param price - the price to validate
   * @param fairValue - the fair value
   * @returns validation result
   */
  validatePriceInSpread(
    price: number,
    fairValue: number
  ): { valid: boolean; error?: string } {
    try {
      const minPrice = Math.max(0, fairValue - 100_000);
      const maxPrice = Math.min(1_000_000, fairValue + 100_000);

      if (price < minPrice) {
        return {
          valid: false,
          error: `Price $${(price / 1_000_000).toFixed(2)} below minimum $${(
            minPrice / 1_000_000
          ).toFixed(2)}`,
        };
      }

      if (price > maxPrice) {
        return {
          valid: false,
          error: `Price $${(price / 1_000_000).toFixed(2)} above maximum $${(
            maxPrice / 1_000_000
          ).toFixed(2)}`,
        };
      }

      return { valid: true };
    } catch (err) {
      console.error("Error validating price in spread", err);
      throw err;
    }
  }

  // ============================================
  // Liquidity Provider Methods
  // ============================================

  /**
   * Add liquidity to an option pool
   * @description Deposits USDC into the pool and receives proportional LP shares
   * @param params.payer - The wallet providing liquidity
   * @param params.market - The market public key
   * @param params.option - The option public key
   * @param params.amount - USDC amount to deposit (in base units, e.g., 1 USDC = 1_000_000)
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async addLiquidity(
    params: types.AddLiquidityParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [lpPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("lp_position"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );

      const providerUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      return await this.program.methods
        .addLiquidity(new BN(params.amount))
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          lpPosition: lpPositionPda,
          optionVault: optionAccount.usdcVault,
          providerUsdcAta,
          provider: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
    } catch (err) {
      console.error("Error adding liquidity", err);
      throw err;
    }
  }

  /**
   * Remove liquidity from an option pool
   * @description Burns LP shares and receives proportional pool value (only after market resolution)
   * @param params.payer - The wallet removing liquidity
   * @param params.market - The market public key
   * @param params.option - The option public key
   * @param params.shares - Number of LP shares to burn
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async removeLiquidity(
    params: types.RemoveLiquidityParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [lpPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("lp_position"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );

      const [vaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("option_vault"), params.option.toBuffer()],
        this.program.programId
      );

      const providerUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      const sharesBN =
        typeof params.shares === "number"
          ? new BN(params.shares)
          : params.shares;

      return await this.program.methods
        .removeLiquidity(sharesBN)
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          lpPosition: lpPositionPda,
          optionVault: optionAccount.usdcVault,
          vaultSigner: vaultSignerPda,
          providerUsdcAta,
          provider: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
    } catch (err) {
      console.error("Error removing liquidity", err);
      throw err;
    }
  }

  /**
   * Get LP position information
   * @description Fetches the LP position account for a given option and provider
   * @param option - The option public key
   * @param provider - The provider's public key
   * @returns LP position account data or null if not found
   */
  async getLpPosition(option: PublicKey, provider: PublicKey) {
    try {
      const [lpPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_position"), option.toBuffer(), provider.toBuffer()],
        this.program.programId
      );

      return await this.program.account.liquidityPosition.fetch(lpPositionPda);
    } catch (err) {
      console.error("Error getting LP position", err);
      throw err;
    }
  }

  /**
   * Calculate LP share value
   * @description Calculates the current value per LP share in USDC
   * @param option - The option public key
   * @returns Value per share in base units (1 USDC = 1_000_000)
   */
  async calculateLpShareValue(option: PublicKey): Promise<number> {
    try {
      const optionAccount = await this.program.account.marketOption.fetch(
        option
      );

      if (optionAccount.totalLpShares.toNumber() === 0) {
        return 1_000_000; // 1:1 initial ratio
      }

      const totalValue = new BN(optionAccount.poolLiquidity).add(
        new BN(optionAccount.accumulatedLpFees)
      );

      return totalValue
        .mul(PRECISION)
        .div(new BN(optionAccount.totalLpShares))
        .toNumber();
    } catch (err) {
      console.error("Error calculating LP share value", err);
      throw err;
    }
  }

  // ============================================
  // Trading Methods (LMSR)
  // ============================================

  /**
   * Buy YES or NO shares using LMSR pricing
   * @description Purchases shares from the liquidity pool at current LMSR price
   * @param params.payer - The wallet buying shares
   * @param params.market - The market public key
   * @param params.option - The option public key
   * @param params.buyYes - Number of YES shares to buy (0 if buying NO)
   * @param params.buyNo - Number of NO shares to buy (0 if buying YES)
   * @param params.maxCost - Maximum USDC willing to pay (slippage protection)
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async buyShares(
    params: types.BuySharesParams
  ): Promise<TransactionInstruction> {
    try {
      const marketAuthority = await this.program.account.moodMarket.fetch(
        params.market
      );

      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_pos"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      const feeVaultAta = await getAssociatedTokenAddress(
        params.usdcMint,
        feeVaultPda,
        true
      );

      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );

      const userUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      return await this.program.methods
        .buyShares(
          new BN(params.buyYes),
          new BN(params.buyNo),
          new BN(params.maxCost)
        )
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          userPosition: userPositionPda,
          optionVault: optionAccount.usdcVault,
          userUsdcAta,
          user: params.payer,
          feeVault: feeVaultPda,
          feeVaultAta: feeVaultAta,
          usdcMint: params.usdcMint,
          marketAuthorityUsdcAta: marketAuthority.authorityUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
    } catch (err) {
      console.error("Error buying shares", err);
      throw err;
    }
  }

  /**
   * Buy shares with slippage percent
   * @description Computes maxCost from quote and slippageBps, then calls buyShares
   */
  async buySharesWithSlippage(
    params: types.BuyWithSlippageParams
  ): Promise<TransactionInstruction> {
    try {
      const { totalCost } = await this.estimateBuyCost(
        params.option,
        params.buyYes,
        params.buyNo
      );

      const maxCost = Math.floor(
        (totalCost * (10_000 + params.slippageBps)) / 10_000
      );

      return this.buyShares({
        payer: params.payer,
        market: params.market,
        option: params.option,
        buyYes: params.buyYes,
        buyNo: params.buyNo,
        maxCost,
        usdcMint: params.usdcMint,
      });
    } catch (err) {
      console.error("Error buying shares with slippage", err);
      throw err;
    }
  }

  /**
   * Estimate buy cost including fees using LMSR
   * @param option - Option public key
   * @param buyYes - YES quantity to buy (0 if buying NO)
   * @param buyNo - NO quantity to buy (0 if buying YES)
   * @returns { baseCost, totalFee, totalCost }
   */
  async estimateBuyCost(
    option: PublicKey,
    buyYes: number,
    buyNo: number
  ): Promise<{
    baseCost: number;
    totalFee: number;
    totalCost: number;
  }> {
    try {
      const optionAccount = await this.program.account.marketOption.fetch(
        option
      );
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );
      const moodring = await this.program.account.moodring.fetch(moodringPda);

      const yes = optionAccount.yesQuantity.toNumber();
      const no = optionAccount.noQuantity.toNumber();
      const b = optionAccount.liquidityParameter.toNumber();

      console.log("no", no);
      console.log("index liquidity parameter", b);

      if (b <= 0) {
        throw new Error("Liquidity parameter is zero");
      }

      const costBefore = this.#lmsrCost(yes, no, b);
      const costAfter = this.#lmsrCost(yes + buyYes, no + buyNo, b);
      const baseCost = Math.max(0, Math.floor(costAfter - costBefore));

      const lpFee = Math.floor(
        (baseCost * moodring.lpFeeRate.toNumber()) / 10_000
      );
      const protocolFee = Math.floor(
        (baseCost * moodring.protocolFeeRate.toNumber()) / 10_000
      );
      const creatorFee = Math.floor(
        (baseCost * moodring.creatorFeeRate.toNumber()) / 10_000
      );
      const totalFee = lpFee + protocolFee + creatorFee;
      const totalCost = baseCost + totalFee;

      return { baseCost, totalFee, totalCost };
    } catch (err) {
      console.error("Error estimating buy cost", err);
      throw err;
    }
  }

  /**
   * Estimate sell payout including fees using LMSR
   * @param option - Option public key
   * @param sellYes - YES quantity to sell (0 if selling NO)
   * @param sellNo - NO quantity to sell (0 if selling YES)
   * @returns { grossPayout, totalFee, netPayout }
   */
  async estimateSellPayout(
    option: PublicKey,
    sellYes: number,
    sellNo: number
  ): Promise<{
    grossPayout: number;
    totalFee: number;
    netPayout: number;
  }> {
    try {
      const optionAccount = await this.program.account.marketOption.fetch(
        option
      );
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );
      const moodring = await this.program.account.moodring.fetch(moodringPda);

      const yes = optionAccount.yesQuantity.toNumber();
      const no = optionAccount.noQuantity.toNumber();
      const b = optionAccount.liquidityParameter.toNumber();

      if (sellYes > yes || sellNo > no) {
        throw new Error("Sell amount exceeds pool quantities");
      }
      if (b <= 0) {
        throw new Error("Liquidity parameter is zero");
      }

      const costBefore = this.#lmsrCost(yes, no, b);
      const costAfter = this.#lmsrCost(yes - sellYes, no - sellNo, b);
      const grossPayout = Math.max(0, Math.floor(costBefore - costAfter));

      const lpFee = Math.floor(
        (grossPayout * moodring.lpFeeRate.toNumber()) / 10_000
      );
      const protocolFee = Math.floor(
        (grossPayout * moodring.protocolFeeRate.toNumber()) / 10_000
      );
      const creatorFee = Math.floor(
        (grossPayout * moodring.creatorFeeRate.toNumber()) / 10_000
      );
      const totalFee = lpFee + protocolFee + creatorFee;
      const netPayout = Math.max(0, grossPayout - totalFee);

      return { grossPayout, totalFee, netPayout };
    } catch (err) {
      console.error("Error estimating sell payout", err);
      throw err;
    }
  }

  // Numerically stable LMSR cost function matching on-chain approach
  #lmsrCost(yes: number, no: number, b: number): number {
    try {
      const maxQ = Math.max(yes, no);
      const diff = Math.abs(yes - no);
      const lnTerm = Math.log1p(Math.exp(-diff / b));
      const result = maxQ + b * lnTerm;
      // Guard against NaN/Inf
      if (!Number.isFinite(result)) return Number.MAX_SAFE_INTEGER;
      return result;
    } catch (err) {
      console.error("Error calculating LMSR cost", err);
      throw err;
    }
  }

  /**
   * Sell YES or NO shares using LMSR pricing
   * @description Sells shares back to the liquidity pool at current LMSR price
   * @param params.payer - The wallet selling shares
   * @param params.market - The market public key
   * @param params.option - The option public key
   * @param params.sellYes - Number of YES shares to sell (0 if selling NO)
   * @param params.sellNo - Number of NO shares to sell (0 if selling YES)
   * @param params.minPayout - Minimum USDC to receive (slippage protection)
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async sellShares(
    params: types.SellSharesParams
  ): Promise<TransactionInstruction> {
    try {
      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );

      const marketAccount = await this.program.account.moodMarket.fetch(
        params.market
      );

      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_pos"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      const feeVaultAta = await getAssociatedTokenAddress(
        params.usdcMint,
        feeVaultPda,
        true
      );

      const userUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      const sellYesBN =
        typeof params.sellYes === "number"
          ? new BN(params.sellYes)
          : params.sellYes;

      const sellNoBN =
        typeof params.sellNo === "number"
          ? new BN(params.sellNo)
          : params.sellNo;

      const minPayoutBN =
        typeof params.minPayout === "number"
          ? new BN(params.minPayout)
          : params.minPayout;

      return await this.program.methods
        .sellShares(sellYesBN, sellNoBN, minPayoutBN)
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          userPosition: userPositionPda,
          optionVault: optionAccount.usdcVault,
          feeVault: feeVaultPda,
          feeVaultAta,
          userUsdcAta,
          marketAuthorityUsdcAta: marketAccount.authorityUsdcAta,
          user: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
    } catch (err) {
      console.error("Error selling shares", err);
      throw err;
    }
  }

  /**
   * Sell shares with slippage percent
   * @description Computes minPayout from quote and slippageBps, then calls sellShares
   */
  async sellSharesWithSlippage(
    params: types.SellWithSlippageParams
  ): Promise<TransactionInstruction> {
    try {
      const { netPayout } = await this.estimateSellPayout(
        params.option,
        params.sellYes,
        params.sellNo
      );

      const minPayout = Math.floor(
        (netPayout * (10_000 - params.slippageBps)) / 10_000
      );

      return this.sellShares({
        payer: params.payer,
        market: params.market,
        option: params.option,
        sellYes: params.sellYes,
        sellNo: params.sellNo,
        minPayout,
        usdcMint: params.usdcMint,
      });
    } catch (err) {
      console.error("Error selling shares with slippage", err);
      throw err;
    }
  }

  /**
   * Withdraw USDC from user position
   * @description Withdraws available USDC balance from trading account
   * @param params.payer - The wallet withdrawing funds
   * @param params.market - The market public key
   * @param params.option - The option public key
   * @param params.amount - Amount of USDC to withdraw
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async withdraw(
    params: types.WithdrawParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_pos"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );

      const [vaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("option_vault"), params.option.toBuffer()],
        this.program.programId
      );

      const userUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      const amountBN =
        typeof params.amount === "number"
          ? new BN(params.amount)
          : params.amount;

      return await this.program.methods
        .withdraw(amountBN)
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          userPos: userPositionPda,
          optionVault: optionAccount.usdcVault,
          vaultSigner: vaultSignerPda,
          userUsdcAta,
          payer: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
    } catch (err) {
      console.error("Error withdrawing", err);
      throw err;
    }
  }

  /**
   * Claim winnings after market resolution
   * @description Claims winning shares (YES or NO based on resolution) for USDC payout
   * @param params.payer - The wallet claiming winnings
   * @param params.market - The market public key
   * @param params.option - The option public key
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async claimWinnings(
    params: types.ClaimWinningsParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_pos"),
          params.option.toBuffer(),
          params.payer.toBuffer(),
        ],
        this.program.programId
      );

      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );

      const [vaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("option_vault"), params.option.toBuffer()],
        this.program.programId
      );

      const userUsdcAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer
      );

      return await this.program.methods
        .claimWinnings()
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          userPosition: userPositionPda,
          optionVault: optionAccount.usdcVault,
          vaultSigner: vaultSignerPda,
          userUsdcAta,
          payer: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
    } catch (err) {
      console.error("Error claiming winnings", err);
      throw err;
    }
  }

  /**
   * Withdraw creator fees to the market authority's ATA (only after resolution)
   */
  async withdrawCreatorFee(
    params: types.WithdrawCreatorFeeParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          params.payer.toBuffer(),
          params.market.toBuffer(),
        ],
        this.program.programId
      );

      // Authority ATA
      const authorityAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.payer,
        true
      );

      // Option vault is stored on-chain; we still fetch its address to pass it
      const optionAccount = await this.program.account.marketOption.fetch(
        params.option
      );
      const optionVault: PublicKey = optionAccount.usdcVault as PublicKey;

      return await (this.program as any).methods
        .withdrawCreatorFee()
        .accounts({
          moodring: moodringPda,
          market: params.market,
          option: params.option,
          optionVault,
          authorityUsdcAta: authorityAta,
          authority: params.payer,
          usdcMint: params.usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
    } catch (err) {
      console.error("Error withdrawing creator fee", err);
      throw err;
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Format price for display
   * @param price - the price in base units
   * @returns formatted price string
   */
  formatPrice(price: number): string {
    return `$${(price / 1_000_000).toFixed(2)}`;
  }

  // ============================================
  // Admin Methods
  // ============================================

  /**
   * Set pause flags
   * @description Sets the pause flags for the program
   * @param params.pauseAdmin - The pause admin public key
   * @param params.isPaused - Whether the program is paused
   * @param params.pauseTrading - Whether trading is paused
   * @param params.pauseLiquidity - Whether liquidity is paused
   * @param params.pauseResolution - Whether resolution is paused
   * @returns Transaction instruction
   */
  async setPauseFlags(
    params: types.SetPauseFlagsParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const pauseParams = {
        isPaused: params.isPaused === undefined ? null : params.isPaused,
        pauseTrading:
          params.pauseTrading === undefined ? null : params.pauseTrading,
        pauseLiquidity:
          params.pauseLiquidity === undefined ? null : params.pauseLiquidity,
        pauseResolution:
          params.pauseResolution === undefined ? null : params.pauseResolution,
      } as any;

      return await (this.program as any).methods
        .setPauseFlags(pauseParams)
        .accounts({
          moodring: moodringPda,
          pauseAdmin: params.pauseAdmin,
        })
        .instruction();
    } catch (err) {
      console.error("Error setting pause flags", err);
      throw err;
    }
  }

  /**
   * Update admins
   * @description Updates the fee admin and pause admin
   * @param params.admin - The admin public key
   * @param params.newFeeAdmin - The new fee admin public key
   * @param params.newPauseAdmin - The new pause admin public key
   * @returns Transaction instruction
   */
  async updateAdmins(
    params: types.UpdateAdminsParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      const adminParams = {
        newFeeAdmin: params.newFeeAdmin ?? null,
        newPauseAdmin: params.newPauseAdmin ?? null,
      } as any;

      return await (this.program as any).methods
        .updateAdmins(adminParams)
        .accounts({
          moodring: moodringPda,
          feeVault: feeVaultPda,
          admin: params.admin,
        })
        .instruction();
    } catch (err) {
      console.error("Error updating admins", err);
      throw err;
    }
  }

  /**
   * @description Redeems the USDC fee from the fee vault to the fee admin's ATA
   * @param params.feeAdmin - The fee admin public key
   * @param params.usdcMint - The USDC mint public key
   * @returns Transaction instruction
   */
  async redeemUsdcFee(
    params: types.RedeemUsdcFeeParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      const feeVaultAta = await getAssociatedTokenAddress(
        params.usdcMint,
        feeVaultPda,
        true
      );

      const recipientAta = await getAssociatedTokenAddress(
        params.usdcMint,
        params.feeAdmin,
        true
      );

      return await (this.program as any).methods
        .redeemUsdcFee()
        .accounts({
          moodring: moodringPda,
          feeVault: feeVaultPda,
          recipientAta,
          feeVaultAta,
          recipient: params.feeAdmin,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
    } catch (err) {
      console.error("Error redeeming USDC fee", err);
      throw err;
    }
  }

  /**
   * @description Redeems the SOL fee from the fee vault to the fee admin
   * @param params.feeAdmin - The fee admin public key
   * @returns Transaction instruction
   */
  async redeemSolFee(
    params: types.RedeemSolFeeParams
  ): Promise<TransactionInstruction> {
    try {
      const [moodringPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("moodring")],
        this.program.programId
      );

      const [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault")],
        this.program.programId
      );

      return await (this.program as any).methods
        .redeemSolFee()
        .accounts({
          moodring: moodringPda,
          feeVault: feeVaultPda,
          recipient: params.feeAdmin,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
    } catch (err) {
      console.error("Error redeeming SOL fee", err);
      throw err;
    }
  }

  /**
   * Format quantity for display
   * @param quantity - the quantity in base units
   * @returns formatted quantity string
   */
  formatQuantity(quantity: number): string {
    try {
      return `${(quantity / 1_000_000).toFixed(2)} tokens`;
    } catch (err) {
      console.error("Error formatting quantity", err);
      throw err;
    }
  }
}
