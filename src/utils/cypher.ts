import { Keypair } from "@solana/web3.js";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000; // Number of iterations for key derivation

if (!process.env.ENCRYPTION_PW) {
  throw new Error("ENCRYPTION_PASSWORD environment variable is not defined");
}

const ENCRYPTION_PW = process.env.ENCRYPTION_PW;

/**
 * Encrypts a Solana private key using AES-256-GCM encryption
 * @param privateKey - Solana private key as Uint8Array (64 bytes) or Keypair object
 * @returns Encrypted data as a hex string (format: salt:iv:tag:encryptedData)
 */
export const encryptSolanaPrivateKey = (
  privateKey: Uint8Array | Keypair
): string => {
  // Extract private key from Keypair if needed
  const keyBytes =
    privateKey instanceof Keypair ? privateKey.secretKey : privateKey;

  if (keyBytes.length !== 64) {
    throw new Error("Invalid Solana private key length. Expected 64 bytes.");
  }

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive encryption key from password using PBKDF2
  const key = crypto.pbkdf2Sync(
    ENCRYPTION_PW,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha256"
  );

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the private key
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(keyBytes)),
    cipher.final(),
  ]);

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Combine salt, IV, tag, and encrypted data
  const result = Buffer.concat([salt, iv, tag, encrypted]);

  // Return as hex string for easy storage
  return result.toString("hex");
};

/**
 * Decrypts an encrypted Solana private key
 * @param encryptedData - Encrypted data as hex string (format: salt:iv:tag:encryptedData)
 * @returns Decrypted private key as Uint8Array (64 bytes)
 */
export const decryptSolanaPrivateKey = (encryptedData: string): Uint8Array => {
  try {
    // Parse hex string to buffer
    const data = Buffer.from(encryptedData, "hex");

    // Extract components
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive decryption key from password using PBKDF2
    const key = crypto.pbkdf2Sync(
      ENCRYPTION_PW,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      "sha256"
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt the private key
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Validate length
    if (decrypted.length !== 64) {
      throw new Error("Decrypted data has invalid length");
    }

    return new Uint8Array(decrypted);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw new Error("Decryption failed: Unknown error");
  }
};

/**
 * Encrypts a Solana Keypair and returns the encrypted private key
 * @param keypair - Solana Keypair object
 * @returns Encrypted data as a hex string
 */
export const encryptKeypair = (keypair: Keypair): string => {
  return encryptSolanaPrivateKey(keypair);
};

/**
 * Decrypts an encrypted Solana private key and returns a Keypair
 * @param encryptedData - Encrypted data as hex string
 * @returns Solana Keypair object
 */
export const decryptKeypair = (encryptedData: string): Keypair => {
  const privateKey = decryptSolanaPrivateKey(encryptedData);
  return Keypair.fromSecretKey(privateKey);
};
