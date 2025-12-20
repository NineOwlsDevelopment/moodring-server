import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { PublicKey } from "@solana/web3.js";
import { USDC_MINT_ADDRESS } from "../sdk/constants";

/**
 * CircleWalletService manages wallets using Circle's Developer-Controlled Wallets API
 * This replaces the hot wallet system with Circle's secure, managed infrastructure
 */
class CircleWalletService {
  private client: CircleDeveloperControlledWalletsClient | null = null;
  private walletSetId: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the Circle wallet client
   */
  initialize(): boolean {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    let walletSetId = process.env.CIRCLE_WALLET_SET_ID;

    if (!apiKey || !entitySecret) {
      console.warn(
        "[CircleWallet] CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET not set. Circle wallet features disabled."
      );
      return false;
    }

    try {
      this.client = initiateDeveloperControlledWalletsClient({
        apiKey,
        entitySecret,
      });

      if (walletSetId) {
        this.walletSetId = walletSetId;
      }

      this.isInitialized = true;
      console.log("[CircleWallet] Initialized successfully");
      return true;
    } catch (error: any) {
      console.error("[CircleWallet] Failed to initialize:", error.message);
      return false;
    }
  }

  /**
   * Check if Circle wallet is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get or create a wallet set
   */
  async getOrCreateWalletSet(): Promise<string> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    if (this.walletSetId && this.walletSetId !== "") {
      return this.walletSetId;
    }

