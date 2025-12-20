import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { USDC_MINT_ADDRESS } from "../sdk/constants";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const KEYPAIR_PATH = path.resolve(__dirname, "../local-keypair.json");

const loadKeypair = (): Keypair => {
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
};

const parseAmount = (value: string, decimals: number): bigint => {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error("Amount must be a positive number");
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount supports up to ${decimals} decimal places`);
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  const units = `${whole}${paddedFraction}`.replace(/^0+/, "") || "0";
  return BigInt(units);
};

const main = async () => {
  const recipientArg = "GYK25czxiEsEQYJfkgMEYe3UGzpY3YFPTXhc8JakQTKA";
  const amountArg = "60";
  const mintArg = USDC_MINT_ADDRESS;

  if (!recipientArg || !amountArg) {
    console.error(
      "Usage: ts-node tests/sendUSDC.ts <recipient> <amount> [mintAddress]"
    );
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const sender = loadKeypair();
  const recipient = new PublicKey(recipientArg);
  const mint = new PublicKey(mintArg ?? USDC_MINT_ADDRESS);

  const mintInfo = await getMint(connection, mint);
  const rawAmount = parseAmount(amountArg, mintInfo.decimals);

  if (rawAmount <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  const sourceAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    mint,
    sender.publicKey
  );

  const destinationAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    mint,
    recipient
  );

  const transaction = new Transaction().add(
    createTransferCheckedInstruction(
      sourceAccount.address,
      mint,
      destinationAccount.address,
      sender.publicKey,
      rawAmount,
      mintInfo.decimals
    )
  );

  transaction.feePayer = sender.publicKey;

  const signature = await sendAndConfirmTransaction(connection, transaction, [
    sender,
  ]);

  console.log("Signature:", signature);
  console.log(
    `Sent ${amountArg} tokens from ${sender.publicKey.toBase58()} to ${recipient.toBase58()}`
  );
};

main().catch((error) => {
  console.error("Transfer failed:", error);
  process.exit(1);
});
