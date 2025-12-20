import {
  ConfirmedSignatureInfo,
  Connection,
  PublicKey,
  TransactionResponse,
  VersionedTransactionResponse,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Wallet, WalletModel } from "../models/Wallet";
import { DepositModel } from "../models/Deposit";
import { SweepModel } from "../models/Sweep";
import { getCircleWallet } from "./circleWallet";
import { USDC_MINT_ADDRESS } from "../sdk/constants";

// Configuration constants
const DEFAULT_POLL_INTERVAL_MS = 45_000; // How often to check for new deposits (45 seconds)
const DEFAULT_SIGNATURE_LIMIT = 50; // Number of recent transactions to check per wallet per poll
// On startup, fetch more signatures to catch up on missed deposits
const STARTUP_SIGNATURE_LIMIT = 200; // Higher limit on first run to catch up

// Devnet Solana RPC URL
const DEFAULT_RPC_URL = process.env.RPC_URL;

// NOTE: There is NO minimum deposit amount - the listener processes ANY positive USDC deposit
// USDC uses 6 decimals, so the smallest unit is 1 micro-USDC (0.000001 USDC)

// Union type to handle both legacy and versioned Solana transactions
type AnyTransactionResponse =
  | VersionedTransactionResponse
  | TransactionResponse;

/**
 * DepositListener monitors Solana wallets for USDC deposits and automatically:
 * 1. Records deposits in the database
 * 2. Updates wallet balances
 * 3. Sweeps deposits to the hot wallet via Circle
 *
 * No minimum deposit amount - processes ANY positive USDC deposit (even 1 micro-USDC = 0.000001 USDC)
 */
class DepositListener {
  private timer: NodeJS.Timeout | null = null; // Timer for scheduling next poll
  private isRunning = false; // Prevents concurrent poll executions
  private started = false; // Tracks if listener has been started
  private isFirstRun = true; // Flag for startup catchup logic

  constructor(
    private readonly connection: Connection, // Solana RPC connection
    private readonly pollIntervalMs: number, // How often to poll (milliseconds)
    private readonly signatureLimit: number, // Max signatures to fetch per wallet per poll
    private readonly tokenMint: PublicKey // USDC mint address
  ) {}

  /**
   * Start the deposit listener - begins polling for deposits
   */
  start() {
    if (this.started) {
      return; // Already started, don't start again
    }
    this.started = true;
    this.isFirstRun = true; // Enable startup catchup mode
    console.log(
      `[Deposits] USDC deposit listener started on devnet (interval=${this.pollIntervalMs}ms, limit=${this.signatureLimit})`
    );
    console.log(
      `[Deposits] Monitoring USDC mint: ${this.tokenMint.toBase58()}`
    );
    console.log(
      `[Deposits] Running startup catchup with limit=${STARTUP_SIGNATURE_LIMIT} to recover any missed deposits...`
    );

    // Start the polling loop immediately
    this.pollLoop();
  }

