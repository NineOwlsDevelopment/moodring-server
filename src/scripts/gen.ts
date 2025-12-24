import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import {
  generateEntitySecretCiphertext,
  generateEntitySecret,
} from "@circle-fin/developer-controlled-wallets";
import readline from "readline";
import { initializeSecrets, secretsManager } from "../utils/secrets";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

(async () => {
  // Initialize secrets manager
  try {
    await initializeSecrets();
  } catch (error) {
    console.warn("⚠️  Secrets manager not available, using env vars:", error);
  }

  generateEntitySecret();

  const entitySecret = await question("Enter entitySecret: ");

  console.log("Generating ciphertext...");

  // Get CIRCLE_API_KEY from secrets manager
  const apiKey = await secretsManager.getRequiredSecret("CIRCLE_API_KEY");

  const ciphertext = await generateEntitySecretCiphertext({
    apiKey: apiKey,
    entitySecret: entitySecret.trim(),
  });

  console.log("\nGenerated ciphertext:");
  console.log(ciphertext);

  rl.close();
})();
