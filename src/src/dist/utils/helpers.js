"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAndConfirmTransactionSafe = exports.getProgram = exports.generateRandomUsername = void 0;
const fs_1 = __importDefault(require("fs"));
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const path_1 = __importDefault(require("path"));
const adjectivesPath = path_1.default.resolve(__dirname, "../words/adjectives.txt");
const nounsPath = path_1.default.resolve(__dirname, "../words/nouns.txt");
const adjectivesArray = fs_1.default
    .readFileSync(adjectivesPath, "utf8")
    .split("\n")
    .filter(Boolean);
const nounsArray = fs_1.default
    .readFileSync(nounsPath, "utf8")
    .split("\n")
    .filter(Boolean);
const generateRandomUsername = () => {
    // numbers between 1000 and 9999
    const numbers = Math.floor(1000 + Math.random() * 9000).toString();
    return `${adjectivesArray[Math.floor(Math.random() * adjectivesArray.length)]}-${nounsArray[Math.floor(Math.random() * nounsArray.length)]}-${numbers}`;
};
exports.generateRandomUsername = generateRandomUsername;
const getProgram = (idl, connection) => {
    try {
        const parsedIdl = JSON.parse(idl);
        let program;
        const walletKeypair = web3_js_1.Keypair.generate();
        const wallet = new anchor.Wallet(walletKeypair);
        const provider = new anchor.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
        });
        program = new anchor_1.Program(parsedIdl, provider);
        return program;
    }
    catch (error) {
        console.error(error);
        throw error;
    }
};
exports.getProgram = getProgram;
const sendAndConfirmTransactionSafe = async (connection, transaction, signers, options) => {
    // 1. Assign blockhash if missing to ensure we can reproduce the signature
    if (!transaction.recentBlockhash) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(options?.commitment);
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
    }
    // 2. Sign to get signature upfront
    transaction.sign(...signers);
    // @ts-ignore: signature is present after signing
    const signature = transaction.signature;
    if (!signature)
        throw new Error("Transaction signing failed");
    const signatureBase58 = bs58_1.default.encode(signature);
    try {
        // 3. Attempt standard send and confirm
        return await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, signers, options);
    }
    catch (error) {
        console.warn(`sendAndConfirmTransaction failed for ${signatureBase58}. Checking status...`, error);
        // 4. Check if it actually landed by polling signature status
        const start = Date.now();
        // Poll for up to 30 seconds
        while (Date.now() - start < 30000) {
            const status = await connection.getSignatureStatus(signatureBase58);
            if (status.value?.confirmationStatus &&
                (status.value.confirmationStatus === "confirmed" ||
                    status.value.confirmationStatus === "finalized")) {
                if (!status.value.err) {
                    console.log(`Transaction ${signatureBase58} was actually successful despite error.`);
                    return signatureBase58;
                }
                else {
                    throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
                }
            }
            // Wait 2 seconds before next poll
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        // If we are here, we couldn't verify success
        throw error;
    }
};
exports.sendAndConfirmTransactionSafe = sendAndConfirmTransactionSafe;
//# sourceMappingURL=helpers.js.map