    try {
      const response = await this.client
        .createWalletSet({
          name: "MoodRing",
        })
        .catch((error: any) => {
          console.error("broke here, error: ", error.response?.data);
          throw new Error("Failed to create wallet set: " + error.message);
        });

      const walletSetId = response.data?.walletSet?.id;

      if (!walletSetId) {
        throw new Error("Failed to create wallet set: No ID returned");
      }

      // Store the wallet set ID for future use
      this.walletSetId = walletSetId;

      console.log(`[CircleWallet] Created wallet set: ${walletSetId}`);
      return walletSetId;
    } catch (error: any) {
      const errorDetails = error.response?.data || error.data || error.message;

      console.error(
        "[CircleWallet] Failed to create wallet set:",
        JSON.stringify(errorDetails, null, 2)
      );
      console.error("[CircleWallet] Full error:", error);

      // Provide more helpful error message
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to create wallet set: ${errorMessage}`);
    }
  }

  /**
   * Create a new wallet for a user
   * @param userId - User ID to associate with the wallet
   * @returns Wallet ID and address
   */
  async createUserWallet(
    userId: string
  ): Promise<{ walletId: string; address: string }> {
    try {
      if (!this.client) {
        throw new Error("Circle wallet client not initialized");
      }

      const walletSetId = await this.getOrCreateWalletSet();

      const response = await this.client.createWallets({
        accountType: "EOA",
        blockchains: ["SOL-DEVNET"],
        count: 1,
        walletSetId: walletSetId,
      });

      const wallet = response.data?.wallets?.[0];

      if (!wallet) {
        throw new Error("Failed to create user wallet");
      }

      console.log(
        `[CircleWallet] Created wallet for user ${userId}: ${wallet.id}`
      );

      return {
        walletId: wallet.id,
        address: wallet.address || "",
      };
    } catch (error: any) {
      // Log full error details for debugging
      const errorDetails = error.response?.data || error.data || error.message;
      console.error(
        "[CircleWallet] Failed to create user wallet:",
        JSON.stringify(errorDetails, null, 2)
      );
      // Provide more helpful error message
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to create user wallet: ${errorMessage}`);
    }
  }

  /**
   * Create a new hot wallet (for platform use)
   * @param name - Optional name/label for the hot wallet
   * @returns Wallet ID and address
   */
  async createHotWallet(
    name?: string
  ): Promise<{ walletId: string; address: string }> {
    try {
      if (!this.client) {
        throw new Error("Circle wallet client not initialized");
      }

      const walletSetId = await this.getOrCreateWalletSet();

      const response = await this.client.createWallets({
        accountType: "EOA",
        blockchains: ["SOL-DEVNET"],
        count: 1,
        walletSetId: walletSetId,
      });

      const wallet = response.data?.wallets?.[0];

      if (!wallet) {
        throw new Error("Failed to create hot wallet");
      }

      console.log(
        `[CircleWallet] Created hot wallet${name ? ` (${name})` : ""}: ${
          wallet.id
        }, address: ${wallet.address}`
      );

      return {
        walletId: wallet.id,
        address: wallet.address || "",
      };
    } catch (error: any) {
      // Log full error details for debugging
      const errorDetails = error.response?.data || error.data || error.message;
      console.error(
        "[CircleWallet] Failed to create hot wallet:",
        JSON.stringify(errorDetails, null, 2)
      );
      // Provide more helpful error message
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to create hot wallet: ${errorMessage}`);
    }
  }

  /**
   * Get wallet balance (USDC)
   * @param walletId - Circle wallet ID
   * @returns Balance in micro-USDC (6 decimals)
   */
  async getUsdcBalance(walletId: string): Promise<number> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    try {
      const tokenBalances = await this.client.getWalletTokenBalance({
        id: walletId,
      });

      const usdcToken = tokenBalances.data?.tokenBalances?.find(
        (token: any) => token.token?.tokenAddress === USDC_MINT_ADDRESS
      );

      // Circle returns amounts as strings, convert to number
      return Number(usdcToken?.amount) * 10 ** 6;
    } catch (error: any) {
      console.error(
        "[CircleWallet] Failed to get USDC balance:",
        error.message
      );
      return 0;
    }
  }

  /**
   * Get wallet balance (SOL)
   * @param walletId - Circle wallet ID
   * @returns Balance in lamports
   */
  async getSolBalance(walletId: string): Promise<number> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    try {
      const response = await this.client.getWallet({
        id: walletId,
      });

      const wallet = response.data?.wallet as any;
      const balances = wallet?.tokenBalances || [];
      const solBalance = balances.find(
        (b: any) => b.token?.symbol === "SOL" || !b.token
      );

      if (!solBalance) {
        return 0;
      }

      return parseInt(solBalance.amount || "0", 10);
    } catch (error: any) {
      console.error("[CircleWallet] Failed to get SOL balance:", error.message);
      return 0;
    }
  }

  /**
   * Send USDC from a Circle wallet to a destination address
   * @param walletId - Source wallet ID
   * @param destinationAddress - Recipient's Solana address
   * @param amount - Amount in micro-USDC (6 decimals)
   * @returns Transaction ID
   */
  async sendUsdc(
    walletId: string,
    destinationAddress: string,
    amount: number
  ): Promise<string> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    try {
      // First, we need to get the token ID for USDC on Solana
      // This would typically be stored in environment or fetched from Circle
      const usdcTokenId = process.env.CIRCLE_USDC_TOKEN_ID;

      if (!usdcTokenId) {
        throw new Error("CIRCLE_USDC_TOKEN_ID not configured");
      }

      // Validate destination address is a valid Solana public key
      try {
        new PublicKey(destinationAddress);
      } catch {
        throw new Error("Invalid destination address");
      }

      // Get hot wallet info to use as fee payer
      const hotWalletInfo = await this.getHotWalletInfo();
      const transactionParams: any = {
        amount: [amount.toString()],
        destinationAddress,
        tokenId: usdcTokenId,
        walletId,
        fee: {
          type: "level",
          config: { feeLevel: "MEDIUM" },
        },
      };

      // Set hot wallet as fee payer if available
      if (hotWalletInfo?.address) {
        transactionParams.feePayer = hotWalletInfo.address;
        console.log(
          `[CircleWallet] Using hot wallet ${hotWalletInfo.address} as fee payer`
        );
      }

      const response = await this.client.createTransaction(transactionParams);

      const transactionId = response.data?.id;
      if (!transactionId) {
        throw new Error("Failed to create transaction");
      }

      console.log(
        `[CircleWallet] Created USDC transfer transaction: ${transactionId}`
      );

      // Wait for transaction to be confirmed
      await this.waitForTransaction(transactionId);

      return transactionId;
    } catch (error: any) {
      console.error("[CircleWallet] Failed to send USDC:", error.message);
      throw error;
    }
  }

  /**
   * Send SOL from a Circle wallet to a destination address
   * @param walletId - Source wallet ID
   * @param destinationAddress - Recipient's Solana address
   * @param amount - Amount in lamports
   * @returns Transaction ID
   */
  async sendSol(
    walletId: string,
    destinationAddress: string,
    amount: number
  ): Promise<string> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    try {
      // Validate destination address
      try {
        new PublicKey(destinationAddress);
      } catch {
        throw new Error("Invalid destination address");
      }

      // For SOL, we use the native token (no tokenId needed, or use SOL token ID)
      const solTokenId = process.env.CIRCLE_SOL_TOKEN_ID || "native"; // Circle may use "native" for SOL

      // Get hot wallet info to use as fee payer
      const hotWalletInfo = await this.getHotWalletInfo();
      const transactionParams: any = {
        amount: [amount.toString()],
        destinationAddress,
        tokenId: solTokenId,
        walletId,
        fee: {
          type: "level",
          config: { feeLevel: "MEDIUM" },
        },
      };

      // Set hot wallet as fee payer if available
      if (hotWalletInfo?.address) {
        transactionParams.feePayer = hotWalletInfo.address;
        console.log(
          `[CircleWallet] Using hot wallet ${hotWalletInfo.address} as fee payer`
        );
      }

      const response = await this.client.createTransaction(transactionParams);

      const transactionId = response.data?.id;
      if (!transactionId) {
        throw new Error("Failed to create transaction");
      }

      console.log(
        `[CircleWallet] Created SOL transfer transaction: ${transactionId}`
      );

      await this.waitForTransaction(transactionId);

      return transactionId;
    } catch (error: any) {
      console.error("[CircleWallet] Failed to send SOL:", error.message);
      throw error;
    }
  }

  /**
   * Wait for a transaction to be confirmed
   * @param transactionId - Circle transaction ID
   * @param maxWaitMs - Maximum time to wait in milliseconds (default: 60 seconds)
   */
  private async waitForTransaction(
    transactionId: string,
    maxWaitMs: number = 60000
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await this.client.getTransaction({
          id: transactionId,
        });

        const state = response.data?.transaction?.state;

        if (state === "CLEARED" || state === "SENT") {
          console.log(`[CircleWallet] Transaction ${transactionId} confirmed`);
          return;
        }

        if (state === "DENIED" || state === "CANCELLED") {
          throw new Error(
            `Transaction ${transactionId} failed with state: ${state}`
          );
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error: any) {
        if (error.message.includes("failed")) {
          throw error;
        }
        // Continue polling on other errors
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(
      `Transaction ${transactionId} did not confirm within ${maxWaitMs}ms`
    );
  }

  /**
   * Get transaction status
   * @param transactionId - Circle transaction ID
   */
  async getTransactionStatus(transactionId: string): Promise<string> {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    try {
      const response = await this.client.getTransaction({
        id: transactionId,
      });

      return response.data?.transaction?.state || "UNKNOWN";
    } catch (error: any) {
      console.error(
        "[CircleWallet] Failed to get transaction status:",
        error.message
      );
      return "ERROR";
    }
  }

  /**
   * Get wallet details
   * @param walletId - Circle wallet ID
   */
  async getWallet(walletId: string) {
    if (!this.client) {
      throw new Error("Circle wallet client not initialized");
    }

    try {
      const response = await this.client.getWallet({
        id: walletId,
      });

      return response.data?.wallet;
    } catch (error: any) {
      console.error("[CircleWallet] Failed to get wallet:", error.message);
      throw error;
    }
  }

  /**
   * Get the Circle hot wallet ID and address
   * @returns Object with hot wallet ID and address, or null if not configured
   */
  async getHotWalletInfo(): Promise<{
    walletId: string;
    address: string;
  } | null> {
    const hotWalletId = process.env.CIRCLE_HOT_WALLET_ID;

    if (!hotWalletId) {
      console.warn(
        "[CircleWallet] CIRCLE_HOT_WALLET_ID not set. Hot wallet sweep disabled."
      );
      return null;
    }

    try {
      const wallet = await this.getWallet(hotWalletId);
      const address = (wallet as any)?.address;

      if (!address) {
        console.error(
          "[CircleWallet] Hot wallet address not found for wallet ID:",
          hotWalletId
        );
        return null;
      }

      return {
        walletId: hotWalletId,
        address: address,
      };
    } catch (error: any) {
      console.error(
        "[CircleWallet] Failed to get hot wallet info:",
        error.message
      );
      return null;
    }
  }

  /**
   * Sweep USDC from a user's Circle wallet to the hot wallet
   * @param userWalletId - User's Circle wallet ID
   * @param amount - Amount to sweep in micro-USDC (6 decimals)
   * @returns Circle transaction ID or null if failed
   */
  async sweepUsdcToHotWallet(
    userWalletId: string,
    amount: number
  ): Promise<string | null> {
    if (!this.client) {
      console.error(
        "[CircleWallet] Cannot sweep - Circle wallet not initialized"
      );
      return null;
    }

    if (amount <= 0) {
      console.warn("[CircleWallet] Cannot sweep zero or negative amount");
      return null;
    }

    try {
      // Get hot wallet info
      const hotWalletInfo = await this.getHotWalletInfo();
      if (!hotWalletInfo) {
        console.error(
          "[CircleWallet] Cannot sweep - hot wallet not configured"
        );
        return null;
      }

      // Check user wallet balance
      const userBalance = await this.getUsdcBalance(userWalletId);

      if (userBalance < amount) {
        console.warn(
          `[CircleWallet] Insufficient balance to sweep. Has: ${userBalance}, Need: ${amount}`
        );
        return null;
      }

      // Transfer USDC from user wallet to hot wallet
      const transactionId = await this.sendUsdc(
        userWalletId,
        hotWalletInfo.address,
        userBalance / 10 ** 6
      );

      console.log(
        `[CircleWallet] ✅ Swept${userBalance} USDC (${
          userBalance / 10 ** 6
        } USDC) from wallet ${userWalletId} to hot wallet ${
          hotWalletInfo.walletId
        } - tx: ${transactionId}`
      );

      return transactionId;
    } catch (error: any) {
      console.log(error.response);
      console.error(
        "[CircleWallet] Failed to sweep USDC to hot wallet:",
        error.message
      );
      return null;
    }
  }
}

// Singleton instance
const circleWalletService = new CircleWalletService();

export const initializeCircleWallet = (): boolean => {
  return circleWalletService.initialize();
};

export const getCircleWallet = (): CircleWalletService => {
  return circleWalletService;
};

export { CircleWalletService };
export default circleWalletService;
