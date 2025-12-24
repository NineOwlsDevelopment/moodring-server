import dotenv from "dotenv";
import path from "path";
import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import https from "https";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { UUID } from "crypto";
import { pool, initializePool } from "../db";
import { initializeSecrets } from "../utils/secrets";
import {
  MoodringModel,
  MoodringConfigInput,
  MoodringAdminModel,
} from "../models/Moodring";
import { CategoryModel } from "../models/Category";
import { ResolutionMode } from "../models/Resolution";
import { WalletModel } from "../models/Wallet";
import { getCircleWallet } from "../services/circleWallet";

dotenv.config({ path: path.join(__dirname, "../.env") });

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.API_URL || "http://localhost:5001/api";
const USDC_MINT = "2uXs1qMB6oAmFC8CH7MbnJWv8cxUmPqxkaV37CUPPzrz";
const DEFAULT_ADMIN_EMAIL = "admin@moodring.io";
const DEFAULT_ADMIN_USERNAME = "8ERoH2XCUQ1vfRUkrW1JBZhy3RVYwTBjgYQobUXQhxMR";

const DEFAULT_CATEGORIES = [
  "Politics",
  "Sports",
  "Culture",
  "Crypto",
  "Climate",
  "Economics",
  "Mentions",
  "Companies",
  "Financials",
  "Tech & Science",
  "Health",
  "World",
];

// Market templates
interface MarketTemplate {
  question: string;
  description: string;
  category: string;
  isBinary: boolean;
  options: string[];
  imageQuery: string;
  optionImageQueries: string[];
  expirationDays: number;
  initialLiquidity: number;
  resolutionMode?: ResolutionMode;
}

