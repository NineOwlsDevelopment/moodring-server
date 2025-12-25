import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import fs from "fs";
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
import { getUsdcMintAddress } from "../sdk/constants";
import bs58 from "bs58";

const RPC_URL = process.env.RPC_URL;

const loadKeypair = (): Keypair => {
  return Keypair.fromSecretKey(
    bs58.decode(process.env.ADMIN_WALLET_PRIVATE_KEY || "")
  );
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
  const recipientArg = "8d8dkwYvjrcYes4YgZMKXwPcQaW4dJ5kHtXriiq3L5JX";
  const amountArg = "1.01";
  const mintArg = getUsdcMintAddress(RPC_URL);

  if (!recipientArg || !amountArg || !mintArg || !RPC_URL) {
    console.error("Missing required arguments");
    console.error(
      "Usage: ts-node tests/send.ts <recipient> <amount> [mintAddress]"
    );
    console.error(
      "Example: ts-node tests/send.ts 8d8dkwYvjrcYes4YgZMKXwPcQaW4dJ5kHtXriiq3L5JX 1.01"
    );
    console.error("RPC_URL: " + RPC_URL);
    console.error("mintArg: " + mintArg);
    console.error("recipientArg: " + recipientArg);
    console.error("amountArg: " + amountArg);
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const sender = loadKeypair();
  const recipient = new PublicKey(recipientArg);
  const mint = new PublicKey(mintArg);

  console.log(mint.toBase58());

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
