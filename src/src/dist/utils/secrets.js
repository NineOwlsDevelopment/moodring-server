"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsManager = void 0;
exports.getSecret = getSecret;
exports.initializeSecrets = initializeSecrets;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const AWS_SECRET_NAME = "mood_store_secrets";
class SecretsManager {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes default
    }
    /**
     * Get secret from cache or fetch it
     */
    async getSecret(name, useCache = true) {
        // Check cache first
        if (useCache) {
            const cached = this.cache.get(name);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.value;
            }
        }
        // Try environment variable first (for development/local)
        if (process.env[name] && process.env.NODE_ENV !== "production") {
            const value = process.env[name];
            this.cache.set(name, {
                value,
                expiresAt: Date.now() + this.cacheTTL,
            });
            return value;
        }
        // Try AWS Secrets Manager if configured
        if (process.env.AWS_SECRETS_MANAGER_ENABLED === "true") {
            try {
                const value = await this.getFromAWSSecretsManager(name);
                if (value) {
                    this.cache.set(name, {
                        value,
                        expiresAt: Date.now() + this.cacheTTL,
                    });
                    return value;
                }
            }
            catch (error) {
                console.error(`[Secrets] Failed to fetch ${name} from AWS:`, error);
            }
        }
        // Try HashiCorp Vault if configured
        if (process.env.VAULT_ENABLED === "true") {
            try {
                const value = await this.getFromVault(name);
                if (value) {
                    this.cache.set(name, {
                        value,
                        expiresAt: Date.now() + this.cacheTTL,
                    });
                    return value;
                }
            }
            catch (error) {
                console.error(`[Secrets] Failed to fetch ${name} from Vault:`, error);
            }
        }
        return null;
    }
    /**
     * Get secret from AWS Secrets Manager
     */
    async getFromAWSSecretsManager(secretName) {
        try {
            // Lazy load AWS SDK to avoid dependency if not used
            // Check if AWS SDK is available
            const command = new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: secretName,
            });
            const client = new client_secrets_manager_1.SecretsManagerClient({
                region: "us-east-1",
            });
            let response;
            try {
                response = await client.send(new client_secrets_manager_1.GetSecretValueCommand({
                    SecretId: AWS_SECRET_NAME,
                    VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
                }));
            }
            catch (error) {
                // For a list of exceptions thrown, see
                // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
                throw error;
            }
            if (response.SecretString) {
                // If it's JSON, parse it
                try {
                    const parsed = JSON.parse(response.SecretString);
                    // If the secret name matches a key in the JSON, return that value
                    if (parsed[secretName]) {
                        return parsed[secretName];
                    }
                    // Otherwise return the whole JSON string
                    return response.SecretString;
                }
                catch {
                    return response.SecretString;
                }
            }
            if (response.SecretBinary) {
                return Buffer.from(response.SecretBinary).toString("utf-8");
            }
            return null;
        }
        catch (error) {
            if (error.name === "ResourceNotFoundException") {
                console.warn(`[Secrets] Secret ${secretName} not found in AWS Secrets Manager`);
                return null;
            }
            throw error;
        }
    }
    /**
     * Get secret from HashiCorp Vault
     */
    async getFromVault(secretPath) {
        try {
            // This is a placeholder - implement Vault client based on your setup
            // Example using node-vault or @hashicorp/node-vault
            const vaultAddr = process.env.VAULT_ADDR;
            const vaultToken = process.env.VAULT_TOKEN;
            if (!vaultAddr || !vaultToken) {
                console.warn("[Secrets] Vault not configured (missing VAULT_ADDR or VAULT_TOKEN)");
                return null;
            }
            // Example implementation (you may need to install a Vault client library)
            // const vault = require("node-vault")({ endpoint: vaultAddr, token: vaultToken });
            // const result = await vault.read(secretPath);
            // return result.data?.value || null;
            console.warn("[Secrets] Vault integration not fully implemented");
            return null;
        }
        catch (error) {
            console.error(`[Secrets] Failed to fetch ${secretPath} from Vault:`, error);
            return null;
        }
    }
    /**
     * Get a required secret (throws if not found)
     */
    async getRequiredSecret(name) {
        const value = await this.getSecret(name);
        if (!value) {
            throw new Error(`Required secret '${name}' not found. Check environment variables or secrets manager configuration.`);
        }
        return value;
    }
    /**
     * Get an optional secret (returns null if not found)
     */
    async getOptionalSecret(name) {
        return this.getSecret(name);
    }
    /**
     * Initialize secrets - validate required secrets are available
     */
    async initialize(requiredSecrets) {
        const missing = [];
        for (const config of requiredSecrets) {
            const value = await this.getSecret(config.name, false);
            if (!value && config.required) {
                if (config.defaultValue) {
                    // Use default value
                    this.cache.set(config.name, {
                        value: config.defaultValue,
                        expiresAt: Date.now() + this.cacheTTL,
                    });
                }
                else {
                    missing.push(config.name);
                }
            }
        }
        if (missing.length > 0) {
            throw new Error(`Missing required secrets: ${missing.join(", ")}. Please configure them in environment variables or secrets manager.`);
        }
        console.log(`[Secrets] Initialized ${requiredSecrets.length} secrets`);
    }
    /**
     * Clear cache (useful for testing or forced refresh)
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Invalidate a specific secret from cache
     */
    invalidateSecret(name) {
        this.cache.delete(name);
    }
    /**
     * Set cache TTL
     */
    setCacheTTL(ttlMs) {
        this.cacheTTL = ttlMs;
    }
}
// Export singleton instance
exports.secretsManager = new SecretsManager();
/**
 * Helper function to get secrets with fallback to environment variables
 * This maintains backward compatibility with existing code
 */
async function getSecret(name, required = true) {
    if (required) {
        return exports.secretsManager.getRequiredSecret(name);
    }
    const value = await exports.secretsManager.getOptionalSecret(name);
    if (!value) {
        throw new Error(`Secret '${name}' not found`);
    }
    return value;
}
/**
 * Initialize secrets on app startup
 */
async function initializeSecrets() {
    const requiredSecrets = [
        { name: "JWT_SECRET", required: true },
        { name: "JWT_REFRESH_SECRET", required: true },
        { name: "EMAIL_PASSWORD", required: true },
        { name: "DB_PASSWORD", required: true },
        { name: "ENCRYPTION_PW", required: true },
        { name: "CIRCLE_API_KEY", required: true },
        { name: "CIRCLE_ENTITY_SECRET", required: true },
        { name: "DB_HOST", required: true },
        { name: "SESSION_SECRET", required: true },
    ];
    try {
        await exports.secretsManager.initialize(requiredSecrets);
        console.log("✅ Secrets manager initialized");
    }
    catch (error) {
        console.error("❌ Secrets manager initialization failed:", error.message);
        // In development, we might want to continue with env vars
        if (process.env.NODE_ENV === "production") {
            throw error;
        }
        else {
            console.warn("⚠️  Continuing with environment variables only");
        }
    }
}
//# sourceMappingURL=secrets.js.map