const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    question:
      "Will the Federal Reserve cut interest rates by at least 0.5% in the next 6 months?",
    description:
      "The Federal Reserve's monetary policy decisions significantly impact markets. Will the Fed cut rates by at least 50 basis points (0.5%) within the next 6 months?",
    category: "Economics",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "federal reserve interest rates",
    optionImageQueries: ["federal reserve"],
    expirationDays: 180,
    initialLiquidity: 100000000,
  },
  {
    question: "Will Nvidia's market cap exceed $5 trillion in the next year?",
    description:
      "Nvidia has seen explosive growth driven by AI demand. Will the company's market capitalization surpass $5 trillion within the next 12 months?",
    category: "Financials",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "nvidia stock market cap",
    optionImageQueries: ["nvidia stock"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Which party will control the US House of Representatives after the next election?",
    description:
      "Predict which political party will hold the majority in the US House of Representatives following the next congressional election.",
    category: "Politics",
    isBinary: false,
    options: ["Democrats", "Republicans", "Tie"],
    imageQuery: "us house of representatives capitol",
    optionImageQueries: [
      "democratic party",
      "republican party",
      "us capitol building",
    ],
    expirationDays: 730,
    initialLiquidity: 100000000,
  },
  {
    question: "Will OpenAI go public via IPO in the next year?",
    description:
      "OpenAI has been a subject of IPO speculation. Will the company complete an initial public offering within the next 12 months?",
    category: "Companies",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "openai ipo stock market",
    optionImageQueries: ["openai logo"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question: "Which tech company will IPO first in the next year?",
    description:
      "Several major tech companies are rumored to be preparing for IPOs. Predict which will go public first.",
    category: "Companies",
    isBinary: false,
    options: ["Stripe", "OpenAI", "Databricks", "xAI", "Other"],
    imageQuery: "tech ipo stock market",
    optionImageQueries: [
      "stripe payment",
      "openai",
      "databricks",
      "xai elon musk",
      "stock market ipo",
    ],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question: "Will the US men's soccer team win the 2026 World Cup?",
    description:
      "The 2026 FIFA World Cup will be hosted in North America. Will the United States men's national team win the tournament?",
    category: "Sports",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "usa soccer world cup 2026",
    optionImageQueries: ["usa soccer team"],
    expirationDays: 730,
    initialLiquidity: 100000000,
  },
  {
    question: "Which team will win the 2025-26 NBA Championship?",
    description: "Predict the winner of the 2025-26 NBA season championship.",
    category: "Sports",
    isBinary: false,
    options: [
      "Boston Celtics",
      "Denver Nuggets",
      "Milwaukee Bucks",
      "Phoenix Suns",
      "Other",
    ],
    imageQuery: "nba championship basketball",
    optionImageQueries: [
      "boston celtics",
      "denver nuggets",
      "milwaukee bucks",
      "phoenix suns",
      "nba trophy",
    ],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will global average temperature increase by more than 1.5°C above pre-industrial levels in 2025?",
    description:
      "Climate scientists monitor global temperature increases relative to pre-industrial levels. Will 2025 see an average temperature increase exceeding 1.5°C?",
    category: "Climate",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "global warming climate change temperature",
    optionImageQueries: ["climate change"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will there be a major breakthrough in quantum computing in the next year?",
    description:
      "Quantum computing research continues to advance. Will there be a significant breakthrough (e.g., error correction milestone, new qubit record) announced within the next 12 months?",
    category: "Tech & Science",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "quantum computing technology",
    optionImageQueries: ["quantum computer"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Which AI company will have the highest valuation by the end of next year?",
    description:
      "The AI sector is experiencing rapid growth and investment. Predict which company will have the highest valuation by the end of the next 12 months.",
    category: "Companies",
    isBinary: false,
    options: [
      "OpenAI",
      "Anthropic",
      "Google DeepMind",
      "Microsoft AI",
      "Other",
    ],
    imageQuery: "ai companies valuation",
    optionImageQueries: [
      "openai",
      "anthropic claude",
      "google deepmind",
      "microsoft ai",
      "artificial intelligence",
    ],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will Tesla stock price exceed $300 per share in the next 6 months?",
    description:
      "Tesla's stock has been volatile. Will the share price reach or exceed $300 within the next 6 months?",
    category: "Financials",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "tesla stock price",
    optionImageQueries: ["tesla stock"],
    expirationDays: 180,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will there be a major conflict escalation in the Middle East in the next 6 months?",
    description:
      "Geopolitical tensions in the Middle East remain high. Will there be a significant escalation of conflict (major military action, new war declaration) within the next 6 months?",
    category: "World",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "middle east conflict geopolitics",
    optionImageQueries: ["middle east map"],
    expirationDays: 180,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Which electric vehicle manufacturer will sell the most units globally in the next year?",
    description:
      "The EV market is highly competitive. Predict which manufacturer will lead in global electric vehicle sales over the next 12 months.",
    category: "Companies",
    isBinary: false,
    options: ["Tesla", "BYD", "Volkswagen", "BMW", "Other"],
    imageQuery: "electric vehicles ev market",
    optionImageQueries: [
      "tesla model",
      "byd electric car",
      "volkswagen ev",
      "bmw electric",
      "electric car",
    ],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question: "Will the S&P 500 close above 6,000 points in the next year?",
    description:
      "The S&P 500 index reflects overall US stock market performance. Will it close at or above 6,000 points at any point within the next 12 months?",
    category: "Financials",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "s&p 500 stock market index",
    optionImageQueries: ["stock market chart"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will a new COVID-19 variant cause major restrictions in the next year?",
    description:
      "Public health officials monitor for new variants. Will a new COVID-19 variant lead to major restrictions (lockdowns, travel bans) being implemented in major countries within the next 12 months?",
    category: "Health",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "covid 19 variant health",
    optionImageQueries: ["covid virus"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Which social media platform will have the most monthly active users in the next year?",
    description:
      "Social media platforms compete for user attention. Predict which will lead in monthly active users over the next 12 months.",
    category: "Tech & Science",
    isBinary: false,
    options: ["TikTok", "Instagram", "Facebook", "X (Twitter)", "Other"],
    imageQuery: "social media platforms",
    optionImageQueries: [
      "tiktok app",
      "instagram logo",
      "facebook logo",
      "twitter x logo",
      "social media",
    ],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will Bitcoin reach a new all-time high above $100,000 in the next year?",
    description:
      "Bitcoin's price has been volatile. Will it reach a new all-time high exceeding $100,000 within the next 12 months?",
    category: "Crypto",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "bitcoin price cryptocurrency",
    optionImageQueries: ["bitcoin"],
    expirationDays: 365,
    initialLiquidity: 100000000,
  },
  {
    question:
      "Will there be a successful manned mission to Mars announced in the next 5 years?",
    description:
      "Space agencies and private companies are planning Mars missions. Will a successful manned mission to Mars be officially announced (with launch date) within the next 5 years?",
    category: "Tech & Science",
    isBinary: true,
    options: ["Yes"],
    imageQuery: "mars mission spacex nasa",
    optionImageQueries: ["mars mission"],
    expirationDays: 1825,
    initialLiquidity: 100000000,
  },
  {
    question: "Which country will host the 2030 Winter Olympics?",
    description:
      "The International Olympic Committee will select the host for the 2030 Winter Olympics. Predict which country will be chosen.",
    category: "Sports",
    isBinary: false,
    options: ["Switzerland", "France", "Sweden", "Canada", "Other"],
    imageQuery: "winter olympics 2030",
    optionImageQueries: [
      "switzerland mountains",
      "france alps",
      "sweden winter",
      "canada winter olympics",
      "olympic rings",
    ],
    expirationDays: 1095,
    initialLiquidity: 100000000,
  },
];

interface SeedConfig {
  adminEmail: string;
  adminUsername: string;
  baseMint: string;
  baseDecimals: number;
  marketCreationFee: number;
  lpFeeRate: number;
  protocolFeeRate: number;
  creatorFeeRate: number;
}

interface MarketCreationResult {
  marketId: string;
  question: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// MOODRING CONFIGURATION SEEDING
// ============================================================================

function getConfig(): SeedConfig {
  return {
    adminEmail: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    adminUsername:
      process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME.toLowerCase().trim(),
    baseMint: USDC_MINT,
    baseDecimals: 6,
    marketCreationFee: Number(5 * 10 ** 6),
    lpFeeRate: Number(100),
    protocolFeeRate: Number(50),
    creatorFeeRate: Number(50),
  };
}

async function getOrCreateAdminUser(
  email: string,
  username: string
): Promise<string> {
  console.log(`📝 Creating initial admin user with wallet authentication...`);
  console.log(`   Email:    ${email}`);
  console.log(`   Username: ${username}`);

  // Generate or use admin keypair
  let keypair: Keypair;
  const adminPrivateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;

  if (adminPrivateKey) {
    try {
      if (adminPrivateKey.length === 88 || adminPrivateKey.length === 87) {
        const secretKey = bs58.decode(adminPrivateKey);

        keypair = Keypair.fromSecretKey(secretKey);
      } else if (adminPrivateKey.startsWith("[")) {
        const secretKey = new Uint8Array(JSON.parse(adminPrivateKey));

        keypair = Keypair.fromSecretKey(secretKey);
      } else {
        const secretKey = bs58.decode(adminPrivateKey);

        keypair = Keypair.fromSecretKey(secretKey);
      }
      console.log(
        `   Using provided admin wallet: ${keypair.publicKey.toBase58()}`
      );
    } catch (error) {
      throw new Error(
        `Failed to parse ADMIN_WALLET_PRIVATE_KEY: ${
          error instanceof Error ? error.message : "Invalid format"
        }`
      );
    }
  } else {
    throw new Error("Failed to parse ADMIN_WALLET_PRIVATE_KEY");
  }

  const walletAddress = keypair.publicKey.toBase58();

  // Create axios instance for API calls
  const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  try {
    // Step 1: Request nonce from backend
    console.log(`   📝 Requesting nonce from backend (${API_BASE_URL})...`);
    let nonceResponse;

    try {
      nonceResponse = await api.post("/auth/wallet/nonce", {
        wallet_address: walletAddress,
      });
    } catch (error: any) {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        throw new Error(
          `Cannot connect to API server at ${API_BASE_URL}. ` +
            `Make sure the server is running and API_URL is set correctly.`
        );
      }
      throw error;
    }

    const { nonce, message } = nonceResponse.data;
    if (!nonce || !message) {
      throw new Error("Failed to get nonce from backend - invalid response");
    }

    console.log(`   ✅ Nonce received, signing message...`);

    // Step 2: Sign the message with the keypair
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);

    console.log(`   ✅ Message signed, authenticating with backend...`);

    // Step 3: Authenticate with wallet (this will create the user if it doesn't exist)
    const authResponse = await api.post("/auth/wallet/authenticate", {
      wallet_address: walletAddress,
      message,
      signature: signatureBase58,
      nonce,
    });

    if (authResponse.status !== 200 && authResponse.status !== 201) {
      throw new Error(
        `Authentication failed: ${authResponse.data?.error || "Unknown error"}`
      );
    }

    const userId = authResponse.data.user?.id;
    if (!userId) {
      throw new Error("No user ID returned from authentication");
    }

    console.log(`✅ Created admin user via wallet authentication: ${userId}`);
    console.log(`   Wallet: ${walletAddress}\n`);
    return userId;
  } catch (error: any) {
    console.error(`❌ Failed to create admin user via wallet authentication:`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(
        `   Response: ${JSON.stringify(error.response.data, null, 2)}`
      );
    } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      console.error(`   Connection error: ${error.message}`);
      console.error(
        `   💡 Make sure the API server is running at ${API_BASE_URL}`
      );
    } else {
      console.error(`   Error: ${error.message}`);
    }
    throw new Error(
      `Failed to create admin user: ${error.message || "Unknown error"}`
    );
  }
}

async function updateAdminWalletBalance(
  adminUserId: string,
  baseDecimals: number
): Promise<void> {
  console.log("\n💰 Updating admin wallet balance...");
  const adminWallet = await WalletModel.findByUserId(adminUserId);
  if (adminWallet) {
    // 1 million USDC = 1,000,000 * 10^6 micro-units = 1,000,000,000,000
    const oneMillionUSDC = 1_000_000 * Math.pow(10, baseDecimals);
    await WalletModel.updateBalances(adminWallet.id, {
      balance_usdc: oneMillionUSDC,
    });
    console.log(
      `✅ Updated admin wallet balance_usdc to ${oneMillionUSDC} (${(
        oneMillionUSDC / Math.pow(10, baseDecimals)
      ).toLocaleString()} USDC)`
    );
  } else {
    // Create Circle wallet for admin if it doesn't exist
    console.log("📝 Creating Circle wallet for admin user...");
    const circleWallet = getCircleWallet();
    if (!circleWallet.isAvailable()) {
      throw new Error("Circle wallet service is not available for seeding");
    }
    const { walletId, address } = await circleWallet.createUserWallet(
      adminUserId as string
    );
    await WalletModel.create({
      user_id: adminUserId as UUID,
      circle_wallet_id: walletId,
      public_key: address,
    });
    // Update balance after creation
    const newWallet = await WalletModel.findByUserId(adminUserId);
    if (newWallet) {
      const oneMillionUSDC = 1_000_000 * Math.pow(10, baseDecimals);
      await WalletModel.updateBalances(newWallet.id, {
        balance_usdc: oneMillionUSDC,
      });
      console.log(
        `✅ Created admin wallet and set balance_usdc to ${oneMillionUSDC} (${(
          oneMillionUSDC / Math.pow(10, baseDecimals)
        ).toLocaleString()} USDC)`
      );
    }
  }
}

async function seedMoodringConfig(): Promise<void> {
  const config = getConfig();
  console.log("🔧 Initializing Moodring configuration...\n");

  const existing = await MoodringModel.get();
  if (existing) {
    console.log("⚠️  Moodring config already exists:");
    const admins = await MoodringAdminModel.getAdminUserIds();
    console.log("─".repeat(50));
    console.log(`   ID:                 ${existing.id}`);
    console.log(`   Admins:             ${admins.join(", ") || "(none)"}`);
    console.log(`   Base Mint:          ${existing.base_mint}`);
    console.log(`   Base Decimals:      ${existing.base_decimals}`);
    console.log(`   Market Creation Fee: ${existing.market_creation_fee}`);
    console.log(`   LP Fee Rate:        ${existing.lp_fee_rate} bps`);
    console.log(`   Protocol Fee Rate:  ${existing.protocol_fee_rate} bps`);
    console.log(`   Creator Fee Rate:   ${existing.creator_fee_rate} bps`);
    console.log("─".repeat(50));
    console.log("\n💡 To update, use MoodringModel.update() or the admin API.");

    const adminUserId = await getOrCreateAdminUser(
      config.adminEmail,
      config.adminUsername
    );
    await updateAdminWalletBalance(adminUserId, config.baseDecimals);
    return;
  }

  const adminUserId = await getOrCreateAdminUser(
    config.adminEmail,
    config.adminUsername
  );

  // Update admin wallet balance to 1 million USDC before creating wallets
  await updateAdminWalletBalance(adminUserId, config.baseDecimals);

  const input: MoodringConfigInput = {
    base_mint: config.baseMint,
    base_decimals: config.baseDecimals,
    market_creation_fee: config.marketCreationFee,
    lp_fee_rate: config.lpFeeRate,
    protocol_fee_rate: config.protocolFeeRate,
    creator_fee_rate: config.creatorFeeRate,
    pause_trading: false,
    maintenance_mode: false,
    allow_user_registration: true,
    allow_market_creation: true,
    allow_trading: true,
    allow_withdrawals: true,
    allow_deposits: true,
    min_trade_amount: 1000000, // 1 USDC
    max_trade_amount: 25000000000, // 25,000 USDC
    max_position_per_market: 25000000000, // 25,000 USDC
    max_daily_user_volume: 100000000000, // 100,000 USDC
    max_markets_per_user: 50000,
    max_open_markets_per_user: 50000,
    min_market_duration_hours: 24,
    max_market_duration_days: 365 * 5,
    max_market_options: 10,
    auto_resolve_markets: false,
    resolution_oracle_enabled: true,
    authority_resolution_enabled: true,
    opinion_resolution_enabled: false,
    min_initial_liquidity: 100000000, // 100 USDC
    max_market_volatility_threshold: 5000, // 50%
    suspicious_trade_threshold: 1000000000, // 1,000 USDC
    circuit_breaker_threshold: 100000000000, // 100,000 USDC
    default_dispute_period_hours: 2,
    required_dispute_bond: 100000000, // 100 USDC
    enable_copy_trading: false,
    enable_social_feed: false,
    enable_live_rooms: false,
    enable_referrals: false,
    enable_notifications: true,
  };

  console.log("📝 Moodring configuration to be applied:");
  console.log("─".repeat(50));
  console.log(`   Admin User:         ${adminUserId}`);
  console.log(`   Base Mint:          ${input.base_mint}`);
  console.log(`   Base Decimals:      ${input.base_decimals}`);
  console.log(
    `   Market Creation Fee: ${input.market_creation_fee} (${(
      input.market_creation_fee! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   LP Fee Rate:        ${input.lp_fee_rate} bps (${(
      input.lp_fee_rate! / 100
    ).toFixed(2)}%)`
  );
  console.log(
    `   Protocol Fee Rate:  ${input.protocol_fee_rate} bps (${(
      input.protocol_fee_rate! / 100
    ).toFixed(2)}%)`
  );
  console.log(
    `   Creator Fee Rate:   ${input.creator_fee_rate} bps (${(
      input.creator_fee_rate! / 100
    ).toFixed(2)}%)`
  );
  console.log(`   Pause Trading:      ${input.pause_trading}`);
  console.log(`   Maintenance Mode:   ${input.maintenance_mode}`);
  console.log(`   Allow Registration: ${input.allow_user_registration}`);
  console.log(`   Allow Market Creation: ${input.allow_market_creation}`);
  console.log(`   Allow Trading:      ${input.allow_trading}`);
  console.log(`   Allow Withdrawals:  ${input.allow_withdrawals}`);
  console.log(`   Allow Deposits:     ${input.allow_deposits}`);
  console.log(
    `   Min Trade Amount:   ${input.min_trade_amount} (${(
      input.min_trade_amount! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   Max Trade Amount:   ${input.max_trade_amount} (${(
      input.max_trade_amount! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   Max Position/Market: ${input.max_position_per_market} (${(
      input.max_position_per_market! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   Max Daily Volume:   ${input.max_daily_user_volume} (${(
      input.max_daily_user_volume! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(`   Max Markets/User:   ${input.max_markets_per_user}`);
  console.log(`   Max Open Markets/User: ${input.max_open_markets_per_user}`);
  console.log(
    `   Min Duration:       ${input.min_market_duration_hours} hours`
  );
  console.log(`   Max Duration:       ${input.max_market_duration_days} days`);
  console.log(`   Max Market Options: ${input.max_market_options}`);
  console.log(`   Auto Resolve:       ${input.auto_resolve_markets}`);
  console.log(`   Oracle Resolution:  ${input.resolution_oracle_enabled}`);
  console.log(`   Authority Resolution: ${input.authority_resolution_enabled}`);
  console.log(`   Opinion Resolution: ${input.opinion_resolution_enabled}`);
  console.log(
    `   Min Initial Liquidity: ${input.min_initial_liquidity} (${(
      input.min_initial_liquidity! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   Volatility Threshold: ${input.max_market_volatility_threshold} bps (${(
      input.max_market_volatility_threshold! / 100
    ).toFixed(2)}%)`
  );
  console.log(
    `   Suspicious Threshold: ${input.suspicious_trade_threshold} (${(
      input.suspicious_trade_threshold! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   Circuit Breaker:    ${input.circuit_breaker_threshold} (${(
      input.circuit_breaker_threshold! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(
    `   Dispute Period:     ${input.default_dispute_period_hours} hours`
  );
  console.log(
    `   Dispute Bond:       ${input.required_dispute_bond} (${(
      input.required_dispute_bond! / Math.pow(10, input.base_decimals!)
    ).toFixed(2)} tokens)`
  );
  console.log(`   Copy Trading:       ${input.enable_copy_trading}`);
  console.log(`   Social Feed:        ${input.enable_social_feed}`);
  console.log(`   Live Rooms:         ${input.enable_live_rooms}`);
  console.log(`   Referrals:          ${input.enable_referrals}`);
  console.log(`   Notifications:      ${input.enable_notifications}`);
  console.log("─".repeat(50));

  try {
    const result = await MoodringModel.initialize(input);
    console.log("\n✅ Moodring configuration initialized successfully!");
    console.log(`   ID: ${result.id}`);
    console.log(`   Created: ${result.created_at}`);

    await MoodringAdminModel.addAdmin(adminUserId);
    console.log(`✅ Added admin to moodring_admins table`);
  } catch (error) {
    console.error("\n❌ Failed to initialize Moodring config:", error);
    throw error;
  }
}

// ============================================================================
// CATEGORY SEEDING
// ============================================================================

async function seedCategories(): Promise<void> {
  console.log("🌱 Seeding categories...\n");

  for (const name of DEFAULT_CATEGORIES) {
    const existing = await CategoryModel.findByName(name);
    if (!existing) {
      await CategoryModel.create({ name });
      console.log(`✅ Created category: ${name}`);
    } else {
      console.log(`⏭️  Category already exists: ${name}`);
    }
  }

  console.log("\n✅ Category seeding complete!");
}

// ============================================================================
// MARKET GENERATION
// ============================================================================

class MarketGenerator {
  api: AxiosInstance;
  accessToken: string | null = null;
  userId: string | null = null;
  cookies: string = ""; // Store cookies as a string for Cookie header

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    // Intercept responses to capture cookies
    this.api.interceptors.response.use(
      (response) => {
        const setCookieHeaders = response.headers["set-cookie"] || [];
        if (setCookieHeaders.length > 0) {
          // Extract all cookies and store them
          this.cookies = setCookieHeaders
            .map((cookie: string) => {
              // Extract cookie name and value (before first semicolon)
              const cookiePart = cookie.split(";")[0];
              return cookiePart;
            })
            .join("; ");
          console.log("🍪 Cookies captured and stored");
        }
        return response;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Intercept requests to add cookies
    this.api.interceptors.request.use(
      (config) => {
        if (this.cookies) {
          config.headers = config.headers || {};
          config.headers.Cookie = this.cookies;
        }
        // Also add Authorization header if we have a token
        if (this.accessToken && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  async authenticateWithWallet(privateKey: string): Promise<void> {
    try {
      let keypair: Keypair;
      try {
        if (privateKey.length === 88 || privateKey.length === 87) {
          const secretKey = bs58.decode(privateKey);
          keypair = Keypair.fromSecretKey(secretKey);
        } else if (privateKey.startsWith("[")) {
          const secretKey = new Uint8Array(JSON.parse(privateKey));
          keypair = Keypair.fromSecretKey(secretKey);
        } else {
          const secretKey = bs58.decode(privateKey);
          keypair = Keypair.fromSecretKey(secretKey);
        }
      } catch (error) {
        throw new Error(
          `Failed to parse private key: ${
            error instanceof Error ? error.message : "Invalid format"
          }`
        );
      }

      const walletAddress = keypair.publicKey.toBase58();
      console.log(`🔐 Authenticating with wallet: ${walletAddress}`);

      console.log("📝 Requesting nonce from backend...");
      let nonceResponse;
      try {
        nonceResponse = await this.api.post("/auth/wallet/nonce", {
          wallet_address: walletAddress,
        });
      } catch (error: any) {
        console.error(`❌ Failed to get nonce: ${error.message}`);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(
            `   Response: ${JSON.stringify(error.response.data, null, 2)}`
          );
        }
        throw new Error(`Nonce request failed: ${error.message}`);
      }

      const { nonce, message } = nonceResponse.data;
      if (!nonce || !message) {
        throw new Error("Failed to get nonce from backend - invalid response");
      }

      console.log("✅ Nonce received, signing message...");

      const messageBytes = new TextEncoder().encode(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signatureBase58 = bs58.encode(signature);

      console.log("✅ Message signed, authenticating...");

      let authResponse;
      try {
        authResponse = await this.api.post(
          "/auth/wallet/authenticate",
          {
            wallet_address: walletAddress,
            message,
            signature: signatureBase58,
            nonce,
          },
          {
            withCredentials: true,
          }
        );
      } catch (error: any) {
        console.error(`❌ Authentication request failed: ${error.message}`);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(
            `   Response: ${JSON.stringify(error.response.data, null, 2)}`
          );
        }
        throw error;
      }

      // Extract token from response body (if available) or cookies
      let accessToken: string | null = null;

      // First, check response body for accessToken
      if (authResponse.data?.accessToken) {
        accessToken = authResponse.data.accessToken;
        console.log("✅ Access token found in response body");
      } else {
        // Fallback: Extract token from cookies
        const setCookieHeaders = authResponse.headers["set-cookie"] || [];
        for (const cookie of setCookieHeaders) {
          if (cookie.includes("accessToken=")) {
            const match = cookie.match(/accessToken=([^;]+)/);
            if (match && match[1]) {
              accessToken = match[1];
              console.log("✅ Access token extracted from cookie header");
              break;
            }
          }
        }
      }

      if (accessToken) {
        this.accessToken = accessToken;
        this.setAuthHeader();
        console.log(
          "   Token will be used in Authorization header for API calls"
        );
      } else {
        console.log("⚠️  Could not extract token from response or cookies");
        console.log(
          "   Will rely on cookie-based authentication (cookies stored in interceptor)"
        );
      }

      let userResponse;
      try {
        userResponse = await this.api.get("/auth/me", {
          withCredentials: true,
        });
        this.userId = userResponse.data.user?.id;
        if (!this.userId) {
          throw new Error("No user ID returned from /auth/me endpoint");
        }
        console.log(`✅ Wallet authenticated for user: ${this.userId}`);
      } catch (error: any) {
        console.error(`❌ Failed to verify authentication: ${error.message}`);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(
            `   Response: ${JSON.stringify(error.response.data, null, 2)}`
          );
        }
        throw new Error(`Authentication verification failed: ${error.message}`);
      }

      // If we don't have an accessToken but we got user info, mark as authenticated
      // The API will use cookies for authentication
      if (!this.accessToken && this.userId) {
        console.log("✅ Using cookie-based authentication");
      }
    } catch (error: any) {
      console.error(
        "Wallet authentication error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async verifyOTP(email: string, otp: string): Promise<void> {
    try {
      const response = await this.api.post("/auth/magic-link/verify", {
        email,
        otp,
      });

      if (response.data.accessToken) {
        this.accessToken = response.data.accessToken;
        this.userId = response.data.user?.id;
        this.setAuthHeader();
        console.log(`✅ Authenticated as user: ${this.userId}`);
      } else {
        throw new Error("No access token received");
      }
    } catch (error: any) {
      console.error(
        "OTP verification error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  setAuthHeader(): void {
    if (this.accessToken) {
      this.api.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${this.accessToken}`;
    }
  }

  private async downloadImage(url: string, maxRedirects = 5): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const makeRequest = (currentUrl: string, redirectCount = 0) => {
        if (redirectCount > maxRedirects) {
          reject(new Error("Too many redirects"));
          return;
        }

        https
          .get(currentUrl, (response) => {
            if (
              response.statusCode &&
              [301, 302, 307, 308].includes(response.statusCode)
            ) {
              const location = response.headers.location;
              if (location) {
                const redirectUrl = location.startsWith("http")
                  ? location
                  : new URL(location, currentUrl).toString();
                makeRequest(redirectUrl, redirectCount + 1);
                return;
              }
            }

            if (response.statusCode !== 200) {
              reject(
                new Error(`Failed to download image: ${response.statusCode}`)
              );
              return;
            }

            const chunks: Buffer[] = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => resolve(Buffer.concat(chunks)));
            response.on("error", reject);
          })
          .on("error", reject);
      };

      makeRequest(url);
    });
  }

  private async getRandomImage(
    query: string,
    width = 800,
    height = 600
  ): Promise<Buffer> {
    try {
      const seed = this.hashString(query);
      const imageUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
      console.log(`  📥 Downloading image for: ${query}`);
      return await this.downloadImage(imageUrl);
    } catch (error: any) {
      console.warn(
        `  ⚠️  Failed to get image for "${query}": ${error.message}, using placeholder`
      );
      return await this.getPlaceholderImage(width, height);
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async getPlaceholderImage(
    width = 800,
    height = 600,
    color = "4F46E5"
  ): Promise<Buffer> {
    try {
      const url = `https://placehold.co/${width}x${height}/${color}/FFFFFF?text=Market`;
      return await this.downloadImage(url);
    } catch (error) {
      return this.generateSimpleImage(width, height, color);
    }
  }

  private generateSimpleImage(
    width: number,
    height: number,
    hexColor: string
  ): Buffer {
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);

    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 2;
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;

    const ihdrChunk = this.createPngChunk("IHDR", ihdrData);

    const rowSize = width * 3 + 1;
    const imageData = Buffer.alloc(height * rowSize);
    for (let y = 0; y < height; y++) {
      const offset = y * rowSize;
      imageData[offset] = 0;
      for (let x = 0; x < width; x++) {
        imageData[offset + 1 + x * 3] = r;
        imageData[offset + 2 + x * 3] = g;
        imageData[offset + 3 + x * 3] = b;
      }
    }

    const zlib = require("zlib");
    const compressed = zlib.deflateSync(imageData);
    const idatChunk = this.createPngChunk("IDAT", compressed);
    const iendChunk = this.createPngChunk("IEND", Buffer.alloc(0));

    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
  }

  private createPngChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const chunkData = Buffer.concat([typeBuffer, data]);
    const crc = this.crc32(chunkData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);

    return Buffer.concat([length, chunkData, crcBuffer]);
  }

  private crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    const table = this.generateCrcTable();

    for (let i = 0; i < buffer.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  private generateCrcTable(): number[] {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
      table[i] = crc;
    }
    return table;
  }

  private async getCategories(): Promise<Map<string, string>> {
    try {
      const response = await this.api.get("/market/categories");
      const categories = response.data.categories || [];
      const categoryMap = new Map<string, string>();
      categories.forEach((cat: any) => {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
        categoryMap.set(cat.name, cat.id);
      });
      return categoryMap;
    } catch (error) {
      console.warn("⚠️  Failed to fetch categories");
      return new Map();
    }
  }

  async createMarket(template: MarketTemplate): Promise<MarketCreationResult> {
    try {
      console.log(`\n📊 Creating market: "${template.question}"`);

      const marketImageBuffer = await this.getRandomImage(
        template.imageQuery,
        800,
        600
      );

      const expirationDate = new Date();
      expirationDate.setDate(
        expirationDate.getDate() + template.expirationDays
      );
      const expirationTimestamp = Math.floor(expirationDate.getTime() / 1000);

      const categories = await this.getCategories();
      const categoryId =
        categories.get(template.category) ||
        categories.get(template.category.toLowerCase());

      const formData = new FormData();
      formData.append("marketQuestion", template.question);
      formData.append("marketDescription", template.description);
      formData.append("marketExpirationDate", expirationTimestamp.toString());
      formData.append("isBinary", template.isBinary.toString());
      if (categoryId) {
        formData.append("categoryIds", JSON.stringify([categoryId]));
      }

      // Use resolution mode from template, or default to AUTHORITY
      const resolutionMode =
        template.resolutionMode || ResolutionMode.AUTHORITY;

      console.log(`  🔧 Resolution mode: ${resolutionMode}`);

      formData.append("resolutionMode", resolutionMode);

      formData.append("image", marketImageBuffer, {
        filename: "market.jpg",
        contentType: "image/jpeg",
      });

      const headers: any = {
        ...formData.getHeaders(),
      };

      // Authorization header will be added by interceptor if we have accessToken
      // Cookies will also be added by interceptor
      if (this.accessToken) {
        console.log("  🔑 Using Bearer token + cookie authentication");
      } else if (this.cookies) {
        console.log("  🍪 Using cookie-based authentication");
      }

      const response = await this.api.post("/market/create", formData, {
        headers,
        withCredentials: true,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const marketId = response.data.market;
      console.log(`  ✅ Market created: ${marketId}`);

      const optionIds: string[] = [];
      for (let i = 0; i < template.options.length; i++) {
        const optionLabel = template.options[i];
        const optionImageQuery = template.optionImageQueries[i] || optionLabel;

        console.log(`  📝 Creating option: "${optionLabel}"`);

        const optionImageBuffer = await this.getRandomImage(
          optionImageQuery,
          400,
          400
        );

        const optionFormData = new FormData();
        optionFormData.append("market", marketId);
        optionFormData.append("optionLabel", optionLabel);
        optionFormData.append("image", optionImageBuffer, {
          filename: "option.jpg",
          contentType: "image/jpeg",
        });

        try {
          const optionHeaders: any = {
            ...optionFormData.getHeaders(),
          };

          // Authorization and cookies will be added by interceptor

          const optionResponse = await this.api.post(
            "/market/option/create",
            optionFormData,
            {
              headers: optionHeaders,
              withCredentials: true,
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
            }
          );
          optionIds.push(optionResponse.data.option);
          console.log(`    ✅ Option created: ${optionResponse.data.option}`);
        } catch (error: any) {
          console.error(
            `    ❌ Failed to create option: ${
              error.response?.data?.error || error.message
            }`
          );
        }
      }

      if (template.initialLiquidity > 0) {
        console.log(
          `  💰 Initializing market with ${
            template.initialLiquidity / 1_000_000
          } USDC liquidity...`
        );
        try {
          // Authorization and cookies will be added by interceptor
          await this.api.post(
            "/market/initialize",
            {
              market: marketId,
              initialLiquidity: template.initialLiquidity,
            },
            {
              withCredentials: true,
            }
          );
          console.log(`  ✅ Market initialized with liquidity`);
        } catch (error: any) {
          console.error(
            `  ❌ Failed to initialize market: ${
              error.response?.data?.error || error.message
            }`
          );
          return {
            marketId,
            question: template.question,
            success: false,
            error: `Failed to initialize: ${
              error.response?.data?.error || error.message
            }`,
          };
        }
      }

      return {
        marketId,
        question: template.question,
        success: true,
      };
    } catch (error: any) {
      console.error(
        `  ❌ Failed to create market: ${
          error.response?.data?.error || error.message
        }`
      );
      return {
        marketId: "",
        question: template.question,
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async generateAllMarkets(
    count: number = 10
  ): Promise<MarketCreationResult[]> {
    if (!this.accessToken && !this.userId) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // If we have userId but no accessToken, we're using cookie-based auth
    // Make sure withCredentials is set for all requests
    if (!this.accessToken && this.userId) {
      console.log("📝 Using cookie-based authentication for API calls");
    }

    const results: MarketCreationResult[] = [];
    const resolutionModes = [
      ResolutionMode.ORACLE,
      ResolutionMode.AUTHORITY,
      ResolutionMode.OPINION,
    ];

    for (let i = 0; i < count; i++) {
      const templateIndex = i % MARKET_TEMPLATES.length;
      const baseTemplate = MARKET_TEMPLATES[templateIndex];

      // Cycle through all 3 resolution types
      const resolutionModeIndex = i % resolutionModes.length;
      const resolutionMode = resolutionModes[resolutionModeIndex];

      const template = {
        ...baseTemplate,
        question:
          i < MARKET_TEMPLATES.length
            ? baseTemplate.question
            : `${baseTemplate.question} (${
                Math.floor(i / MARKET_TEMPLATES.length) + 1
              })`,
        initialLiquidity: 100000000,
        resolutionMode: resolutionMode,
      };

      const result = await this.createMarket(template);
      results.push(result);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return results;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function seedComplete() {
  console.log("=".repeat(60));
  console.log("🌱 MOODRING COMPLETE SEEDING SCRIPT");
  console.log("=".repeat(60));
  console.log();

  try {
    // Initialize secrets manager and database pool
    console.log("🔧 Initializing secrets manager and database connection...");
    await initializeSecrets();
    await initializePool();
    console.log("✅ Initialization complete\n");

    // Step 1: Seed Moodring configuration
    console.log("📋 Step 1: Seeding Moodring configuration...");
    console.log("-".repeat(60));
    await seedMoodringConfig();
    console.log();

    // Step 2: Seed categories
    console.log("📋 Step 2: Seeding categories...");
    console.log("-".repeat(60));
    await seedCategories();
    console.log();

    // Step 3: Generate markets (default: enabled, set SKIP_MARKETS=true to disable)
    const shouldSkipMarkets =
      process.env.SKIP_MARKETS === "true" || process.env.SKIP_MARKETS === "1";
    const shouldGenerateMarkets =
      !shouldSkipMarkets &&
      (process.env.GENERATE_MARKETS === "true" ||
        process.env.GENERATE_MARKETS === "1" ||
        process.env.GENERATE_MARKETS === undefined); // Default to true
    const marketCount = parseInt(process.env.MARKET_COUNT || "10", 10);

    if (shouldGenerateMarkets) {
      console.log("📋 Step 3: Generating markets...");
      console.log("-".repeat(60));
      console.log(
        `💡 Generating ${marketCount} markets (set MARKET_COUNT env var to change)`
      );
      console.log();

      const generator = new MarketGenerator();
      const email = process.env.ADMIN_EMAIL || process.env.USER_EMAIL;
      const otp = process.env.OTP;

      // Try to authenticate - prioritize wallet authentication
      let authenticated = false;

      // Primary method: Wallet authentication (recommended for scripts)
      if (process.env.ADMIN_WALLET_PRIVATE_KEY) {
        try {
          console.log("🔐 Authenticating with wallet...");
          await generator.authenticateWithWallet(
            process.env.ADMIN_WALLET_PRIVATE_KEY
          );
          authenticated = !!generator.accessToken || !!generator.userId;
          if (authenticated) {
            console.log("✅ Wallet authentication successful!");
            console.log(`   User ID: ${generator.userId}`);
            if (generator.accessToken) {
              console.log(
                "   Access token obtained and will be used for API calls"
              );
            } else {
              console.log("   Using cookie-based authentication for API calls");
            }
          }
        } catch (error: any) {
          console.error(`❌ Wallet authentication failed: ${error.message}`);
          if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(
              `   Response: ${JSON.stringify(error.response.data, null, 2)}`
            );
            if (error.response.status === 500) {
              console.error(
                "\n💡 Tip: The wallet might not have a user account yet.\n" +
                  "   The backend should create a user account automatically during wallet auth.\n" +
                  "   If this persists, check:\n" +
                  "   1. Is the backend server running?\n" +
                  "   2. Is the database accessible?\n" +
                  "   3. Check backend logs for the actual error"
              );
            }
          }
          if (error.request) {
            console.error(`   Request URL: ${error.config?.url}`);
            console.error(`   Request method: ${error.config?.method}`);
            console.error(`   Base URL: ${API_BASE_URL}`);
          }
        }
      }

      // Fallback: OTP authentication
      if (!authenticated && email && otp) {
        try {
          console.log("🔐 Attempting OTP authentication...");
          await generator.verifyOTP(email, otp);
          authenticated = !!generator.accessToken;
          if (authenticated) {
            console.log("✅ OTP authentication successful!");
          }
        } catch (error: any) {
          console.error(`❌ OTP verification failed: ${error.message}`);
        }
      }

      // Error messages
      if (!authenticated && email && !otp) {
        console.log(
          "\n💡 Tip: Set OTP in .env or run with OTP environment variable"
        );
        console.log("Skipping market generation...");
      } else if (!authenticated) {
        console.error(
          "❌ Authentication required for market generation.\n" +
            "Set one of the following in .env:\n" +
            "  - ADMIN_WALLET_PRIVATE_KEY (recommended for scripts - signs message with wallet)\n" +
            "  - ADMIN_EMAIL or USER_EMAIL + OTP (for email-based auth)\n\n" +
            "Skipping market generation..."
        );
        console.log();
      }

      // Check if authenticated (either via token or cookie-based)
      const isAuthenticated = generator.accessToken || generator.userId;

      if (isAuthenticated) {
        console.log("🚀 Starting market generation...\n");
        const results = await generator.generateAllMarkets(marketCount);

        console.log("\n" + "=".repeat(60));
        console.log("📊 MARKET GENERATION SUMMARY");
        console.log("=".repeat(60));
        const successful = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);

        console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
        if (successful.length > 0) {
          successful.slice(0, 5).forEach((r) => {
            console.log(
              `   - ${r.question.substring(0, 50)}... (${r.marketId})`
            );
          });
          if (successful.length > 5) {
            console.log(`   ... and ${successful.length - 5} more`);
          }
        }

        if (failed.length > 0) {
          console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
          failed.slice(0, 3).forEach((r) => {
            console.log(`   - ${r.question.substring(0, 50)}...`);
            console.log(`     Error: ${r.error}`);
          });
          if (failed.length > 3) {
            console.log(`   ... and ${failed.length - 3} more failures`);
          }
        }
        console.log();
      }
    } else {
      console.log("📋 Step 3: Skipping market generation");
      console.log(
        "💡 Market generation is enabled by default. Set SKIP_MARKETS=true to disable."
      );
      console.log();
    }

    console.log("=".repeat(60));
    console.log("🎉 ALL SEEDING OPERATIONS COMPLETE!");
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error("\n❌ Fatal error during seeding:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedComplete()
    .then(() => {
      if (pool) {
        pool.end();
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      if (pool) {
        pool.end();
      }
      process.exit(1);
    });
}

export { seedComplete };
