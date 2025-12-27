"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptKeypair = exports.encryptKeypair = exports.decryptSolanaPrivateKey = exports.encryptSolanaPrivateKey = void 0;
const web3_js_1 = require("@solana/web3.js");
const crypto_1 = __importDefault(require("crypto"));
const secrets_1 = require("./secrets");
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000; // Number of iterations for key derivation
// Lazy-loaded encryption password to ensure secrets manager is initialized first
let ENCRYPTION_PW = null;
/**
 * Get encryption password lazily (loads from secrets manager on first use)
 * This ensures secrets manager is initialized before password is accessed
 */
async function getEncryptionPassword() {
    if (!ENCRYPTION_PW) {
        ENCRYPTION_PW = await secrets_1.secretsManager.getRequiredSecret("ENCRYPTION_PW");
        if (!ENCRYPTION_PW) {
            throw new Error("ENCRYPTION_PW not available from secrets manager or environment");
        }
    }
    return ENCRYPTION_PW;
}
/**
 * Encrypts a Solana private key using AES-256-GCM encryption
 * @param privateKey - Solana private key as Uint8Array (64 bytes) or Keypair object
 * @returns Encrypted data as a hex string (format: salt:iv:tag:encryptedData)
 */
const encryptSolanaPrivateKey = async (privateKey) => {
    // Extract private key from Keypair if needed
    const keyBytes = privateKey instanceof web3_js_1.Keypair ? privateKey.secretKey : privateKey;
    if (keyBytes.length !== 64) {
        throw new Error("Invalid Solana private key length. Expected 64 bytes.");
    }
    // Get encryption password lazily
    const password = await getEncryptionPassword();
    // Generate random salt and IV
    const salt = crypto_1.default.randomBytes(SALT_LENGTH);
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    // Derive encryption key from password using PBKDF2
    const key = crypto_1.default.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
    // Create cipher
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
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
exports.encryptSolanaPrivateKey = encryptSolanaPrivateKey;
/**
 * Decrypts an encrypted Solana private key
 * @param encryptedData - Encrypted data as hex string (format: salt:iv:tag:encryptedData)
 * @returns Decrypted private key as Uint8Array (64 bytes)
 */
const decryptSolanaPrivateKey = async (encryptedData) => {
    try {
        // Parse hex string to buffer
        const data = Buffer.from(encryptedData, "hex");
        // Extract components
        const salt = data.subarray(0, SALT_LENGTH);
        const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        // Get encryption password lazily
        const password = await getEncryptionPassword();
        // Derive decryption key from password using PBKDF2
        const key = crypto_1.default.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
        // Create decipher
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
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
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
        throw new Error("Decryption failed: Unknown error");
    }
};
exports.decryptSolanaPrivateKey = decryptSolanaPrivateKey;
/**
 * Encrypts a Solana Keypair and returns the encrypted private key
 * @param keypair - Solana Keypair object
 * @returns Encrypted data as a hex string
 */
const encryptKeypair = async (keypair) => {
    return await (0, exports.encryptSolanaPrivateKey)(keypair);
};
exports.encryptKeypair = encryptKeypair;
/**
 * Decrypts an encrypted Solana private key and returns a Keypair
 * @param encryptedData - Encrypted data as hex string
 * @returns Solana Keypair object
 */
const decryptKeypair = async (encryptedData) => {
    const privateKey = await (0, exports.decryptSolanaPrivateKey)(encryptedData);
    return web3_js_1.Keypair.fromSecretKey(privateKey);
};
exports.decryptKeypair = decryptKeypair;
//# sourceMappingURL=cypher.js.map