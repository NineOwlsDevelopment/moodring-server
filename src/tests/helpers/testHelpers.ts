import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });
import axios, { AxiosInstance } from "axios";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const API_BASE = "http://localhost:5001/api";

// Global authentication queue to prevent concurrent authentications
let authQueue: Array<{
  resolve: (value: {
    cookie: string;
    userId: string;
    userWalletPublicKey: string;
  }) => void;
  reject: (error: Error) => void;
  wallet: Keypair;
}> = [];
let isAuthenticating = false;

// Process authentication queue
const processAuthQueue = async () => {
  if (isAuthenticating || authQueue.length === 0) {
    return;
  }

  isAuthenticating = true;
  const { wallet, resolve, reject } = authQueue.shift()!;

  try {
    const result = await performAuthentication(wallet);
    resolve(result);
  } catch (error: any) {
    reject(error);
  } finally {
    isAuthenticating = false;
    // Process next in queue
    if (authQueue.length > 0) {
      await sleep(500); // Delay between authentications to prevent rate limiting
      processAuthQueue();
    }
  }
};

// Perform actual authentication (without queue logic)
const performAuthentication = async (
  wallet: Keypair,
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<{ cookie: string; userId: string; userWalletPublicKey: string }> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add delay between retries (exponential backoff)
      if (attempt > 0) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(
          `Retrying authentication (attempt ${
            attempt + 1
          }/${maxRetries}) after ${delay}ms...`
        );
        await sleep(delay);
      }

      // Step 1: Request a nonce
      const nonceResponse = await axios.post(
        `${API_BASE}/auth/wallet/nonce`,
        {
          wallet_address: wallet.publicKey.toBase58(),
        },
        { withCredentials: true, validateStatus: () => true }
      );

      if (nonceResponse.status === 429) {
        // Rate limited, will retry
        lastError = new Error(
          `Rate limited on nonce request: ${nonceResponse.status}`
        );
        continue;
      }

      if (nonceResponse.status !== 200) {
        throw new Error(`Failed to get nonce: ${nonceResponse.status}`);
      }

      const { nonce, message } = nonceResponse.data;

      // Step 2: Sign the message (which includes the nonce)
      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, wallet.secretKey);
      const signatureBase58 = bs58.encode(signature);

      // Step 3: Authenticate with nonce, message, and signature
      const response = await axios.post(
        `${API_BASE}/auth/wallet/authenticate`,
        {
          wallet_address: wallet.publicKey.toBase58(),
          signature: signatureBase58,
          message,
          nonce,
        },
        { withCredentials: true, validateStatus: () => true }
      );

      if (response.status === 429) {
        // Rate limited, will retry
        lastError = new Error(
          `Rate limited on authenticate: ${response.status}`
        );
        continue;
      }

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Authentication failed: ${response.status} - ${JSON.stringify(
            response.data
          )}`
        );
      }

      // Extract cookies
      const setCookies = response.headers["set-cookie"] || [];
      const cookie = setCookies.map((c: string) => c.split(";")[0]).join("; ");

      return {
        cookie,
        userId: response.data.user.id,
        userWalletPublicKey: response.data.user.wallet.public_key,
      };
    } catch (error: any) {
      lastError = error;
      // If it's not a rate limit error, throw immediately
      if (error.response?.status !== 429) {
        throw error;
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Authentication failed after ${maxRetries} attempts: ${lastError?.message}`
  );
};

// Load wallet from environment variable
export const loadWallet = (): Keypair => {
  const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("ADMIN_WALLET_PRIVATE_KEY environment variable is not set");
  }

  // Handle both array format and base58 string format
  let secretKey: Uint8Array;
  try {
    // Try parsing as JSON array first
    secretKey = Uint8Array.from(JSON.parse(privateKey));
  } catch {
    // If that fails, try base58 decode
    secretKey = bs58.decode(privateKey);
  }

  return Keypair.fromSecretKey(secretKey);
};

// Authenticate with wallet and return cookies (with queue to prevent rate limiting)
export const authenticateWithWallet = async (
  wallet: Keypair
): Promise<{ cookie: string; userId: string; userWalletPublicKey: string }> => {
  return new Promise((resolve, reject) => {
    // Add to queue
    authQueue.push({ wallet, resolve, reject });
    // Process queue (will start if not already processing)
    processAuthQueue();
  });
};

// Create authenticated axios instance
export const createAuthenticatedClient = (cookie: string): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
      Cookie: cookie,
    },
    validateStatus: () => true, // Don't throw on any status code
  });

  return client;
};

// Helper to check if database is migrated
export const checkDatabaseMigrated = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_BASE}/market`, {
      validateStatus: () => true,
    });
    return response.status !== 500;
  } catch {
    return false;
  }
};

// Generate a unique test identifier
export const generateTestId = (): string => {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Sleep helper for async operations
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Add a small random delay to stagger concurrent authentications
export const staggerDelay = (): Promise<void> => {
  const delay = Math.random() * 500; // 0-500ms random delay
  return sleep(delay);
};
