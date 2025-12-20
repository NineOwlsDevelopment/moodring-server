import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import {
  generateEntitySecretCiphertext,
  generateEntitySecret,
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

(async () => {
  generateEntitySecret();

  const entitySecret = await question("Enter entitySecret: ");

  console.log("Generating ciphertext...");

  const ciphertext = await generateEntitySecretCiphertext({
    apiKey: process.env.CIRCLE_API_KEY as string,
    entitySecret: entitySecret.trim(),
  });

  console.log("\nGenerated ciphertext:");
  console.log(ciphertext);

  rl.close();
})();
