import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  Connection,
  Transaction,
  Signer,
  ConfirmOptions,
  sendAndConfirmTransaction,
  TransactionSignature,
} from "@solana/web3.js";
import bs58 from "bs58";
import path from "path";

const adjectivesPath = path.resolve(__dirname, "../../words/adjectives.txt");
const nounsPath = path.resolve(__dirname, "../../words/nouns.txt");
const adjectivesArray = fs
  .readFileSync(adjectivesPath, "utf8")
  .split("\n")
  .filter(Boolean);

const nounsArray = fs
  .readFileSync(nounsPath, "utf8")
  .split("\n")
  .filter(Boolean);

export const generateRandomUsername = (): string => {
  // numbers between 1000 and 9999
  const numbers = Math.floor(1000 + Math.random() * 9000).toString();

  return `${
    adjectivesArray[Math.floor(Math.random() * adjectivesArray.length)]
  }-${nounsArray[Math.floor(Math.random() * nounsArray.length)]}-${numbers}`;
};

export const getProgram = (idl: string, connection: Connection) => {
  try {
    const parsedIdl: any = JSON.parse(idl);

    let program: any;
    const walletKeypair = Keypair.generate();
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    program = new Program(parsedIdl, provider);

    return program;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const sendAndConfirmTransactionSafe = async (
  connection: Connection,
  transaction: Transaction,
  signers: Signer[],
  options?: ConfirmOptions
): Promise<TransactionSignature> => {
  // 1. Assign blockhash if missing to ensure we can reproduce the signature
  if (!transaction.recentBlockhash) {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash(options?.commitment);
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
  }

  // 2. Sign to get signature upfront
  transaction.sign(...signers);
  // @ts-ignore: signature is present after signing
  const signature = transaction.signature;
  if (!signature) throw new Error("Transaction signing failed");

  const signatureBase58 = bs58.encode(signature);

  try {
    // 3. Attempt standard send and confirm
    return await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      options
    );
  } catch (error) {
    console.warn(
      `sendAndConfirmTransaction failed for ${signatureBase58}. Checking status...`,
      error
    );

    // 4. Check if it actually landed by polling signature status
    const start = Date.now();
    // Poll for up to 30 seconds
    while (Date.now() - start < 30000) {
      const status = await connection.getSignatureStatus(signatureBase58);

      if (
        status.value?.confirmationStatus &&
        (status.value.confirmationStatus === "confirmed" ||
          status.value.confirmationStatus === "finalized")
      ) {
        if (!status.value.err) {
          console.log(
            `Transaction ${signatureBase58} was actually successful despite error.`
          );
          return signatureBase58;
        } else {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(status.value.err)}`
          );
        }
      }

      // Wait 2 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // If we are here, we couldn't verify success
    throw error;
  }
};