  /**
   * Stop the deposit listener - cancels polling
   */
  stop() {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer); // Cancel scheduled next poll
      this.timer = null;
    }
    console.log("[Deposits] USDC deposit listener stopped");
  }

  /**
   * Schedule the next poll after the configured interval
   */
  private scheduleNext() {
    if (!this.started) {
      return; // Don't schedule if stopped
    }
    this.timer = setTimeout(() => this.pollLoop(), this.pollIntervalMs);
  }

  /**
   * Main polling loop - runs periodically to check for new deposits
   * Prevents concurrent executions to avoid race conditions
   */
  private async pollLoop() {
    if (!this.started) {
      return; // Don't poll if stopped
    }

    // If already running, just schedule next poll and return
    // This prevents overlapping poll executions
    if (this.isRunning) {
      this.scheduleNext();
      return;
    }

    this.isRunning = true; // Mark as running to prevent concurrent polls

    try {
      await this.pollWallets(); // Check all wallets for deposits
    } catch (error) {
      console.error("[Deposits] Poll loop error:", error);
    } finally {
      this.isRunning = false; // Mark as not running
      this.scheduleNext(); // Schedule next poll regardless of success/failure
    }
  }

  /**
   * Poll all wallets in the database for new USDC deposits
   * Uses higher signature limit on first run to catch up on missed deposits
   */
  private async pollWallets() {
    // Fetch all wallets from database
    const wallets = await WalletModel.findAll();

    if (!wallets.length) {
      if (this.isFirstRun) {
        console.log("[Deposits] Startup catchup complete (no wallets found)");
        this.isFirstRun = false;
      }
      return; // No wallets to check
    }

    // Use higher limit on first run to catch up on missed deposits
    // After first run, use normal limit for efficiency
    const limit = this.isFirstRun
      ? STARTUP_SIGNATURE_LIMIT
      : this.signatureLimit;

    // Filter wallets that have a public key (required for monitoring)
    const validWallets = wallets.filter((w) => w.public_key);

    if (!validWallets.length) {
      if (this.isFirstRun) {
        console.log(
          "[Deposits] Startup catchup complete (no wallets with public keys)"
        );
        this.isFirstRun = false;
      }
      return; // No valid wallets to check
    }

    // Check each wallet for deposits (process in parallel but catch errors individually)
    for (const wallet of validWallets) {
      await this.syncWallet(wallet, limit).catch((error) => {
        // Log error but continue processing other wallets
        console.error(
          `[Deposits] Failed to sync wallet ${wallet.id} (${wallet.public_key}):`,
          error
        );
      });
    }

    if (this.isFirstRun) {
      console.log(
        `[Deposits] ✅ Startup catchup complete - processed ${validWallets.length} wallets`
      );
      this.isFirstRun = false; // Disable catchup mode after first run
    }
  }

  /**
   * Sync a single wallet - check for new USDC deposits
   * @param wallet - Wallet record from database
   * @param limit - Maximum number of signatures to fetch
   */
  private async syncWallet(wallet: Wallet, limit: number) {
    if (!wallet.public_key) {
      return; // Can't sync without public key
    }

    // Parse the public key string into a PublicKey object
    let walletPublicKey: PublicKey;
    try {
      walletPublicKey = new PublicKey(wallet.public_key);
    } catch (error) {
      console.warn(
        `[Deposits] Invalid wallet public key stored for wallet ${wallet.id}: ${wallet.public_key}`
      );
      return; // Skip invalid public keys
    }

    // Get the associated token account (ATA) for USDC
    // Each wallet has a unique token account address for each SPL token
    const tokenAccountPublicKey = getAssociatedTokenAddressSync(
      this.tokenMint, // USDC mint address
      walletPublicKey // Wallet owner
    );

    // Monitor the token account for deposits
    await this.syncTokenDeposits(
      wallet,
      walletPublicKey,
      tokenAccountPublicKey,
      limit
    );
  }

  /**
   * Sync deposits for a token account - fetch recent transactions and process new deposits
   * @param wallet - Wallet record
   * @param walletPublicKey - Wallet's public key
   * @param tokenAccountPublicKey - Associated token account address for USDC
   * @param limit - Maximum number of signatures to fetch
   */
  private async syncTokenDeposits(
    wallet: Wallet,
    walletPublicKey: PublicKey,
    tokenAccountPublicKey: PublicKey,
    limit: number
  ): Promise<void> {
    // Fetch recent transaction signatures for the token account
    let signatures: ConfirmedSignatureInfo[] = [];
    try {
      signatures = await this.connection.getSignaturesForAddress(
        tokenAccountPublicKey,
        { limit } // Get up to 'limit' most recent transactions
      );
    } catch (error: any) {
      // Token account doesn't exist yet - no deposits to process
      // This is normal for wallets that haven't received USDC yet
      if (
        typeof error?.message === "string" &&
        error.message.includes("does not exist")
      ) {
        return; // No token account = no deposits
      }
      throw error; // Re-throw unexpected errors
    }

    if (!signatures.length) {
      return; // No transactions to process
    }

    // Check which signatures we've already processed (avoid duplicates)
    const processedSignatures = await DepositModel.findExistingSignatures(
      signatures.map((signatureInfo) => signatureInfo.signature)
    );

    // Filter to only new signatures and reverse to process oldest first
    // Processing chronologically ensures we handle deposits in order
    const pendingSignatures = signatures
      .filter(
        (signatureInfo) => !processedSignatures.has(signatureInfo.signature)
      )
      .reverse(); // Reverse because getSignaturesForAddress returns newest first

    // Process each new signature
    for (const signatureInfo of pendingSignatures) {
      await this.processTokenSignature(
        wallet,
        walletPublicKey,
        tokenAccountPublicKey,
        signatureInfo
      );
    }
  }

  /**
   * Process a single transaction signature - extract deposit info and record it
   * This is where the actual deposit detection happens
   * @param wallet - Wallet record
   * @param walletPublicKey - Wallet's public key
   * @param tokenAccountPublicKey - Token account address
   * @param signatureInfo - Transaction signature info from Solana
   */
  private async processTokenSignature(
    wallet: Wallet,
    walletPublicKey: PublicKey,
    tokenAccountPublicKey: PublicKey,
    signatureInfo: ConfirmedSignatureInfo
  ) {
    // Skip failed transactions (they don't represent successful deposits)
    if (signatureInfo.err) {
      return;
    }

    // Fetch full transaction details including token balance changes
    const tx = await this.connection.getTransaction(signatureInfo.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0, // Support versioned transactions
    });

    if (!tx || !tx.meta) {
      return; // Can't process without transaction metadata
    }

    // Extract all account keys from transaction (handles both legacy and versioned)
    const accountKeys = this.resolveAccountKeys(tx);

    // Find the index of our token account in the transaction's account list
    const tokenAccountIndex = accountKeys.findIndex((key) =>
      key.equals(tokenAccountPublicKey)
    );

    if (tokenAccountIndex === -1) {
      return; // Token account not involved in this transaction
    }

    // Calculate how much USDC was received (post-balance - pre-balance)
    // This is the deposit amount in micro-USDC (6 decimals)
    const tokenDeltaInfo = this.calculateTokenDelta(tx.meta, tokenAccountIndex);

    // Only process positive deltas (deposits, not withdrawals)
    // NOTE: No minimum amount check - processes ANY positive deposit (even 1 micro-USDC)
    if (!tokenDeltaInfo || tokenDeltaInfo.delta <= 0n) {
      return; // Not a deposit or no change
    }

    // Identify the source account that sent the USDC (for tracking/audit)
    const sourceAccount = this.identifyTokenSourceAccount(
      tx.meta,
      accountKeys,
      tokenAccountIndex
    );

    // Record the deposit in the database
    const recorded = await DepositModel.recordDeposit({
      wallet_id: wallet.id,
      user_id: wallet.user_id,
      signature: signatureInfo.signature, // Unique transaction identifier
      slot: signatureInfo.slot, // Solana slot number
      block_time: signatureInfo.blockTime
        ? signatureInfo.blockTime // Already a Unix timestamp in seconds
        : undefined,
      amount: Number(tokenDeltaInfo.delta), // Amount in micro-USDC (6 decimals)
      token_symbol: "USDC",
      source: sourceAccount, // Where the deposit came from
      status: signatureInfo.confirmationStatus || "confirmed",
      raw: tx.meta, // Store full metadata for debugging/audit
    });

    if (!recorded) {
      // Deposit already exists in DB or failed to record (duplicate prevention)
      return;
    }

    // Update the wallet's USDC balance in the database
    await this.addToBalance(wallet.id, Number(tokenDeltaInfo.delta));

    console.log(
      `[Deposits] ✅ Recorded USDC deposit of ${tokenDeltaInfo.delta} (${
        Number(tokenDeltaInfo.delta) / 1_000_000
      } USDC) for wallet ${wallet.id} (${walletPublicKey.toBase58()})`
    );

    // Create activity for the deposit
    try {
      const { ActivityModel } = await import("../models/Activity");
      await ActivityModel.create({
        user_id: wallet.user_id,
        activity_type: "deposit",
        entity_type: "user",
        entity_id: wallet.user_id,
        metadata: {
          deposit_id: recorded.id,
          amount: Number(tokenDeltaInfo.delta),
          token_symbol: "USDC",
          signature: signatureInfo.signature,
          source: sourceAccount,
        },
        is_public: false, // Deposits are private by default
      });
    } catch (error) {
      console.error("[Deposits] Failed to create deposit activity:", error);
      // Don't fail the deposit if activity creation fails
    }

    // Automatically sweep the deposit to the hot wallet using Circle
    // This moves funds from user's wallet to platform's hot wallet
    await this.sweepDepositToHotWallet(
      wallet,
      Number(tokenDeltaInfo.delta),
      recorded.id,
      walletPublicKey.toBase58()
    );
  }

  /**
   * Add amount to user's platform USDC balance in the database
   * @param walletId - Wallet ID
   * @param amount - Amount to add in micro-USDC (6 decimals)
   */
  private async addToBalance(walletId: string, amount: number): Promise<void> {
    const { pool } = await import("../db");
    // Increment the wallet's USDC balance by the deposit amount
    await pool.query(
      `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
      [amount, walletId]
    );
  }

  /**
   * Sweep a deposit to the hot wallet using Circle
   * This automatically moves funds from the user's wallet to the platform's hot wallet
   * @param wallet - User wallet
   * @param amount - Amount to sweep in micro-USDC (6 decimals)
   * @param depositId - Deposit record ID
   * @param sourceAddress - Source wallet address
   */
  private async sweepDepositToHotWallet(
    wallet: Wallet,
    amount: number,
    depositId: string,
    sourceAddress: string
  ): Promise<void> {
    // Check if Circle wallet service is available
    const circleWallet = getCircleWallet();
    if (!circleWallet.isAvailable()) {
      console.warn(
        "[Deposits] Circle wallet service not available. Skipping sweep."
      );
      return; // Can't sweep without Circle service
    }

    // Check if wallet has a Circle wallet ID (required for Circle operations)
    if (!wallet.circle_wallet_id) {
      console.warn(
        `[Deposits] Wallet ${wallet.id} does not have a Circle wallet ID. Skipping sweep.`
      );
      return; // Can't sweep without Circle wallet ID
    }

    // Get hot wallet info (platform's central wallet)
    const hotWalletInfo = await circleWallet.getHotWalletInfo();
    if (!hotWalletInfo) {
      console.warn("[Deposits] Hot wallet not configured. Skipping sweep.");
      return; // Can't sweep without hot wallet
    }

    try {
      // Create sweep record in database with pending status
      // This tracks the sweep operation for audit/debugging
      const sweep = await SweepModel.create({
        wallet_id: wallet.id,
        user_id: wallet.user_id,
        deposit_id: depositId, // Link to the deposit record
        source_address: sourceAddress, // User's wallet address
        destination_address: hotWalletInfo.address, // Hot wallet address
        amount: amount, // Amount in micro-USDC
        token_symbol: "USDC",
      });

      console.log(
        `[Deposits] Initiating sweep of ${amount} USDC (${
          amount / 1_000_000
        } USDC) from wallet ${wallet.id} to hot wallet...`
      );

      // Perform the actual sweep using Circle API
      // This transfers USDC from user's Circle wallet to hot wallet
      const transactionId = await circleWallet.sweepUsdcToHotWallet(
        wallet.circle_wallet_id,
        amount
      );

      if (transactionId) {
        // Mark sweep as completed with transaction ID
        await SweepModel.markCompleted(sweep.id, transactionId);
        console.log(
          `[Deposits] ✅ Successfully swept ${amount} USDC (${
            amount / 1_000_000
          } USDC) to hot wallet - sweep ID: ${
            sweep.id
          }, transaction: ${transactionId}`
        );
      } else {
        // Mark sweep as failed if Circle didn't return a transaction ID
        await SweepModel.markFailed(
          sweep.id,
          "Circle sweep returned null transaction ID"
        );
        console.error(
          `[Deposits] ❌ Failed to sweep deposit - sweep ID: ${sweep.id}`
        );
      }
    } catch (error: any) {
      // Handle any errors during the sweep process
      console.error(
        `[Deposits] Error sweeping deposit to hot wallet:`,
        error.message
      );

      // Try to find and mark the sweep as failed if it was created
      // This ensures we don't leave pending sweeps in the database
      try {
        const { pool } = await import("../db");
        const result = await pool.query(
          `SELECT id FROM wallet_sweeps WHERE deposit_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
          [depositId]
        );
        if (result.rows.length > 0) {
          await SweepModel.markFailed(
            result.rows[0].id,
            error.message || "Unknown error during sweep"
          );
        }
      } catch (markFailedError) {
        // Ignore errors when trying to mark as failed (don't throw)
        console.error(
          "[Deposits] Failed to mark sweep as failed:",
          markFailedError
        );
      }
    }
  }

  /**
   * Resolve account keys from transaction (handles both legacy and versioned transactions)
   * Solana has two transaction formats:
   * - Legacy: accountKeys array directly in message
   * - Versioned: staticAccountKeys + loadedAddresses (address lookup tables)
   * @param tx - Transaction response from Solana
   * @returns Array of all account public keys involved in the transaction
   */
  private resolveAccountKeys(tx: AnyTransactionResponse): PublicKey[] {
    const message: any = tx.transaction.message;

    // Legacy transaction format - account keys are directly in message
    if (Array.isArray(message.accountKeys)) {
      return message.accountKeys.map((key: any) =>
        typeof key === "string" ? new PublicKey(key) : key
      );
    }

    // Versioned transaction format - uses address lookup tables (ALTs)
    if (Array.isArray(message.staticAccountKeys)) {
      // Static keys are always included
      const staticKeys = message.staticAccountKeys.map((key: any) =>
        typeof key === "string" ? new PublicKey(key) : key
      );

      // Loaded addresses come from address lookup tables
      const writable = tx.meta?.loadedAddresses?.writable || [];
      const readonly = tx.meta?.loadedAddresses?.readonly || [];

      // Combine all account keys
      return [...staticKeys, ...writable, ...readonly];
    }

    return []; // No account keys found (shouldn't happen)
  }

  /**
   * Calculate token delta (amount received) for a token account
   * Compares pre-transaction and post-transaction balances to determine deposit amount
   * @param meta - Transaction metadata containing token balance changes
   * @param tokenAccountIndex - Index of the token account in the transaction's account list
   * @returns Object with delta (amount received) and postAmount, or null if not a deposit
   *
   * NOTE: No minimum amount - returns ANY positive delta (even 1 micro-USDC = 0.000001 USDC)
   */
  private calculateTokenDelta(
    meta: AnyTransactionResponse["meta"],
    tokenAccountIndex: number
  ): { delta: bigint; postAmount: bigint } | null {
    if (!meta || !meta.postTokenBalances) {
      return null; // Can't calculate without balance info
    }

    const mintAddress = this.tokenMint.toBase58(); // USDC mint address

    // Find the post-transaction balance for this token account
    // postTokenBalances shows balances after the transaction executed
    const postBalance = meta.postTokenBalances.find(
      (balance) =>
        balance.accountIndex === tokenAccountIndex &&
        balance.mint === mintAddress // Must match USDC mint
    );

    if (!postBalance) {
      return null; // Token account not found in post-balances
    }

    // Find the pre-transaction balance (before transaction executed)
    // preTokenBalances shows balances before the transaction
    const preBalance =
      meta.preTokenBalances?.find(
        (balance) =>
          balance.accountIndex === tokenAccountIndex &&
          balance.mint === mintAddress
      ) || null;

    // Convert amounts to BigInt for precise calculation (amounts are in micro-USDC)
    const preAmount = BigInt(preBalance?.uiTokenAmount?.amount ?? "0");
    const postAmount = BigInt(postBalance.uiTokenAmount.amount);

    // Calculate the difference (how much was received)
    const delta = postAmount - preAmount;

    // Only return positive deltas (deposits, not withdrawals)
    // This is where we check for deposits - ANY positive amount is a deposit
    // No minimum threshold - even 1 micro-USDC (0.000001 USDC) will be processed
    if (delta <= 0n) {
      return null; // Not a deposit (withdrawal or no change)
    }

    return { delta, postAmount };
  }

  /**
   * Identify the source account that sent tokens to the recipient
   * Finds which account's balance decreased (sent USDC) to identify the sender
   * @param meta - Transaction metadata with token balance changes
   * @param accountKeys - All account keys in the transaction
   * @param recipientIndex - Index of the recipient token account
   * @returns Source account address (sender), or null if can't be determined
   */
  private identifyTokenSourceAccount(
    meta: AnyTransactionResponse["meta"],
    accountKeys: PublicKey[],
    recipientIndex: number
  ): string | null {
    if (!meta?.preTokenBalances || !meta.postTokenBalances) {
      return null; // Can't identify sender without balance info
    }

    const mintAddress = this.tokenMint.toBase58(); // USDC mint address

    // Look for token accounts that decreased (sent tokens)
    // The account that sent USDC will have a lower post-balance than pre-balance
    for (const preBalance of meta.preTokenBalances) {
      // Skip if not USDC or if it's the recipient (we're looking for the sender)
      if (
        preBalance.mint !== mintAddress ||
        preBalance.accountIndex === recipientIndex
      ) {
        continue;
      }

      // Find the corresponding post-balance for this account
      const postBalance = meta.postTokenBalances.find(
        (balance) =>
          balance.accountIndex === preBalance.accountIndex &&
          balance.mint === mintAddress
      );

      if (!postBalance) {
        continue; // Account not in post-balances (unlikely but possible)
      }

      // Calculate if this account's balance decreased
      const preAmount = BigInt(preBalance.uiTokenAmount?.amount ?? "0");
      const postAmount = BigInt(postBalance.uiTokenAmount?.amount ?? "0");

      // If this account's balance decreased, it's likely the source (sender)
      if (postAmount < preAmount) {
        const accountIndex = preBalance.accountIndex;
        // Try to get the account address from the transaction's account keys
        if (
          accountIndex !== undefined &&
          accountIndex >= 0 &&
          accountIndex < accountKeys.length
        ) {
          return accountKeys[accountIndex].toBase58();
        }

        // Fallback to owner field if account index lookup fails
        return preBalance.owner || null;
      }
    }

    return null; // Couldn't identify source account
  }
}

