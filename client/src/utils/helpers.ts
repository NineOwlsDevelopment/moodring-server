import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import moodringIdl from "@/sdk/idls/moodring.json";
import { connection } from "@/config/solana";

class ReadOnlyWallet {
  public publicKey: PublicKey;

  constructor(pubkey: PublicKey) {
    this.publicKey = pubkey;
  }

  signTransaction<
    T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction
  >(tx: T): Promise<T> {
    return Promise.resolve(tx);
  }

  signAllTransactions<
    T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction
  >(txs: T[]): Promise<T[]> {
    return Promise.resolve(txs);
  }
}

/**
 * Simple function to load the program
 * Uses the configured IDL and PROGRAM_ID
 */
export const loadProgram = (): Program => {
  // Parse IDL from JSON string to ensure proper structure
  // This approach works better with Anchor's type resolution
  const idlString = JSON.stringify(moodringIdl);
  const parsedIdl = JSON.parse(idlString);

  const dummy = new PublicKey("11111111111111111111111111111111");
  const wallet = new ReadOnlyWallet(dummy);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  return new Program(parsedIdl, provider);
};
