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

// Note: WalletModel is used for:
// - findAll() to get all wallets to monitor
// - updateLastSignature() to track last processed signature per wallet
import { SweepModel } from "../models/Sweep";
import { getCircleWallet } from "./circleWallet";
import { getUsdcMintAddress } from "../sdk/constants";

// Configuration constants
// OPTIMIZATION: Increased from 45s to 2 minutes - with last_signature tracking,
// we only fetch NEW signatures each poll, so frequent polling is less critical
const DEFAULT_POLL_INTERVAL_MS = 120_000; // How often to check for new deposits (2 minutes)
const DEFAULT_SIGNATURE_LIMIT = 50; // Number of recent transactions to check per wallet per poll
// On startup, fetch more signatures to catch up on missed deposits
const STARTUP_SIGNATURE_LIMIT = 200; // Higher limit on first run to catch up

// Devnet Solana RPC URL
const DEFAULT_RPC_URL = process.env.RPC_URL;

// SECURITY FIX (CVE-006): Minimum deposit amount to prevent DoS via micro-deposits
// Minimum deposit: 1 USDC = 1,000,000 micro-USDC (prevents spam attacks)
const MIN_DEPOSIT_AMOUNT = 1_000_000 / 4; // 0.25 USDC in micro-units (6 decimals)

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
 * SECURITY FIX (CVE-006): Minimum deposit of 1 USDC required to prevent DoS attacks
 * Per-wallet rate limiting: 10 deposits per hour
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
      `[Deposits] USDC deposit listener started (interval=${this.pollIntervalMs}ms, limit=${this.signatureLimit})`
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
        // Check if this is a transient error that was already handled gracefully
        const isTransientError =
          error?.code === -32019 ||
          error?.code === -32002 ||
          error?.code === -32005 ||
          error?.message?.includes("ETIMEDOUT") ||
          error?.message?.includes("timeout") ||
          error?.message?.includes("Failed to query long-term storage") ||
          error?.message?.includes("ECONNRESET") ||
          error?.message?.includes("ENOTFOUND");

        if (isTransientError) {
          // Transient errors are already logged in syncTokenDeposits, just continue
          return;
        }

        // Log non-transient errors (these are unexpected)
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
   * Uses the wallet's last_signature to only fetch NEW transactions (optimization)
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
    // OPTIMIZATION: Use 'until' to only fetch signatures NEWER than the last processed one
    // This dramatically reduces RPC calls for wallets with no new activity
    let signatures: ConfirmedSignatureInfo[] = [];
    try {
      const options: { limit: number; until?: string } = { limit };
      
      // If we have a last processed signature, only fetch newer ones
      // This prevents re-scanning the same transactions repeatedly
      if (wallet.last_signature && !this.isFirstRun) {
        options.until = wallet.last_signature;
      }
      
      signatures = await this.connection.getSignaturesForAddress(
        tokenAccountPublicKey,
        options
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

      // Handle Solana RPC errors gracefully
      // -32019: Failed to query long-term storage (transient RPC error)
      // ETIMEDOUT: Network timeout
      // These are transient errors that should be logged but not crash the listener
      const isTransientError =
        error?.code === -32019 ||
        error?.code === -32002 || // RPC server error
        error?.code === -32005 || // RPC server error
        error?.message?.includes("ETIMEDOUT") ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("Failed to query long-term storage") ||
        error?.message?.includes("ECONNRESET") ||
        error?.message?.includes("ENOTFOUND");

      if (isTransientError) {
        // Log but don't throw - allow processing to continue for other wallets
        console.warn(
          `[Deposits] Transient RPC error for wallet ${wallet.id} (${wallet.public_key}):`,
          error?.message || error
        );
        return; // Skip this wallet for this poll cycle
      }

      // For other errors, log and re-throw (they'll be caught by syncWallet's catch handler)
      throw error;
    }

    if (!signatures.length) {
      return; // No new transactions to process
    }

    // Check which signatures we've already processed (avoid duplicates)
    // This is a safety check - with 'until' we should only get new ones
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

    // OPTIMIZATION: Update the wallet's last_signature to the most recent one
    // This ensures next poll only fetches newer signatures
    // signatures[0] is the newest (getSignaturesForAddress returns newest first)
    if (signatures.length > 0) {
      const newestSignature = signatures[0];
      await WalletModel.updateLastSignature(
        wallet.id,
        newestSignature.signature,
        newestSignature.slot
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
    let tx: AnyTransactionResponse | null = null;
    try {
      tx = await this.connection.getTransaction(signatureInfo.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0, // Support versioned transactions
      });
    } catch (error: any) {
      // Handle transient RPC errors gracefully
      const isTransientError =
        error?.code === -32019 ||
        error?.code === -32002 ||
        error?.code === -32005 ||
        error?.message?.includes("ETIMEDOUT") ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("Failed to query long-term storage") ||
        error?.message?.includes("ECONNRESET") ||
        error?.message?.includes("ENOTFOUND");

      if (isTransientError) {
        // Log but continue processing other signatures
        console.warn(
          `[Deposits] Transient RPC error fetching transaction ${signatureInfo.signature}:`,
          error?.message || error
        );
        return; // Skip this transaction
      }

      // For other errors, log and skip (don't crash the entire sync)
      console.error(
        `[Deposits] Error fetching transaction ${signatureInfo.signature}:`,
        error
      );
      return;
    }

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

    // SECURITY FIX: Use transaction to ensure atomicity
    // Both deposit recording and balance update happen atomically
    const { withTransaction } = await import("../utils/transaction");
    let recorded: any;

    await withTransaction(async (client) => {
      // SECURITY FIX (CVE-006): Per-wallet rate limiting (10 deposits per hour)
      const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
      const recentDepositsResult = await client.query(
        `SELECT COUNT(*) as count FROM wallet_deposits 
         WHERE wallet_id = $1 AND created_at >= $2`,
        [wallet.id, oneHourAgo]
      );
      const recentDepositCount = parseInt(
        recentDepositsResult.rows[0]?.count || "0",
        10
      );
      const MAX_DEPOSITS_PER_HOUR = 10;

      if (recentDepositCount >= MAX_DEPOSITS_PER_HOUR) {
        console.warn(
          `[Deposits] Rate limit exceeded for wallet ${wallet.id}: ${recentDepositCount} deposits in last hour`
        );
        return; // Skip this deposit, rate limit exceeded
      }

      // Check if deposit already processed (with lock to prevent race conditions)
      const existingDeposit = await client.query(
        `SELECT id FROM wallet_deposits WHERE signature = $1 FOR UPDATE`,
        [signatureInfo.signature]
      );

      if (existingDeposit.rows.length > 0) {
        // Deposit already processed, skip
        console.log(
          `[Deposits] ⚠️  Deposit ${signatureInfo.signature} already processed, skipping`
        );
        return;
      }

      // SECURITY FIX: Record deposit AND update balance atomically
      // Both operations in same transaction - if either fails, both roll back
      const depositResult = await client.query(
        `INSERT INTO wallet_deposits (
          wallet_id, user_id, signature, slot, block_time,
          amount, token_symbol, source, status, raw,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (signature) DO NOTHING
        RETURNING *`,
        [
          wallet.id,
          wallet.user_id,
          signatureInfo.signature,
          signatureInfo.slot,
          signatureInfo.blockTime || Math.floor(Date.now() / 1000),
          Number(tokenDeltaInfo.delta),
          "USDC",
          sourceAccount,
          signatureInfo.confirmationStatus || "confirmed",
          JSON.stringify(tx.meta),
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
        ]
      );

      // If deposit was already recorded (ON CONFLICT DO NOTHING), skip balance update
      if (depositResult.rows.length === 0) {
        console.log(
          `[Deposits] ⚠️  Deposit ${signatureInfo.signature} conflict (already exists), skipping`
        );
        return;
      }

      recorded = depositResult.rows[0];

      // SECURITY FIX: Update balance in same transaction
      // If this fails, entire transaction rolls back including deposit record
      await client.query(
        `UPDATE wallets
         SET balance_usdc = balance_usdc + $1,
             updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $2`,
        [Number(tokenDeltaInfo.delta), wallet.id]
      );
    });

    // If no deposit was recorded (already exists or transaction failed), return early
    if (!recorded) {
      return;
    }

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
    // SECURITY FIX: Enforce minimum deposit amount to prevent DoS attacks
    if (delta <= 0n) {
      return null; // Not a deposit (withdrawal or no change)
    }

    // Skip deposits below minimum amount (prevents micro-deposit DoS)
    if (delta < BigInt(MIN_DEPOSIT_AMOUNT)) {
      return null; // Deposit too small, skip it
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

  // Detect network from RPC URL and get appropriate USDC mint address
  const tokenMintAddress = getUsdcMintAddress(rpcUrl);
  const rpcUrlLower = rpcUrl.toLowerCase();
  // Determine network for logging
  const isMainnet =
    rpcUrlLower.includes("mainnet") ||
    (rpcUrlLower &&
      !rpcUrlLower.includes("devnet") &&
      !rpcUrlLower.includes("testnet") &&
      !rpcUrlLower.includes("localhost") &&
      !rpcUrlLower.includes("127.0.0.1"));
  const network = isMainnet ? "mainnet" : "devnet";

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

  console.log(`[Deposits] Connecting to Solana ${network}: ${rpcUrl}`);
  console.log(`[Deposits] USDC mint address: ${tokenMintAddress} (${network})`);

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
