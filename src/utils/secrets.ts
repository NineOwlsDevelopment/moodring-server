/**
 * Secrets Management Utility
 * Provides abstraction for secrets management with support for:
 * - Environment variables (development)
 * - AWS Secrets Manager (production)
 * - HashiCorp Vault (optional)
 */

interface SecretConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
}

class SecretsManager {
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get secret from cache or fetch it
   */
  private async getSecret(
    name: string,
    useCache: boolean = true
  ): Promise<string | null> {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(name);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    // Try environment variable first (for development/local)
    if (process.env[name]) {
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
      } catch (error) {
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
      } catch (error) {
        console.error(`[Secrets] Failed to fetch ${name} from Vault:`, error);
      }
    }

    return null;
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getFromAWSSecretsManager(
    secretName: string
  ): Promise<string | null> {
    try {
      // Lazy load AWS SDK to avoid dependency if not used
      // Check if AWS SDK is available
      let SecretsManagerClient: any;
      let GetSecretValueCommand: any;

      try {
        // Dynamic import with type assertion to handle optional dependency
        const awsSDK = await import(
          "@aws-sdk/client-secrets-manager" as any
        ).catch(() => null);
        if (!awsSDK) {
          console.warn(
            "[Secrets] AWS SDK not installed. Install @aws-sdk/client-secrets-manager to use AWS Secrets Manager."
          );
          return null;
        }
        SecretsManagerClient = awsSDK.SecretsManagerClient;
        GetSecretValueCommand = awsSDK.GetSecretValueCommand;
      } catch (importError) {
        console.warn(
          "[Secrets] AWS SDK not installed. Install @aws-sdk/client-secrets-manager to use AWS Secrets Manager."
        );
        return null;
      }

      const client = new SecretsManagerClient({
        region: process.env.AWS_REGION || "us-east-1",
      });

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await client.send(command);

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
        } catch {
          return response.SecretString;
        }
      }

      if (response.SecretBinary) {
        return Buffer.from(response.SecretBinary).toString("utf-8");
      }

      return null;
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.warn(
          `[Secrets] Secret ${secretName} not found in AWS Secrets Manager`
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Get secret from HashiCorp Vault
   */
  private async getFromVault(secretPath: string): Promise<string | null> {
    try {
      // This is a placeholder - implement Vault client based on your setup
      // Example using node-vault or @hashicorp/node-vault
      const vaultAddr = process.env.VAULT_ADDR;
      const vaultToken = process.env.VAULT_TOKEN;

      if (!vaultAddr || !vaultToken) {
        console.warn(
          "[Secrets] Vault not configured (missing VAULT_ADDR or VAULT_TOKEN)"
        );
        return null;
      }

      // Example implementation (you may need to install a Vault client library)
      // const vault = require("node-vault")({ endpoint: vaultAddr, token: vaultToken });
      // const result = await vault.read(secretPath);
      // return result.data?.value || null;

      console.warn("[Secrets] Vault integration not fully implemented");
      return null;
    } catch (error) {
      console.error(
        `[Secrets] Failed to fetch ${secretPath} from Vault:`,
        error
      );
      return null;
    }
  }

  /**
   * Get a required secret (throws if not found)
   */
  async getRequiredSecret(name: string): Promise<string> {
    const value = await this.getSecret(name);
    if (!value) {
      throw new Error(
        `Required secret '${name}' not found. Check environment variables or secrets manager configuration.`
      );
    }
    return value;
  }

  /**
   * Get an optional secret (returns null if not found)
   */
  async getOptionalSecret(name: string): Promise<string | null> {
    return this.getSecret(name);
  }

  /**
   * Initialize secrets - validate required secrets are available
   */
  async initialize(requiredSecrets: SecretConfig[]): Promise<void> {
    const missing: string[] = [];

    for (const config of requiredSecrets) {
      const value = await this.getSecret(config.name, false);
      if (!value && config.required) {
        if (config.defaultValue) {
          // Use default value
          this.cache.set(config.name, {
            value: config.defaultValue,
            expiresAt: Date.now() + this.cacheTTL,
          });
        } else {
          missing.push(config.name);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required secrets: ${missing.join(
          ", "
        )}. Please configure them in environment variables or secrets manager.`
      );
    }

    console.log(`[Secrets] Initialized ${requiredSecrets.length} secrets`);
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate a specific secret from cache
   */
  invalidateSecret(name: string): void {
    this.cache.delete(name);
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();

/**
 * Helper function to get secrets with fallback to environment variables
 * This maintains backward compatibility with existing code
 */
export async function getSecret(
  name: string,
  required: boolean = true
): Promise<string> {
  if (required) {
    return secretsManager.getRequiredSecret(name);
  }
  const value = await secretsManager.getOptionalSecret(name);
  if (!value) {
    throw new Error(`Secret '${name}' not found`);
  }
  return value;
}

/**
 * Initialize secrets on app startup
 */
export async function initializeSecrets(): Promise<void> {
  const requiredSecrets: SecretConfig[] = [
    { name: "JWT_SECRET", required: true },
    { name: "JWT_REFRESH_SECRET", required: true },
    { name: "ENCRYPTION_PW", required: true },
    { name: "DB_PASSWORD", required: true },
    { name: "CIRCLE_API_KEY", required: false },
    { name: "CIRCLE_ENTITY_SECRET", required: false },
    { name: "AWS_ACCESS_KEY_ID", required: false },
    { name: "AWS_SECRET_ACCESS_KEY", required: false },
  ];

  try {
    await secretsManager.initialize(requiredSecrets);
    console.log("✅ Secrets manager initialized");
  } catch (error: any) {
    console.error("❌ Secrets manager initialization failed:", error.message);
    // In development, we might want to continue with env vars
    if (process.env.NODE_ENV === "production") {
      throw error;
    } else {
      console.warn("⚠️  Continuing with environment variables only");
    }
  }
}
