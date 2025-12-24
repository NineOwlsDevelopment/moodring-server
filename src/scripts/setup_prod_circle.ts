import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

/**
 * Script to create production Circle hot wallet and wallet set
 *
 * Usage:
 *   CIRCLE_API_KEY_PROD=your_key CIRCLE_ENTITY_SECRET_PROD=your_secret ts-node scripts/setup_prod_circle.ts
 *
 * Or the script will prompt for credentials if not provided via env vars
 */
(async () => {
  try {
    console.log("🚀 Setting up production Circle hot wallet and wallet set\n");

    // Get production credentials
    let apiKey = process.env.CIRCLE_API_KEY_PROD;
    let entitySecret = process.env.CIRCLE_ENTITY_SECRET_PROD;

    if (!apiKey) {
      apiKey = await question("Enter production CIRCLE_API_KEY: ");
    }

    if (!entitySecret) {
      entitySecret = await question("Enter production CIRCLE_ENTITY_SECRET: ");
    }

    if (!apiKey || !entitySecret) {
      console.error("❌ CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required");
      process.exit(1);
    }

    // Initialize Circle client with production credentials
    console.log("\n📡 Initializing Circle client...");
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: apiKey.trim(),
      entitySecret: entitySecret.trim(),
    });

    // Step 1: Create or get wallet set
    console.log("\n📦 Creating wallet set...");
    let walletSetId: string;

    try {
      const walletSetResponse = await client.createWalletSet({
        name: "MoodRing Production",
      });

      walletSetId = walletSetResponse.data?.walletSet?.id || "";

      if (!walletSetId) {
        throw new Error("Failed to create wallet set: No ID returned");
      }

      console.log(`✅ Created wallet set: ${walletSetId}`);
    } catch (error: any) {
      // If wallet set already exists, try to list and get it
      if (
        error.response?.data?.code === "WALLET_SET_ALREADY_EXISTS" ||
        error.message?.includes("already exists")
      ) {
        console.log(
          "⚠️  Wallet set may already exist. Please check Circle dashboard or provide existing WALLET_SET_ID:"
        );
        const existingSetId = await question(
          "Enter existing WALLET_SET_ID (or press Enter to continue): "
        );
        if (existingSetId.trim()) {
          walletSetId = existingSetId.trim();
          console.log(`✅ Using existing wallet set: ${walletSetId}`);
        } else {
          throw new Error("Cannot proceed without wallet set ID");
        }
      } else {
        console.error(
          "❌ Failed to create wallet set:",
          error.response?.data || error.message
        );
        throw error;
      }
    }

    // Step 2: Create production hot wallet
    console.log("\n🔥 Creating production hot wallet...");

    const hotWalletResponse = await client.createWallets({
      accountType: "EOA",
      blockchains: ["SOL"], // Production uses SOL mainnet, not SOL-DEVNET
      count: 1,
      walletSetId: walletSetId,
    });

    const hotWallet = hotWalletResponse.data?.wallets?.[0];

    if (!hotWallet || !hotWallet.id || !hotWallet.address) {
      throw new Error("Failed to create hot wallet: Invalid response");
    }

    console.log(`✅ Created hot wallet:`);
    console.log(`   Wallet ID: ${hotWallet.id}`);
    console.log(`   Address: ${hotWallet.address}`);

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 PRODUCTION CIRCLE SETUP COMPLETE");
    console.log("=".repeat(60));
    console.log("\nAdd these to your production environment:\n");
    console.log(`CIRCLE_WALLET_SET_ID=${walletSetId}`);
    console.log(`CIRCLE_HOT_WALLET_ID=${hotWallet.id}`);
    console.log("\n" + "=".repeat(60));

    rl.close();
  } catch (error: any) {
    console.error("\n❌ Error setting up production Circle:", error.message);
    if (error.response?.data) {
      console.error(
        "Circle API error details:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    rl.close();
    process.exit(1);
  }
})();