// Singleton instance of the deposit listener
let listenerInstance: DepositListener | null = null;

/**
 * Start the USDC deposit listener
 * Creates and starts a singleton instance that monitors all wallets for USDC deposits
 * @returns The listener instance, or null if it couldn't be started
 */
export const startDepositListener = (): DepositListener | null => {
  // Don't start listener in test environment
  if (process.env.NODE_ENV === "test") {
    console.log("[Deposits] Listener disabled in test environment");
    return null;
  }

  // Return existing instance if already started (singleton pattern)
  if (listenerInstance) {
    return listenerInstance;
  }

  // Use RPC_URL from env, or default to devnet
  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;

  if (!rpcUrl) {
    console.warn(
      "[Deposits] RPC_URL not set. Wallet deposit listener will not start."
    );
    return null; // Can't connect without RPC URL
  }

  // Get configuration from environment variables or use defaults
  const pollIntervalMs =
    Number(process.env.DEPOSIT_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS;
  const signatureLimit =
    Number(process.env.DEPOSIT_SIGNATURE_LIMIT) || DEFAULT_SIGNATURE_LIMIT;

  // Use USDC mint address from constants (devnet USDC)
  const tokenMintAddress = USDC_MINT_ADDRESS;
  let tokenMint: PublicKey;
  try {
    tokenMint = new PublicKey(tokenMintAddress);
  } catch (error) {
    console.error(
      `[Deposits] Invalid token mint address provided: ${tokenMintAddress}`,
      error
    );
    return null; // Can't proceed with invalid mint address
  }

  console.log(`[Deposits] Connecting to Solana devnet: ${rpcUrl}`);
  console.log(`[Deposits] USDC mint address: ${tokenMintAddress}`);

  // Create Solana connection with "confirmed" commitment level
  // This ensures we see transactions that are confirmed on-chain
  const connection = new Connection(rpcUrl, "confirmed");

  // Create and start the listener instance
  listenerInstance = new DepositListener(
    connection,
    pollIntervalMs,
    signatureLimit,
    tokenMint
  );
  listenerInstance.start(); // Begin polling for deposits

  return listenerInstance;
};
