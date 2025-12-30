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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketMeta = exports.getMarketOEmbed = exports.getWatchlistStatus = exports.getWatchlist = exports.removeFromWatchlist = exports.addToWatchlist = exports.estimateSellPayout = exports.estimateBuyCost = exports.getFairValue = exports.withdrawCreatorFee = exports.initializeMarket = exports.getMarket = exports.getMyMarkets = exports.getTrendingMarkets = exports.getFeaturedMarkets = exports.getMarkets = exports.deleteMarket = exports.deleteOption = exports.updateOption = exports.updateMarket = exports.createOption = exports.createMarket = exports.getMarketCreationFee = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const uuid_1 = require("uuid");
const db_1 = require("../db");
const Market_1 = require("../models/Market");
const Option_1 = require("../models/Option");
const Category_1 = require("../models/Category");
const metadata_1 = require("../utils/metadata");
const contentModeration_1 = require("../utils/contentModeration");
const Activity_1 = require("../models/Activity");
const PriceSnapshot_1 = require("../models/PriceSnapshot");
const Notification_1 = require("../models/Notification");
const lmsr_1 = require("../utils/lmsr");
const Moodring_1 = require("../models/Moodring");
const Watchlist_1 = require("../models/Watchlist");
const LpPosition_1 = require("../models/LpPosition");
const Resolution_1 = require("../models/Resolution");
const transaction_1 = require("../utils/transaction");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
// Default liquidity parameter for new markets
const DEFAULT_BASE_LIQUIDITY_PARAM = 100000;
// Character limits
const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LABEL_LENGTH = 100;
/**
 * Normalizes a market question to always end with a "?"
 * Removes any trailing punctuation and adds "?" if not present
 */
const normalizeQuestion = (question) => {
    let normalized = question.trim();
    // Remove trailing punctuation marks (period, comma, exclamation, semicolon, colon, etc.)
    normalized = normalized.replace(/[.,!;:]+$/, "");
    // Add "?" if it doesn't already end with one
    if (!normalized.endsWith("?")) {
        normalized += "?";
    }
    return normalized;
};
/**
 * @route GET /api/market/creation-fee
 * @desc Get the market creation fee
 * @access Public
 */
const getMarketCreationFee = async (req, res) => {
    try {
        const moodringConfig = await Moodring_1.MoodringModel.get();
        if (!moodringConfig) {
            return (0, errors_1.sendError)(res, 500, "Platform configuration not found");
        }
        const creationFee = Number(moodringConfig.market_creation_fee) || 0;
        const baseDecimals = Number(moodringConfig.base_decimals) || 6;
        return (0, errors_1.sendSuccess)(res, {
            creation_fee: creationFee,
            creation_fee_display: creationFee / Math.pow(10, baseDecimals), // Convert to display units
            currency: "USDC",
        });
    }
    catch (error) {
        console.error("Get market creation fee error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarketCreationFee = getMarketCreationFee;
/**
 * @route POST /api/market/create
 * @desc Create a new market (off-chain)
 * @access Private
 */
const createMarket = async (req, res) => {
    try {
        const userId = req.id;
        const { marketQuestion, marketDescription, marketExpirationDate, isBinary, categoryIds, resolutionMode, } = req.body;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Validate required fields
        const questionValidation = (0, validation_1.validateLength)(marketQuestion, "Market question", 12, MAX_QUESTION_LENGTH);
        if (!questionValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, questionValidation.error);
        }
        // Normalize the question to always end with "?"
        const normalizedQuestion = normalizeQuestion(marketQuestion);
        // Validate length after normalization
        if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
            return (0, errors_1.sendValidationError)(res, `Market question must be ${MAX_QUESTION_LENGTH} characters or less`);
        }
        // Check for banned words in question
        const questionBannedWordsCheck = (0, contentModeration_1.validateTextContent)(normalizedQuestion, "Market question");
        if (!questionBannedWordsCheck.isValid) {
            return (0, errors_1.sendValidationError)(res, questionBannedWordsCheck.error);
        }
        // Check for banned words in description if provided
        if (marketDescription && marketDescription.trim()) {
            const descriptionBannedWordsCheck = (0, contentModeration_1.validateTextContent)(marketDescription, "Market description");
            if (!descriptionBannedWordsCheck.isValid) {
                return (0, errors_1.sendValidationError)(res, descriptionBannedWordsCheck.error);
            }
        }
        if (!(0, validation_1.validateRequired)(marketExpirationDate, "Expiration date").isValid) {
            return (0, errors_1.sendValidationError)(res, "Expiration date is required");
        }
        const expirationTimestamp = Number(marketExpirationDate);
        const timestampValidation = (0, validation_1.validateNumber)(expirationTimestamp, "Expiration date", Math.floor(Date.now() / 1000) + 1, undefined);
        if (!timestampValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, timestampValidation.error || "Expiration date must be in the future");
        }
        if (!(0, validation_1.validateRequired)(resolutionMode, "Resolution mode").isValid) {
            return (0, errors_1.sendValidationError)(res, "Resolution mode is required");
        }
        const modeValidation = (0, validation_1.validateEnum)(resolutionMode, "Resolution mode", Object.values(Resolution_1.ResolutionMode));
        if (!modeValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, modeValidation.error);
        }
        // Bond amount is no longer required for market creation
        // Bond amounts are only required when disputing resolutions
        const bondAmount = 0;
        // Handle image upload before transaction (external service call)
        let imageUrl = "";
        if (req.file) {
            // Validate image (file type, size, and NSFW content)
            const validation = await (0, contentModeration_1.validateImage)(req.file.buffer, req.file.mimetype);
            if (!validation.isValid) {
                return (0, errors_1.sendValidationError)(res, validation.error || "Invalid image");
            }
            if (process.env.S3_BUCKET) {
                try {
                    imageUrl = await (0, metadata_1.uploadImageToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
                }
                catch (error) {
                    console.error("Failed to upload image to S3:", error);
                    return (0, errors_1.sendError)(res, 500, "Failed to upload image");
                }
            }
            else {
                console.warn("AWS S3 bucket not configured for image upload");
                return (0, errors_1.sendError)(res, 500, "Storage not configured");
            }
        }
        else {
            return (0, errors_1.sendValidationError)(res, "Image is required");
        }
        // Get moodring config to fetch market creation fee and admin controls
        const moodringConfig = await Moodring_1.MoodringModel.get();
        if (!moodringConfig) {
            return (0, errors_1.sendError)(res, 500, "Platform configuration not found");
        }
        // Check admin controls
        if (moodringConfig.maintenance_mode) {
            return (0, errors_1.sendError)(res, 503, "Platform is currently under maintenance. Market creation is temporarily disabled.");
        }
        if (!moodringConfig.allow_market_creation) {
            return (0, errors_1.sendError)(res, 403, "Market creation is currently disabled by administrators.");
        }
        if (!moodringConfig.allow_user_registration &&
            !(await Moodring_1.MoodringAdminModel.isAdmin(userId))) {
            return (0, errors_1.sendError)(res, 403, "New user registration is disabled. Only administrators can create markets.");
        }
        // Check user's market creation limits
        const userMarketsCount = await db_1.pool.query(`SELECT COUNT(*)::int as count FROM markets WHERE creator_id = $1`, [userId]);
        const totalMarketsCreated = userMarketsCount.rows[0]?.count || 0;
        if (totalMarketsCreated >= moodringConfig.max_markets_per_user) {
            return (0, errors_1.sendError)(res, 403, `You have reached the maximum number of markets (${moodringConfig.max_markets_per_user}) that can be created per user.`);
        }
        // Check open markets limit
        const openMarketsCount = await db_1.pool.query(`SELECT COUNT(*)::int as count FROM markets WHERE creator_id = $1 AND is_resolved = FALSE`, [userId]);
        const openMarkets = openMarketsCount.rows[0]?.count || 0;
        if (openMarkets >= moodringConfig.max_open_markets_per_user) {
            return (0, errors_1.sendError)(res, 403, `You have reached the maximum number of open markets (${moodringConfig.max_open_markets_per_user}) per user.`);
        }
        // Validate market duration
        const now = Math.floor(Date.now() / 1000);
        const marketDurationHours = (expirationTimestamp - now) / 3600;
        if (marketDurationHours < moodringConfig.min_market_duration_hours) {
            return (0, errors_1.sendValidationError)(res, `Market duration must be at least ${moodringConfig.min_market_duration_hours} hours.`);
        }
        if (marketDurationHours > moodringConfig.max_market_duration_days * 24) {
            return (0, errors_1.sendValidationError)(res, `Market duration cannot exceed ${moodringConfig.max_market_duration_days} days.`);
        }
        const marketCreationFee = Number(moodringConfig.market_creation_fee) || 0;
        const marketId = await (0, transaction_1.withTransaction)(async (client) => {
            // Get wallet with lock for balance check and fee deduction
            const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
            const wallet = walletResult.rows[0];
            if (!wallet) {
                throw new transaction_1.TransactionError(404, "Wallet not found");
            }
            // Check if user has sufficient balance for creation fee
            if (marketCreationFee > 0 &&
                Number(wallet.balance_usdc) < marketCreationFee) {
                throw new transaction_1.TransactionError(400, `Insufficient balance. Market creation fee is ${marketCreationFee / 1000} USDC, but you have ${Number(wallet.balance_usdc) / 1000} USDC`);
            }
            // Deduct market creation fee from wallet
            if (marketCreationFee > 0) {
                await client.query(`UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE user_id = $2`, [marketCreationFee, userId]);
                // Record the market creation fee as protocol revenue
                // Market creation fees go to the protocol (not creator fees)
                await Moodring_1.MoodringModel.recordFees(0, marketCreationFee, client);
            }
            // Parse and validate categoryIds - require exactly one category
            let parsedCategoryIds = [];
            if (categoryIds) {
                if (typeof categoryIds === "string") {
                    try {
                        parsedCategoryIds = JSON.parse(categoryIds);
                    }
                    catch {
                        parsedCategoryIds = [categoryIds];
                    }
                }
                else if (Array.isArray(categoryIds)) {
                    parsedCategoryIds = categoryIds;
                }
            }
            // Validate that exactly one category is provided
            if (!parsedCategoryIds || parsedCategoryIds.length === 0) {
                return (0, errors_1.sendValidationError)(res, "A category is required. Please select exactly one category.");
            }
            if (parsedCategoryIds.length > 1) {
                return (0, errors_1.sendValidationError)(res, "Only one category is allowed per market. Please select exactly one category.");
            }
            // Validate that the category exists
            const categoryId = parsedCategoryIds[0];
            const category = await Category_1.CategoryModel.findById(categoryId);
            if (!category) {
                return (0, errors_1.sendValidationError)(res, "Invalid category selected. Please choose a valid category.");
            }
            // Generate unique ID for shared pool vault
            const sharedPoolVault = (0, uuid_1.v4)();
            // Create market using model
            // resolutionMode is validated above, so it's guaranteed to be defined here
            if (!resolutionMode) {
                throw new transaction_1.TransactionError(400, "Resolution mode is required");
            }
            const createdMarket = await Market_1.MarketModel.create({
                creator_id: userId,
                question: normalizedQuestion,
                market_description: marketDescription || "",
                image_url: imageUrl,
                expiration_timestamp: expirationTimestamp,
                shared_pool_vault: sharedPoolVault,
                is_binary: String(isBinary) === "true",
                is_verified: false,
                is_resolved: false,
                is_initialized: false,
                liquidity_parameter: 0,
                base_liquidity_parameter: DEFAULT_BASE_LIQUIDITY_PARAM,
                shared_pool_liquidity: 0,
                total_shared_lp_shares: 0,
                resolution_mode: resolutionMode,
                bond_amount: bondAmount,
                category_ids: [categoryId],
            }, client);
            return createdMarket.id;
        });
        // Record activity (outside transaction - non-critical)
        await Activity_1.ActivityModel.create({
            user_id: userId,
            activity_type: "market_created",
            entity_type: "market",
            entity_id: marketId,
            metadata: {
                question: normalizedQuestion,
                expiration: expirationTimestamp,
                is_binary: String(isBinary) === "true",
            },
        });
        return (0, errors_1.sendSuccess)(res, {
            market: marketId,
            creation_fee: marketCreationFee,
            creation_fee_display: marketCreationFee / 1000, // Convert microUSDC to USDC for display
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Create market error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.createMarket = createMarket;
/**
 * @route POST /api/market/option/create
 * @desc Create a new option for a market (off-chain)
 * @access Private
 */
const createOption = async (req, res) => {
    try {
        const userId = req.id;
        const { market, optionLabel, optionSubLabel } = req.body;
        // Validate required fields
        if (!(0, validation_1.validateRequired)(market, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        const labelValidation = (0, validation_1.validateLength)(optionLabel, "Option label", 1, MAX_OPTION_LABEL_LENGTH);
        if (!labelValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, labelValidation.error);
        }
        // Check for banned words in option label
        const optionBannedWordsCheck = (0, contentModeration_1.validateTextContent)(optionLabel, "Option label");
        if (!optionBannedWordsCheck.isValid) {
            return (0, errors_1.sendValidationError)(res, optionBannedWordsCheck.error);
        }
        // Validate sub-label if provided
        let normalizedSubLabel = null;
        if (optionSubLabel !== undefined &&
            optionSubLabel !== null &&
            optionSubLabel.trim() !== "") {
            const subLabelValidation = (0, validation_1.validateLength)(optionSubLabel, "Option sub-label", 1, 100);
            if (!subLabelValidation.isValid) {
                return (0, errors_1.sendValidationError)(res, subLabelValidation.error);
            }
            // Check for banned words in sub-label
            const subLabelBannedWordsCheck = (0, contentModeration_1.validateTextContent)(optionSubLabel, "Option sub-label");
            if (!subLabelBannedWordsCheck.isValid) {
                return (0, errors_1.sendValidationError)(res, subLabelBannedWordsCheck.error);
            }
            normalizedSubLabel = optionSubLabel.trim();
        }
        // Handle image upload before transaction (external service call)
        let imageUrl = null;
        if (req.file) {
            // Validate image (file type, size, and NSFW content)
            const validation = await (0, contentModeration_1.validateImage)(req.file.buffer, req.file.mimetype);
            if (!validation.isValid) {
                return (0, errors_1.sendValidationError)(res, validation.error || "Invalid image");
            }
            if (process.env.S3_BUCKET) {
                try {
                    imageUrl = await (0, metadata_1.uploadImageToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
                }
                catch (error) {
                    console.error("Failed to upload option image to S3:", error);
                    return (0, errors_1.sendError)(res, 500, "Failed to upload image");
                }
            }
        }
        const optionId = await (0, transaction_1.withTransaction)(async (client) => {
            // Get market with lock
            const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [market]);
            const selectedMarket = marketResult.rows[0];
            if (!selectedMarket) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            // Check authority (using creator_id)
            if (selectedMarket.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of the market");
            }
            if (selectedMarket.is_initialized) {
                throw new transaction_1.TransactionError(400, "Cannot add options to initialized market");
            }
            // For binary markets, enforce maximum of 1 option
            if (selectedMarket.is_binary) {
                const existingOptionsResult = await client.query(`SELECT COUNT(*) as count FROM market_options WHERE market_id = $1`, [market]);
                const existingCount = parseInt(existingOptionsResult.rows[0].count, 10);
                if (existingCount >= 1) {
                    throw new transaction_1.TransactionError(400, "Binary markets can only have one option");
                }
            }
            // Create option using model
            const createdOption = await Option_1.OptionModel.create({
                market_id: market,
                option_label: optionLabel.trim(),
                option_sub_label: normalizedSubLabel,
                option_image_url: imageUrl,
                yes_quantity: 0,
                no_quantity: 0,
            }, client);
            // Update market total_options
            await client.query(`UPDATE markets SET total_options = total_options + 1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`, [market]);
            return createdOption.id;
        });
        return (0, errors_1.sendSuccess)(res, { option: optionId });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Create option error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.createOption = createOption;
/**
 * @route PUT /api/market/:id
 * @desc Update a market (only if not initialized)
 * @access Private
 */
const updateMarket = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        const { marketQuestion, marketDescription, marketExpirationDate, categoryIds, } = req.body;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(id, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        const updatedMarket = await (0, transaction_1.withTransaction)(async (client) => {
            // Get market with lock
            const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [id]);
            const selectedMarket = marketResult.rows[0];
            if (!selectedMarket) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            // Check authority
            if (selectedMarket.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of the market");
            }
            // Only allow updates if market is not initialized
            if (selectedMarket.is_initialized) {
                throw new transaction_1.TransactionError(400, "Cannot update initialized market");
            }
            const updateData = {};
            // Update question if provided
            if (marketQuestion !== undefined) {
                const questionValidation = (0, validation_1.validateLength)(marketQuestion, "Market question", 12, MAX_QUESTION_LENGTH);
                if (!questionValidation.isValid) {
                    throw new transaction_1.TransactionError(400, questionValidation.error);
                }
                const normalizedQuestion = normalizeQuestion(marketQuestion);
                if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
                    throw new transaction_1.TransactionError(400, `Market question must be ${MAX_QUESTION_LENGTH} characters or less`);
                }
                const questionBannedWordsCheck = (0, contentModeration_1.validateTextContent)(normalizedQuestion, "Market question");
                if (!questionBannedWordsCheck.isValid) {
                    throw new transaction_1.TransactionError(400, questionBannedWordsCheck.error);
                }
                updateData.question = normalizedQuestion;
            }
            // Update description if provided
            if (marketDescription !== undefined) {
                if (marketDescription && marketDescription.trim()) {
                    const descriptionBannedWordsCheck = (0, contentModeration_1.validateTextContent)(marketDescription, "Market description");
                    if (!descriptionBannedWordsCheck.isValid) {
                        throw new transaction_1.TransactionError(400, descriptionBannedWordsCheck.error);
                    }
                }
                updateData.market_description = marketDescription || "";
            }
            // Update expiration date if provided
            if (marketExpirationDate !== undefined) {
                const expirationTimestamp = Number(marketExpirationDate);
                const timestampValidation = (0, validation_1.validateNumber)(expirationTimestamp, "Expiration date", Math.floor(Date.now() / 1000) + 1, undefined);
                if (!timestampValidation.isValid) {
                    throw new transaction_1.TransactionError(400, timestampValidation.error || "Expiration date must be in the future");
                }
                updateData.expiration_timestamp = expirationTimestamp;
            }
            // Handle image upload if provided
            if (req.file) {
                const validation = await (0, contentModeration_1.validateImage)(req.file.buffer, req.file.mimetype);
                if (!validation.isValid) {
                    throw new transaction_1.TransactionError(400, validation.error || "Invalid image");
                }
                if (process.env.S3_BUCKET) {
                    try {
                        const imageUrl = await (0, metadata_1.uploadImageToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
                        updateData.image_url = imageUrl;
                    }
                    catch (error) {
                        console.error("Failed to upload market image to S3:", error);
                        throw new transaction_1.TransactionError(500, "Failed to upload image");
                    }
                }
            }
            // Update categories if provided
            if (categoryIds !== undefined) {
                // Parse and validate categoryIds
                let parsedCategoryIds = [];
                if (categoryIds) {
                    if (typeof categoryIds === "string") {
                        try {
                            parsedCategoryIds = JSON.parse(categoryIds);
                        }
                        catch {
                            parsedCategoryIds = [categoryIds];
                        }
                    }
                    else if (Array.isArray(categoryIds)) {
                        parsedCategoryIds = categoryIds;
                    }
                }
                // Delete existing category links
                await client.query(`DELETE FROM market_category_links WHERE market_id = $1`, [id]);
                // Add new category links
                if (parsedCategoryIds && parsedCategoryIds.length > 0) {
                    for (const categoryId of parsedCategoryIds) {
                        await client.query(`INSERT INTO market_category_links (market_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, categoryId]);
                    }
                }
            }
            // Update market if there are changes
            if (Object.keys(updateData).length > 0) {
                const updated = await Market_1.MarketModel.update(id, updateData, client);
                return updated;
            }
            return selectedMarket;
        });
        return (0, errors_1.sendSuccess)(res, { market: updatedMarket });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Update market error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.updateMarket = updateMarket;
/**
 * @route PUT /api/market/option/:id
 * @desc Update an option (only if market not initialized)
 * @access Private
 */
const updateOption = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        const { optionLabel, optionSubLabel } = req.body;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(id, "Option ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Option ID is required");
        }
        const updatedOption = await (0, transaction_1.withTransaction)(async (client) => {
            // Get option with market info
            const optionResult = await client.query(`SELECT o.*, m.creator_id, m.is_initialized, m.is_binary
         FROM market_options o
         INNER JOIN markets m ON o.market_id = m.id
         WHERE o.id = $1
         FOR UPDATE OF o, m`, [id]);
            const option = optionResult.rows[0];
            if (!option) {
                throw new transaction_1.TransactionError(404, "Option not found");
            }
            // Check authority
            if (option.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of this market");
            }
            // Only allow updates if market is not initialized
            if (option.is_initialized) {
                throw new transaction_1.TransactionError(400, "Cannot update options in initialized market");
            }
            const updateData = {};
            // Update label if provided
            if (optionLabel !== undefined) {
                const labelValidation = (0, validation_1.validateLength)(optionLabel, "Option label", 1, MAX_OPTION_LABEL_LENGTH);
                if (!labelValidation.isValid) {
                    throw new transaction_1.TransactionError(400, labelValidation.error);
                }
                const optionBannedWordsCheck = (0, contentModeration_1.validateTextContent)(optionLabel, "Option label");
                if (!optionBannedWordsCheck.isValid) {
                    throw new transaction_1.TransactionError(400, optionBannedWordsCheck.error);
                }
                updateData.option_label = optionLabel.trim();
            }
            // Update sub-label if provided
            if (optionSubLabel !== undefined) {
                if (optionSubLabel === null || optionSubLabel.trim() === "") {
                    // Allow clearing the sub-label
                    updateData.option_sub_label = null;
                }
                else {
                    const subLabelValidation = (0, validation_1.validateLength)(optionSubLabel, "Option sub-label", 1, 100);
                    if (!subLabelValidation.isValid) {
                        throw new transaction_1.TransactionError(400, subLabelValidation.error);
                    }
                    const subLabelBannedWordsCheck = (0, contentModeration_1.validateTextContent)(optionSubLabel, "Option sub-label");
                    if (!subLabelBannedWordsCheck.isValid) {
                        throw new transaction_1.TransactionError(400, subLabelBannedWordsCheck.error);
                    }
                    updateData.option_sub_label = optionSubLabel.trim();
                }
            }
            // Handle image upload if provided
            if (req.file) {
                const validation = await (0, contentModeration_1.validateImage)(req.file.buffer, req.file.mimetype);
                if (!validation.isValid) {
                    throw new transaction_1.TransactionError(400, validation.error || "Invalid image");
                }
                if (process.env.S3_BUCKET) {
                    try {
                        const imageUrl = await (0, metadata_1.uploadImageToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
                        updateData.option_image_url = imageUrl;
                    }
                    catch (error) {
                        console.error("Failed to upload option image to S3:", error);
                        throw new transaction_1.TransactionError(500, "Failed to upload image");
                    }
                }
            }
            // Update option if there are changes
            if (Object.keys(updateData).length > 0) {
                const updated = await Option_1.OptionModel.update(id, updateData, client);
                return updated;
            }
            return option;
        });
        return (0, errors_1.sendSuccess)(res, { option: updatedOption });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Update option error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.updateOption = updateOption;
/**
 * @route DELETE /api/market/option/:id
 * @desc Delete an option (only if market not initialized)
 * @access Private
 */
const deleteOption = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(id, "Option ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Option ID is required");
        }
        await (0, transaction_1.withTransaction)(async (client) => {
            // Get option with market info
            const optionResult = await client.query(`SELECT o.*, m.creator_id, m.is_initialized, m.id as market_id, m.total_options
         FROM market_options o
         INNER JOIN markets m ON o.market_id = m.id
         WHERE o.id = $1
         FOR UPDATE OF o, m`, [id]);
            const option = optionResult.rows[0];
            if (!option) {
                throw new transaction_1.TransactionError(404, "Option not found");
            }
            // Check authority
            if (option.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of this market");
            }
            // Only allow deletion if market is not initialized
            if (option.is_initialized) {
                throw new transaction_1.TransactionError(400, "Cannot delete options from initialized market");
            }
            // Delete the option (CASCADE will handle related records)
            await client.query(`DELETE FROM market_options WHERE id = $1`, [id]);
            // Update market total_options count
            const newTotalOptions = Math.max(0, (option.total_options || 0) - 1);
            await client.query(`UPDATE markets SET total_options = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newTotalOptions, option.market_id]);
        });
        return (0, errors_1.sendSuccess)(res, { message: "Option deleted successfully" });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Delete option error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.deleteOption = deleteOption;
/**
 * @route DELETE /api/market/:id
 * @desc Delete a market (only if not initialized)
 * @access Private
 */
const deleteMarket = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(id, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        await (0, transaction_1.withTransaction)(async (client) => {
            // Get market with lock
            const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [id]);
            const market = marketResult.rows[0];
            if (!market) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            // Check authority
            if (market.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of this market");
            }
            // Only allow deletion if market is not initialized
            if (market.is_initialized) {
                throw new transaction_1.TransactionError(400, "Cannot delete initialized market. Markets with trading activity cannot be deleted.");
            }
            // Delete the market (CASCADE will handle related records like options, category links, etc.)
            await client.query(`DELETE FROM markets WHERE id = $1`, [id]);
        });
        return (0, errors_1.sendSuccess)(res, { message: "Market deleted successfully" });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Delete market error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.deleteMarket = deleteMarket;
/**
 * @route GET /api/market
 * @desc Get paginated markets with filtering
 * @access Public
 */
const getMarkets = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        // Filter parameters
        const category = req.query.category;
        const status = req.query.status || "active";
        const sort = req.query.sort;
        const order = req.query.order === "asc" ? "ASC" : "DESC";
        const search = req.query.search;
        const featured = req.query.featured === "true";
        const creator = req.query.creator;
        const creatorType = req.query.creator_type; // "platform", "admin", "user", or "all"
        // Build WHERE clause
        const conditions = [];
        const values = [];
        let paramCount = 1;
        if (status === "active") {
            conditions.push("m.is_resolved = FALSE AND m.is_initialized = TRUE AND m.expiration_timestamp > EXTRACT(EPOCH FROM NOW())");
        }
        else if (status === "resolved") {
            conditions.push("m.is_resolved = TRUE");
        }
        else if (status === "expired") {
            conditions.push("m.is_resolved = FALSE AND m.expiration_timestamp <= EXTRACT(EPOCH FROM NOW())");
        }
        if (featured) {
            conditions.push("m.is_featured = TRUE");
        }
        if (creator) {
            conditions.push(`m.creator_id = $${paramCount}`);
            values.push(creator);
            paramCount++;
        }
        if (search) {
            conditions.push(`(m.question ILIKE $${paramCount} OR m.market_description ILIKE $${paramCount})`);
            values.push(`%${search}%`);
            paramCount++;
        }
        if (category) {
            conditions.push(`EXISTS (
        SELECT 1 FROM market_category_links mcl 
        INNER JOIN market_categories mc ON mcl.category_id = mc.id
        WHERE mcl.market_id = m.id AND mc.name ILIKE $${paramCount}
      )`);
            values.push(category);
            paramCount++;
        }
        // Filter by creator type: platform, admin, user, or all
        if (creatorType && creatorType !== "all") {
            if (creatorType === "platform") {
                // Platform markets are identified by is_verified = true
                conditions.push("m.is_verified = TRUE");
            }
            else if (creatorType === "admin") {
                // Admin markets: creator_id is in moodring_admins
                conditions.push(`EXISTS (
          SELECT 1 FROM moodring_admins ma
          WHERE ma.user_id = m.creator_id
        )`);
            }
            else if (creatorType === "user") {
                // User markets: not verified and creator_id is not in moodring_admins
                conditions.push(`m.is_verified = FALSE AND NOT EXISTS (
          SELECT 1 FROM moodring_admins ma
          WHERE ma.user_id = m.creator_id
        )`);
            }
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        // Build ORDER BY clause
        let orderBy = "m.created_at DESC";
        if (sort === "volume") {
            orderBy = `m.total_volume ${order}`;
        }
        else if (sort === "expiration") {
            orderBy = `m.expiration_timestamp ${order}`;
        }
        else if (sort === "trending") {
            orderBy = `m.trending_score ${order}, m.total_volume DESC`;
        }
        else if (sort === "created") {
            orderBy = `m.created_at ${order}`;
        }
        // Execute queries
        const [marketsResult, countResult] = await Promise.all([
            db_1.pool.query(`
        SELECT 
          m.*,
          u.username as creator_username,
          u.display_name as creator_display_name,
          u.avatar_url as creator_avatar_url,
          CASE WHEN ma.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_admin_creator
        FROM markets m
        LEFT JOIN users u ON m.creator_id = u.id
        LEFT JOIN moodring_admins ma ON m.creator_id = ma.user_id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...values, limit, offset]),
            db_1.pool.query(`SELECT COUNT(*)::int as count FROM markets m ${whereClause}`, values),
        ]);
        const markets = marketsResult.rows;
        const total = countResult.rows[0]?.count || 0;
        // Get options for all markets
        const marketIds = markets.map((market) => market.id);
        const optionsByMarket = await Option_1.OptionModel.findByMarketIds(marketIds);
        // Get categories for all markets
        const categoriesResult = await db_1.pool.query(`
      SELECT mcl.market_id, mc.id, mc.name
      FROM market_category_links mcl
      INNER JOIN market_categories mc ON mcl.category_id = mc.id
      WHERE mcl.market_id = ANY($1::uuid[])
    `, [marketIds]);
        const categoriesByMarket = {};
        for (const row of categoriesResult.rows) {
            if (!categoriesByMarket[row.market_id]) {
                categoriesByMarket[row.market_id] = [];
            }
            categoriesByMarket[row.market_id].push({
                id: row.id,
                name: row.name,
            });
        }
        const marketsWithDetails = markets.map((market) => {
            // Calculate prices for options
            const marketOptions = optionsByMarket[market.id] || [];
            const optionsWithPrices = marketOptions.map((option) => {
                let yesPrice = 0.5;
                let noPrice = 0.5;
                // Only calculate prices if market has valid liquidity_parameter
                if (market.liquidity_parameter &&
                    Number(market.liquidity_parameter) > 0) {
                    try {
                        const liquidityParam = new anchor_1.BN(market.liquidity_parameter);
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        yesPrice =
                            (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                                lmsr_1.PRECISION.toNumber();
                        noPrice = 1 - yesPrice;
                    }
                    catch (e) {
                        // Use defaults if calculation fails
                    }
                }
                return {
                    ...option,
                    yes_price: yesPrice,
                    no_price: noPrice,
                };
            });
            return {
                ...market,
                options: optionsWithPrices,
                categories: categoriesByMarket[market.id] || [],
            };
        });
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            markets: marketsWithDetails,
            pagination: {
                page,
                perPage: limit,
                total,
                totalPages,
                hasMore: page * limit < total,
            },
            filters: {
                category,
                status,
                sort,
                order,
                search,
                featured,
                creator,
                creator_type: creatorType,
            },
        });
    }
    catch (error) {
        console.error("Get markets error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarkets = getMarkets;
/**
 * @route GET /api/market/featured
 * @desc Get featured markets
 * @access Public
 */
const getFeaturedMarkets = async (req, res) => {
    try {
        const limit = Math.min(20, parseInt(req.query.limit) || 10);
        const result = await db_1.pool.query(`
      SELECT
        m.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.avatar_url as creator_avatar_url,
        CASE WHEN ma.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_admin_creator
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN moodring_admins ma ON m.creator_id = ma.user_id
      WHERE m.is_featured = TRUE AND m.is_resolved = FALSE AND m.is_initialized = TRUE
      ORDER BY m.featured_order ASC NULLS LAST, m.total_volume DESC
      LIMIT $1
    `, [limit]);
        const markets = result.rows;
        const marketIds = markets.map((m) => m.id);
        const optionsByMarket = await Option_1.OptionModel.findByMarketIds(marketIds);
        const marketsWithOptions = markets.map((market) => {
            const marketOptions = optionsByMarket[market.id] || [];
            const optionsWithPrices = marketOptions.map((option) => {
                let yesPrice = 0.5;
                if (market.liquidity_parameter &&
                    Number(market.liquidity_parameter) > 0) {
                    try {
                        const liquidityParam = new anchor_1.BN(market.liquidity_parameter);
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        yesPrice =
                            (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                                lmsr_1.PRECISION.toNumber();
                    }
                    catch (e) { }
                }
                return { ...option, yes_price: yesPrice, no_price: 1 - yesPrice };
            });
            return { ...market, options: optionsWithPrices };
        });
        return (0, errors_1.sendSuccess)(res, { markets: marketsWithOptions });
    }
    catch (error) {
        console.error("Get featured markets error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getFeaturedMarkets = getFeaturedMarkets;
/**
 * @route GET /api/market/trending
 * @desc Get trending markets
 * @access Public
 */
const getTrendingMarkets = async (req, res) => {
    try {
        const limit = Math.min(20, parseInt(req.query.limit) || 10);
        const result = await db_1.pool.query(`
      SELECT m.*, 
        COALESCE(t.recent_volume, 0) as recent_volume,
        COALESCE(t.recent_trades, 0) as recent_trades
      FROM markets m
      LEFT JOIN (
        SELECT market_id, 
          SUM(total_cost) as recent_volume,
          COUNT(*) as recent_trades
        FROM trades
        WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')::BIGINT AND status = 'completed'
        GROUP BY market_id
      ) t ON m.id = t.market_id
      WHERE m.is_resolved = FALSE AND m.is_initialized = TRUE
        AND m.expiration_timestamp > EXTRACT(EPOCH FROM NOW())
      ORDER BY recent_volume DESC NULLS LAST, m.total_volume DESC
      LIMIT $1
    `, [limit]);
        const markets = result.rows;
        const marketIds = markets.map((m) => m.id);
        const optionsByMarket = await Option_1.OptionModel.findByMarketIds(marketIds);
        const marketsWithOptions = markets.map((market) => {
            const marketOptions = optionsByMarket[market.id] || [];
            const optionsWithPrices = marketOptions.map((option) => {
                let yesPrice = 0.5;
                if (market.liquidity_parameter &&
                    Number(market.liquidity_parameter) > 0) {
                    try {
                        const liquidityParam = new anchor_1.BN(market.liquidity_parameter);
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        yesPrice =
                            (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                                lmsr_1.PRECISION.toNumber();
                    }
                    catch (e) { }
                }
                return { ...option, yes_price: yesPrice, no_price: 1 - yesPrice };
            });
            return { ...market, options: optionsWithPrices };
        });
        return (0, errors_1.sendSuccess)(res, { markets: marketsWithOptions });
    }
    catch (error) {
        console.error("Get trending markets error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getTrendingMarkets = getTrendingMarkets;
/**
 * @route GET /api/market/my-markets
 * @desc Get markets created by the authenticated user
 * @access Private
 */
const getMyMarkets = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        // Filter by status: all, pending (not initialized), active, resolved
        const status = req.query.status || "all";
        // Build WHERE clause
        const conditions = ["m.creator_id = $1"];
        const values = [userId];
        let paramCount = 2;
        if (status === "pending") {
            // Markets created but not yet initialized
            conditions.push("m.is_initialized = FALSE");
        }
        else if (status === "active") {
            // Markets initialized and not resolved
            conditions.push("m.is_initialized = TRUE AND m.is_resolved = FALSE AND m.expiration_timestamp > EXTRACT(EPOCH FROM NOW())");
        }
        else if (status === "resolved") {
            conditions.push("m.is_resolved = TRUE");
        }
        else if (status === "expired") {
            conditions.push("m.is_resolved = FALSE AND m.expiration_timestamp <= EXTRACT(EPOCH FROM NOW())");
        }
        // "all" doesn't add any additional conditions
        const whereClause = `WHERE ${conditions.join(" AND ")}`;
        // Execute queries
        const [marketsResult, countResult] = await Promise.all([
            db_1.pool.query(`
        SELECT 
          m.*,
          u.username as creator_username,
          u.display_name as creator_display_name,
          u.avatar_url as creator_avatar_url,
          CASE WHEN ma.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_admin_creator
        FROM markets m
        LEFT JOIN users u ON m.creator_id = u.id
        LEFT JOIN moodring_admins ma ON m.creator_id = ma.user_id
        ${whereClause}
        ORDER BY m.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...values, limit, offset]),
            db_1.pool.query(`SELECT COUNT(*)::int as count FROM markets m ${whereClause}`, values),
        ]);
        const markets = marketsResult.rows;
        const total = countResult.rows[0]?.count || 0;
        // Get options for all markets
        const marketIds = markets.map((market) => market.id);
        const optionsByMarket = marketIds.length > 0 ? await Option_1.OptionModel.findByMarketIds(marketIds) : {};
        // Get categories for all markets
        let categoriesByMarket = {};
        if (marketIds.length > 0) {
            const categoriesResult = await db_1.pool.query(`
        SELECT mcl.market_id, mc.id, mc.name
        FROM market_category_links mcl
        INNER JOIN market_categories mc ON mcl.category_id = mc.id
        WHERE mcl.market_id = ANY($1::uuid[])
      `, [marketIds]);
            for (const row of categoriesResult.rows) {
                if (!categoriesByMarket[row.market_id]) {
                    categoriesByMarket[row.market_id] = [];
                }
                categoriesByMarket[row.market_id].push({
                    id: row.id,
                    name: row.name,
                });
            }
        }
        const marketsWithDetails = markets.map((market) => {
            const marketOptions = optionsByMarket[market.id] || [];
            const optionsWithPrices = marketOptions.map((option) => {
                let yesPrice = 0.5;
                if (market.liquidity_parameter &&
                    Number(market.liquidity_parameter) > 0) {
                    try {
                        const liquidityParam = new anchor_1.BN(market.liquidity_parameter);
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        yesPrice =
                            (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                                lmsr_1.PRECISION.toNumber();
                    }
                    catch (e) { }
                }
                return { ...option, yes_price: yesPrice, no_price: 1 - yesPrice };
            });
            return {
                ...market,
                options: optionsWithPrices,
                categories: categoriesByMarket[market.id] || [],
            };
        });
        // Get counts by status for summary
        const statusCountsResult = await db_1.pool.query(`
      SELECT 
        COUNT(*)::int as total,
        SUM(CASE WHEN is_initialized = FALSE THEN 1 ELSE 0 END)::int as pending,
        SUM(CASE WHEN is_initialized = TRUE AND is_resolved = FALSE AND expiration_timestamp > EXTRACT(EPOCH FROM NOW()) THEN 1 ELSE 0 END)::int as active,
        SUM(CASE WHEN is_resolved = TRUE THEN 1 ELSE 0 END)::int as resolved,
        SUM(CASE WHEN is_resolved = FALSE AND expiration_timestamp <= EXTRACT(EPOCH FROM NOW()) THEN 1 ELSE 0 END)::int as expired
      FROM markets
      WHERE creator_id = $1
    `, [userId]);
        const statusCounts = statusCountsResult.rows[0] || {
            total: 0,
            pending: 0,
            active: 0,
            resolved: 0,
            expired: 0,
        };
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            markets: marketsWithDetails,
            pagination: {
                page,
                perPage: limit,
                total,
                totalPages,
                hasMore: page * limit < total,
            },
            statusCounts,
            currentFilter: status,
        });
    }
    catch (error) {
        console.error("Get my markets error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMyMarkets = getMyMarkets;
/**
 * @route GET /api/market/:id
 * @desc Get a specific market by ID
 * @access Public
 */
const getMarket = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(id, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        const market = await Market_1.MarketModel.findById(id);
        if (!market) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Fetch creator info and admin status
        const creatorResult = await db_1.pool.query(`
      SELECT 
        u.username, 
        u.display_name, 
        u.avatar_url,
        CASE WHEN ma.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_admin_creator
      FROM users u
      LEFT JOIN moodring_admins ma ON u.id = ma.user_id
      WHERE u.id = $1
      `, [market.creator_id]);
        const creator = creatorResult.rows[0] || null;
        const options = await Option_1.OptionModel.findByMarketId(id);
        // Fetch categories for this market
        const categoriesResult = await db_1.pool.query(`
      SELECT mc.id, mc.name
      FROM market_category_links mcl
      INNER JOIN market_categories mc ON mcl.category_id = mc.id
      WHERE mcl.market_id = $1
    `, [id]);
        const categories = categoriesResult.rows;
        // Calculate prices for each option
        const optionsWithPrices = options.map((option) => {
            let yesPrice = 0.5;
            let noPrice = 0.5;
            // Only calculate if market has valid liquidity_parameter
            if (market.liquidity_parameter &&
                Number(market.liquidity_parameter) > 0) {
                try {
                    const liquidityParam = new anchor_1.BN(market.liquidity_parameter);
                    const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                    const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                    yesPrice =
                        (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                            lmsr_1.PRECISION.toNumber();
                    noPrice = 1 - yesPrice;
                }
                catch (e) {
                    // Use defaults
                }
            }
            return {
                ...option,
                yes_price: yesPrice,
                no_price: noPrice,
            };
        });
        return (0, errors_1.sendSuccess)(res, {
            market: {
                ...market,
                creator_username: creator?.username || null,
                creator_display_name: creator?.display_name || null,
                creator_avatar_url: creator?.avatar_url || null,
                is_admin_creator: creator?.is_admin_creator || false,
                options: optionsWithPrices,
                categories,
            },
        });
    }
    catch (error) {
        console.error("Get market error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarket = getMarket;
/**
 * @route POST /api/market/initialize
 * @desc Initialize a market with initial liquidity (mark it as ready for trading)
 * @access Private
 */
const initializeMarket = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { market, initialLiquidity } = req.body;
        if (!(0, validation_1.validateRequired)(market, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        // Require initial liquidity
        const MIN_INITIAL_LIQUIDITY = 100000; // 100 USDC (in micro-units)
        const liquidityValidation = (0, validation_1.validateNumber)(initialLiquidity, "Initial liquidity", MIN_INITIAL_LIQUIDITY, undefined);
        if (!liquidityValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, liquidityValidation.error ||
                `Minimum initial liquidity is ${MIN_INITIAL_LIQUIDITY / 1000} USDC`);
        }
        const parsedLiquidity = Number(initialLiquidity);
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get market with lock
            const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [market]);
            const selectedMarket = marketResult.rows[0];
            if (!selectedMarket) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            // Check authority (using creator_id)
            if (selectedMarket.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of the market");
            }
            if (selectedMarket.is_initialized) {
                throw new transaction_1.TransactionError(400, "Market is already initialized");
            }
            // Check that market has at least one option (or two for binary)
            const optionsResult = await client.query(`SELECT * FROM market_options WHERE market_id = $1`, [market]);
            const options = optionsResult.rows;
            if (selectedMarket.is_binary && options.length !== 1) {
                throw new transaction_1.TransactionError(400, "Binary market requires exactly 1 option");
            }
            if (options.length < 1) {
                throw new transaction_1.TransactionError(400, "Market requires at least 1 option");
            }
            // Get user wallet with lock
            const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
            const wallet = walletResult.rows[0];
            if (!wallet) {
                throw new transaction_1.TransactionError(404, "Wallet not found");
            }
            // Check sufficient balance
            if (Number(wallet.balance_usdc) < parsedLiquidity) {
                throw new transaction_1.TransactionError(400, "Insufficient USDC balance for initial liquidity");
            }
            // Calculate initial LP shares (1:1 for first liquidity provider)
            const initialShares = parsedLiquidity;
            // Calculate liquidity parameter based on initial liquidity
            // Liquidity param should be on same scale as quantities (micro-units)
            // Formula: b = max(base_param * 1000, sqrt(liquidity) * 10000)
            // Note: At initialization, there are no shares yet, so we only use liquidity
            // When liquidity is added later, the formula will also consider total shares
            // This ensures price changes are gradual, not extreme
            const baseLiquidityParam = Number(selectedMarket.base_liquidity_parameter) ||
                DEFAULT_BASE_LIQUIDITY_PARAM;
            const liquidityParam = Math.max(baseLiquidityParam * 1000, Math.floor(Math.sqrt(parsedLiquidity) * 10000));
            // Deduct from user wallet
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [parsedLiquidity, wallet.id]);
            // Initialize market with liquidity
            await client.query(`UPDATE markets SET 
        is_initialized = TRUE,
        shared_pool_liquidity = $2,
        total_shared_lp_shares = $3,
        liquidity_parameter = $4,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
      WHERE id = $1`, [market, parsedLiquidity, initialShares, liquidityParam]);
            // Create LP position for the creator using model
            await LpPosition_1.LpPositionModel.create({
                user_id: userId,
                market_id: market,
                shares: initialShares,
                deposited_amount: parsedLiquidity,
                lp_token_balance: initialShares,
            }, client);
            return { options, initialShares, liquidityParam };
        });
        // Record activity (outside transaction - non-critical)
        await Activity_1.ActivityModel.create({
            user_id: userId,
            activity_type: "market_initialized",
            entity_type: "market",
            entity_id: market,
            metadata: {
                options_count: result.options.length,
                initial_liquidity: parsedLiquidity,
                lp_shares: result.initialShares,
            },
        });
        // Record initial price snapshots for all options
        // Initial price is 0.5 (50%) since quantities start at 0/0
        const initialPrice = 0.5;
        for (const opt of result.options) {
            await PriceSnapshot_1.PriceSnapshotModel.recordPrice({
                option_id: opt.id,
                market_id: market,
                yes_price: initialPrice,
                no_price: 1 - initialPrice,
                yes_quantity: 0,
                no_quantity: 0,
                volume: 0,
                trade_count: 0,
                snapshot_type: "initialization",
            });
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Market initialized successfully",
            initial_liquidity: parsedLiquidity,
            lp_shares: result.initialShares,
            liquidity_parameter: result.liquidityParam,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Initialize market error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.initializeMarket = initializeMarket;
/**
 * Auto-credit winnings to all winners when an option is resolved
 * This runs asynchronously after the resolution transaction commits
 * to avoid blocking the resolution process
 */
async function autoCreditWinnings(optionId, winningSide, marketId, originalClient) {
    // Use a new connection to avoid transaction conflicts
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        // SECURITY FIX: Atomic update to prevent race condition
        // Only one process can set status to 'in_progress' if it's currently NULL
        // This eliminates the race condition window between SELECT and UPDATE
        const updateResult = await client.query(`UPDATE market_options 
       SET auto_credit_status = 'in_progress', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
       WHERE id = $1 
         AND auto_credit_status IS NULL
       RETURNING id, is_resolved`, [optionId]);
        // If no rows updated, another process already started or option doesn't exist
        if (updateResult.rows.length === 0) {
            // Check if option exists and what its status is
            const checkResult = await client.query(`SELECT id, auto_credit_status FROM market_options WHERE id = $1`, [optionId]);
            if (checkResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return;
            }
            const option = checkResult.rows[0];
            if (option.auto_credit_status === "in_progress" ||
                option.auto_credit_status === "completed") {
                await client.query("COMMIT");
                console.log(`[Auto-Credit] Option ${optionId} already processed or in progress`);
                return;
            }
            // Status is not NULL but also not in_progress/completed - unexpected state
            await client.query("ROLLBACK");
            console.error(`[Auto-Credit] Option ${optionId} has unexpected status: ${option.auto_credit_status}`);
            return;
        }
        const option = updateResult.rows[0];
        // Verify option is resolved before processing
        if (!option.is_resolved) {
            // Rollback the status update
            await client.query("ROLLBACK");
            console.warn(`[Auto-Credit] Option ${optionId} is not resolved, skipping auto-credit`);
            return;
        }
        // Get ALL positions for this option that haven't been claimed (both winners and losers)
        const positionsResult = await client.query(`SELECT up.*, w.id as wallet_id
       FROM user_positions up
       JOIN wallets w ON w.user_id = up.user_id
       WHERE up.option_id = $1 
         AND up.is_claimed = FALSE
         AND (up.yes_shares > 0 OR up.no_shares > 0)
       FOR UPDATE`, [optionId]);
        const positions = positionsResult.rows;
        if (positions.length === 0) {
            await client.query("COMMIT");
            return; // No positions to process
        }
        // Get market data to check pool liquidity
        const marketResult = await client.query(`SELECT shared_pool_liquidity, base_liquidity_parameter FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
        const marketData = marketResult.rows[0];
        if (!marketData) {
            await client.query("ROLLBACK");
            return;
        }
        let currentPoolLiquidity = Number(marketData.shared_pool_liquidity || 0);
        let totalPayout = 0;
        const winnerUpdates = [];
        const loserUpdates = [];
        // Process all positions - separate winners and losers
        for (const position of positions) {
            const yesShares = Number(position.yes_shares);
            const noShares = Number(position.no_shares);
            const winningShares = winningSide === 1 ? yesShares : noShares;
            const totalCostBasis = Number(position.total_yes_cost) + Number(position.total_no_cost);
            if (winningShares > 0) {
                // Winner: gets payout
                const payout = winningShares;
                const realizedPnl = payout - totalCostBasis;
                // Check if pool has enough liquidity
                if (currentPoolLiquidity < payout) {
                    console.warn(`Insufficient pool liquidity for auto-credit. User ${position.user_id} will need to claim manually.`);
                    continue; // Skip this user, they can claim manually
                }
                currentPoolLiquidity -= payout;
                totalPayout += payout;
                winnerUpdates.push({
                    userId: position.user_id,
                    walletId: position.wallet_id,
                    payout,
                    realizedPnl,
                });
            }
            else {
                // Loser: gets $0 payout, loses their cost basis
                const realizedPnl = -totalCostBasis; // Negative PnL = loss
                loserUpdates.push({
                    userId: position.user_id,
                    realizedPnl,
                });
            }
        }
        // Update wallets for winners
        for (const update of winnerUpdates) {
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [update.payout, update.walletId]);
        }
        // Update positions for winners - zero out shares and mark as claimed
        for (const update of winnerUpdates) {
            await client.query(`UPDATE user_positions SET 
          yes_shares = 0, 
          no_shares = 0,
          total_yes_cost = 0,
          total_no_cost = 0,
          realized_pnl = realized_pnl + $1,
          is_claimed = TRUE,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE user_id = $2 AND option_id = $3`, [update.realizedPnl, update.userId, optionId]);
        }
        // Update positions for losers - zero out shares and record loss
        for (const update of loserUpdates) {
            await client.query(`UPDATE user_positions SET 
          yes_shares = 0, 
          no_shares = 0,
          total_yes_cost = 0,
          total_no_cost = 0,
          realized_pnl = realized_pnl + $1,
          is_claimed = TRUE,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE user_id = $2 AND option_id = $3`, [update.realizedPnl, update.userId, optionId]);
        }
        // Update market pool liquidity
        // NOTE: We do NOT update liquidity_parameter here - it should remain fixed
        // even after market resolution for consistency. The market is resolved anyway,
        // so no more trades will occur, but keeping b fixed maintains consistency.
        await client.query(`UPDATE markets SET 
        shared_pool_liquidity = $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $2`, [currentPoolLiquidity, marketId]);
        // SECURITY FIX: Mark auto-credit as completed to prevent reprocessing
        await client.query(`UPDATE market_options 
       SET auto_credit_status = 'completed', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
       WHERE id = $1`, [optionId]);
        await client.query("COMMIT");
        // Create notifications and activities for each winner (non-blocking)
        for (const update of winnerUpdates) {
            try {
                await Notification_1.NotificationModel.create({
                    user_id: update.userId,
                    notification_type: "trade_executed",
                    title: "Winnings Credited",
                    message: `Your winnings of ${update.payout / 1000000} USDC have been automatically added to your wallet.`,
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        market_id: marketId,
                        payout: update.payout,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        auto_credited: true,
                    },
                });
                await Activity_1.ActivityModel.create({
                    user_id: update.userId,
                    activity_type: "claim",
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        payout: update.payout,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        market_id: marketId,
                        auto_credited: true,
                    },
                });
            }
            catch (notifError) {
                console.error(`Error creating notification for user ${update.userId}:`, notifError);
                // Don't fail the whole process if notification fails
            }
        }
        // Create notifications and activities for each loser (non-blocking)
        for (const update of loserUpdates) {
            try {
                await Notification_1.NotificationModel.create({
                    user_id: update.userId,
                    notification_type: "trade_executed",
                    title: "Position Resolved",
                    message: `Your position resolved unfavorably. Loss: ${Math.abs(update.realizedPnl) / 1000000} USDC.`,
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        market_id: marketId,
                        payout: 0,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        auto_credited: true,
                        is_loss: true,
                    },
                });
                await Activity_1.ActivityModel.create({
                    user_id: update.userId,
                    activity_type: "market_resolved",
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        payout: 0,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        market_id: marketId,
                        auto_credited: true,
                        is_loss: true,
                    },
                });
            }
            catch (notifError) {
                console.error(`Error creating notification for user ${update.userId}:`, notifError);
                // Don't fail the whole process if notification fails
            }
        }
        console.log(`Auto-processed ${winnerUpdates.length} winners and ${loserUpdates.length} losers for option ${optionId}`);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error in autoCreditWinnings:", error);
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * @route POST /api/market/withdraw/creator-fee
 * @desc Withdraw accumulated creator fees
 * @access Private
 */
const withdrawCreatorFee = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { market } = req.body;
        if (!(0, validation_1.validateRequired)(market, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get market with lock
            const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [market]);
            const selectedMarket = marketResult.rows[0];
            if (!selectedMarket) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            // Check authority (using creator_id)
            if (selectedMarket.creator_id !== userId) {
                throw new transaction_1.TransactionError(403, "You are not the creator of the market");
            }
            const feesToWithdraw = Number(selectedMarket.creator_fees_collected);
            if (feesToWithdraw <= 0) {
                throw new transaction_1.TransactionError(400, "No fees to withdraw");
            }
            // Transfer fees to creator wallet
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE user_id = $2`, [feesToWithdraw, userId]);
            // Get updated balance for websocket update
            const updatedWalletResult = await client.query(`SELECT balance_usdc FROM wallets WHERE user_id = $1`, [userId]);
            const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;
            // Reset collected fees
            await client.query(`UPDATE markets SET creator_fees_collected = 0, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`, [market]);
            return { feesToWithdraw, newBalance };
        });
        // Emit balance update via websocket
        try {
            const { emitBalanceUpdate } = await Promise.resolve().then(() => __importStar(require("../services/websocket")));
            emitBalanceUpdate({
                user_id: userId,
                balance_usdc: result.newBalance,
                timestamp: new Date(),
            });
        }
        catch (wsError) {
            // Don't fail the withdrawal if websocket emission fails
            console.error("WebSocket emission error:", wsError);
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Creator fee withdrawn successfully",
            amount: result.feesToWithdraw,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Withdraw creator fee error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.withdrawCreatorFee = withdrawCreatorFee;
/**
 * @route GET /api/market/fair-value/:option
 * @desc Get fair value and price range for an option
 * @access Public
 */
const getFairValue = async (req, res) => {
    try {
        const { option } = req.params;
        if (!(0, validation_1.validateRequired)(option, "Option ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Option ID is required");
        }
        const optionData = await Option_1.OptionModel.findById(option);
        if (!optionData) {
            return (0, errors_1.sendNotFound)(res, "Option");
        }
        const marketData = await Market_1.MarketModel.findById(optionData.market_id);
        if (!marketData) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Require valid liquidity_parameter
        if (!marketData.liquidity_parameter ||
            Number(marketData.liquidity_parameter) <= 0) {
            return (0, errors_1.sendError)(res, 400, "Market not initialized - missing liquidity parameter");
        }
        const liquidityParam = new anchor_1.BN(marketData.liquidity_parameter);
        const yesQty = new anchor_1.BN(Math.floor(Number(optionData.yes_quantity)));
        const noQty = new anchor_1.BN(Math.floor(Number(optionData.no_quantity)));
        let yesPrice = 0.5;
        let noPrice = 0.5;
        try {
            yesPrice =
                (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                    lmsr_1.PRECISION.toNumber();
            noPrice = 1 - yesPrice;
        }
        catch (e) {
            // Use defaults on calculation error
        }
        return (0, errors_1.sendSuccess)(res, {
            yes_price: yesPrice,
            no_price: noPrice,
            yes_quantity: Number(optionData.yes_quantity),
            no_quantity: Number(optionData.no_quantity),
            liquidity_parameter: Number(marketData.liquidity_parameter),
        });
    }
    catch (error) {
        console.error("Get fair value error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getFairValue = getFairValue;
/**
 * @route POST /api/market/estimate/buy-cost
 * @desc Estimate cost to buy shares
 * @access Public
 */
const estimateBuyCost = async (req, res) => {
    try {
        const { option, buyYes, buyNo } = req.body;
        if (!(0, validation_1.validateRequired)(option, "Option ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Option ID is required");
        }
        const parsedBuyYes = Number(buyYes) || 0;
        const parsedBuyNo = Number(buyNo) || 0;
        if (parsedBuyYes <= 0 && parsedBuyNo <= 0) {
            return (0, errors_1.sendValidationError)(res, "Must specify shares to buy");
        }
        const optionData = await Option_1.OptionModel.findById(option);
        if (!optionData) {
            return (0, errors_1.sendNotFound)(res, "Option");
        }
        const marketData = await Market_1.MarketModel.findById(optionData.market_id);
        if (!marketData) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Require valid liquidity_parameter
        if (!marketData.liquidity_parameter ||
            Number(marketData.liquidity_parameter) <= 0) {
            return (0, errors_1.sendError)(res, 400, "Market not initialized - missing liquidity parameter");
        }
        const liquidityParam = new anchor_1.BN(marketData.liquidity_parameter);
        const currentYes = new anchor_1.BN(Math.floor(Number(optionData.yes_quantity)));
        const currentNo = new anchor_1.BN(Math.floor(Number(optionData.no_quantity)));
        let cost;
        try {
            const costBn = (0, lmsr_1.calculate_buy_cost)(currentYes, currentNo, new anchor_1.BN(parsedBuyYes), new anchor_1.BN(parsedBuyNo), liquidityParam);
            cost = costBn;
        }
        catch (error) {
            return res.status(400).send({ error: "Failed to calculate cost" });
        }
        // Calculate fees
        const TOTAL_FEE_BPS = 250; // 2.5%
        const fees = Math.floor((cost * TOTAL_FEE_BPS) / 10000);
        const totalCost = cost + fees;
        // Calculate new prices after trade
        const newYes = currentYes.add(new anchor_1.BN(parsedBuyYes));
        const newNo = currentNo.add(new anchor_1.BN(parsedBuyNo));
        const newYesPrice = (0, lmsr_1.calculate_yes_price)(newYes, newNo, liquidityParam) / lmsr_1.PRECISION.toNumber();
        return (0, errors_1.sendSuccess)(res, {
            cost,
            fees,
            total_cost: totalCost,
            price_per_share: parsedBuyYes + parsedBuyNo > 0
                ? (cost * 1000000) / (parsedBuyYes + parsedBuyNo)
                : 0,
            new_yes_price: newYesPrice,
            new_no_price: 1 - newYesPrice,
        });
    }
    catch (error) {
        console.error("Estimate buy cost error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.estimateBuyCost = estimateBuyCost;
/**
 * @route POST /api/market/estimate/sell-payout
 * @desc Estimate payout from selling shares
 * @access Public
 */
const estimateSellPayout = async (req, res) => {
    try {
        const { option, sellYes, sellNo } = req.body;
        if (!(0, validation_1.validateRequired)(option, "Option ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Option ID is required");
        }
        const parsedSellYes = Number(sellYes) || 0;
        const parsedSellNo = Number(sellNo) || 0;
        if (parsedSellYes <= 0 && parsedSellNo <= 0) {
            return (0, errors_1.sendValidationError)(res, "Must specify shares to sell");
        }
        const optionData = await Option_1.OptionModel.findById(option);
        if (!optionData) {
            return (0, errors_1.sendNotFound)(res, "Option");
        }
        const marketData = await Market_1.MarketModel.findById(optionData.market_id);
        if (!marketData) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Require valid liquidity_parameter
        if (!marketData.liquidity_parameter ||
            Number(marketData.liquidity_parameter) <= 0) {
            return (0, errors_1.sendError)(res, 400, "Market not initialized - missing liquidity parameter");
        }
        const liquidityParam = new anchor_1.BN(marketData.liquidity_parameter);
        const currentYes = new anchor_1.BN(Math.floor(Number(optionData.yes_quantity)));
        const currentNo = new anchor_1.BN(Math.floor(Number(optionData.no_quantity)));
        // Check sufficient liquidity
        if (parsedSellYes > Number(optionData.yes_quantity) ||
            parsedSellNo > Number(optionData.no_quantity)) {
            return (0, errors_1.sendError)(res, 400, "Insufficient market liquidity");
        }
        let payout;
        try {
            const payoutBn = (0, lmsr_1.calculate_sell_payout)(currentYes, currentNo, new anchor_1.BN(parsedSellYes), new anchor_1.BN(parsedSellNo), liquidityParam);
            payout = payoutBn;
        }
        catch (error) {
            return res.status(400).send({ error: "Failed to calculate payout" });
        }
        // Calculate fees
        const TOTAL_FEE_BPS = 250; // 2.5%
        const fees = Math.floor((payout * TOTAL_FEE_BPS) / 10000);
        const netPayout = payout - fees;
        // Calculate new prices after trade
        const newYes = currentYes.sub(new anchor_1.BN(parsedSellYes));
        const newNo = currentNo.sub(new anchor_1.BN(parsedSellNo));
        const newYesPrice = (0, lmsr_1.calculate_yes_price)(newYes, newNo, liquidityParam) / lmsr_1.PRECISION.toNumber();
        return (0, errors_1.sendSuccess)(res, {
            payout,
            fees,
            net_payout: netPayout,
            price_per_share: parsedSellYes + parsedSellNo > 0
                ? (payout * 1000000) / (parsedSellYes + parsedSellNo)
                : 0,
            new_yes_price: newYesPrice,
            new_no_price: 1 - newYesPrice,
        });
    }
    catch (error) {
        console.error("Estimate sell payout error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.estimateSellPayout = estimateSellPayout;
/**
 * @route POST /api/market/:id/watchlist
 * @desc Add a market to user's watchlist
 * @access Private
 */
const addToWatchlist = async (req, res) => {
    try {
        const userId = req.id;
        const { id: marketId } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(marketId, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        // Verify market exists
        const market = await Market_1.MarketModel.findById(marketId);
        if (!market) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Add to watchlist
        const watchlistEntry = await Watchlist_1.WatchlistModel.add({
            user_id: userId,
            market_id: marketId,
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Market added to watchlist",
            watchlist: watchlistEntry,
        });
    }
    catch (error) {
        console.error("Add to watchlist error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.addToWatchlist = addToWatchlist;
/**
 * @route DELETE /api/market/:id/watchlist
 * @desc Remove a market from user's watchlist
 * @access Private
 */
const removeFromWatchlist = async (req, res) => {
    try {
        const userId = req.id;
        const { id: marketId } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(marketId, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        const removed = await Watchlist_1.WatchlistModel.remove(userId, marketId);
        if (!removed) {
            return (0, errors_1.sendNotFound)(res, "Market in watchlist");
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Market removed from watchlist",
        });
    }
    catch (error) {
        console.error("Remove from watchlist error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.removeFromWatchlist = removeFromWatchlist;
/**
 * @route GET /api/market/watchlist
 * @desc Get user's watchlist markets
 * @access Private
 */
const getWatchlist = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        // Get watchlist market IDs
        const watchlistEntries = await Watchlist_1.WatchlistModel.findByUserId(userId);
        const marketIds = watchlistEntries.map((entry) => entry.market_id);
        if (marketIds.length === 0) {
            return (0, errors_1.sendSuccess)(res, {
                markets: [],
                pagination: {
                    page,
                    perPage: limit,
                    total: 0,
                    totalPages: 0,
                    hasMore: false,
                },
            });
        }
        // Get markets with pagination
        const marketsResult = await db_1.pool.query(`
      SELECT 
        m.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.avatar_url as creator_avatar_url,
        CASE WHEN ma.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_admin_creator
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN moodring_admins ma ON m.creator_id = ma.user_id
      WHERE m.id = ANY($1::uuid[])
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [marketIds, limit, offset]);
        const countResult = await db_1.pool.query(`SELECT COUNT(*)::int as count FROM markets WHERE id = ANY($1::uuid[])`, [marketIds]);
        const markets = marketsResult.rows;
        const total = countResult.rows[0]?.count || 0;
        // Get options for all markets
        const optionsByMarket = markets.length > 0
            ? await Option_1.OptionModel.findByMarketIds(markets.map((m) => m.id))
            : {};
        // Get categories for all markets
        let categoriesByMarket = {};
        if (markets.length > 0) {
            const categoriesResult = await db_1.pool.query(`
        SELECT mcl.market_id, mc.id, mc.name
        FROM market_category_links mcl
        INNER JOIN market_categories mc ON mcl.category_id = mc.id
        WHERE mcl.market_id = ANY($1::uuid[])
      `, [markets.map((m) => m.id)]);
            for (const row of categoriesResult.rows) {
                if (!categoriesByMarket[row.market_id]) {
                    categoriesByMarket[row.market_id] = [];
                }
                categoriesByMarket[row.market_id].push({
                    id: row.id,
                    name: row.name,
                });
            }
        }
        const marketsWithDetails = markets.map((market) => {
            const marketOptions = optionsByMarket[market.id] || [];
            const optionsWithPrices = marketOptions.map((option) => {
                let yesPrice = 0.5;
                if (market.liquidity_parameter &&
                    Number(market.liquidity_parameter) > 0) {
                    try {
                        const liquidityParam = new anchor_1.BN(market.liquidity_parameter);
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        yesPrice =
                            (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                                lmsr_1.PRECISION.toNumber();
                    }
                    catch (e) { }
                }
                return { ...option, yes_price: yesPrice, no_price: 1 - yesPrice };
            });
            return {
                ...market,
                options: optionsWithPrices,
                categories: categoriesByMarket[market.id] || [],
            };
        });
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            markets: marketsWithDetails,
            pagination: {
                page,
                perPage: limit,
                total,
                totalPages,
                hasMore: page * limit < total,
            },
        });
    }
    catch (error) {
        console.error("Get watchlist error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getWatchlist = getWatchlist;
/**
 * @route GET /api/market/:id/watchlist/status
 * @desc Check if a market is in user's watchlist
 * @access Private
 */
const getWatchlistStatus = async (req, res) => {
    try {
        const userId = req.id;
        const { id: marketId } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        if (!(0, validation_1.validateRequired)(marketId, "Market ID").isValid) {
            return (0, errors_1.sendValidationError)(res, "Market ID is required");
        }
        const isWatched = await Watchlist_1.WatchlistModel.isWatched(userId, marketId);
        return (0, errors_1.sendSuccess)(res, {
            is_watched: isWatched,
        });
    }
    catch (error) {
        console.error("Get watchlist status error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getWatchlistStatus = getWatchlistStatus;
/**
 * @route GET /api/market/:id/oembed
 * @desc Get oEmbed data for a market (for Discord and other platforms)
 * @access Public
 */
const getMarketOEmbed = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, errors_1.sendError)(res, 400, "Market ID is required");
        }
        const market = await Market_1.MarketModel.findById(id);
        if (!market) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        const options = await Option_1.OptionModel.findByMarketId(id);
        const baseUrl = process.env.CLIENT_URL || "https://moodring.io";
        const marketUrl = `${baseUrl}/market/${id}`;
        // Always use market's image_url if it exists and is not empty, otherwise fallback to icon
        const marketImage = market.image_url && market.image_url.trim() !== ""
            ? market.image_url
            : `${baseUrl}/icon.png`;
        // Calculate prices for options and build options string
        let optionsText = "";
        if (options && options.length > 0) {
            const liquidityParam = market.liquidity_parameter
                ? new anchor_1.BN(market.liquidity_parameter)
                : null;
            const optionPrices = [];
            // Calculate prices for all options first
            for (const option of options) {
                try {
                    if (liquidityParam && Number(liquidityParam) > 0) {
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        const yesPrice = (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                            lmsr_1.PRECISION.toNumber();
                        if (market.is_binary) {
                            // Binary market: show Yes and No
                            optionPrices.push({ label: "Yes", price: yesPrice });
                            optionPrices.push({ label: "No", price: 1 - yesPrice });
                            break; // Only need first option for binary
                        }
                        else {
                            // Multiple choice: show option label
                            optionPrices.push({
                                label: option.option_label,
                                price: yesPrice,
                            });
                        }
                    }
                }
                catch (e) {
                    // Skip if calculation fails
                }
            }
            // Sort by price (highest first) and take top 2-3
            optionPrices.sort((a, b) => b.price - a.price);
            const topOptions = market.is_binary
                ? optionPrices
                : optionPrices.slice(0, 3);
            // Format options text
            if (topOptions.length > 0) {
                optionsText =
                    " • " +
                        topOptions
                            .map((op) => `${op.label}: ${(op.price * 100).toFixed(1)}%`)
                            .join(" | ");
            }
        }
        // Build description with options
        let description = "";
        if (market.market_description) {
            const desc = market.market_description.substring(0, 150);
            description =
                desc +
                    (market.market_description.length > 150 ? "..." : "") +
                    optionsText;
        }
        else {
            description = `Trade on ${market.question}${optionsText}`;
        }
        // oEmbed response format
        res.json({
            type: "rich",
            version: "1.0",
            title: market.question,
            description: description,
            url: marketUrl,
            thumbnail_url: marketImage,
            thumbnail_width: 1200,
            thumbnail_height: 630,
            provider_name: "Moodring",
            provider_url: baseUrl,
            html: `<iframe src="${marketUrl}" width="400" height="600" frameborder="0" allowfullscreen></iframe>`,
            width: 400,
            height: 600,
        });
    }
    catch (error) {
        console.error("Get market oEmbed error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarketOEmbed = getMarketOEmbed;
/**
 * @route GET /api/market/:id/meta
 * @desc Get HTML with meta tags for Discord scraping
 * @access Public
 */
const getMarketMeta = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return (0, errors_1.sendError)(res, 400, "Market ID is required");
        }
        const market = await Market_1.MarketModel.findById(id);
        if (!market) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        const options = await Option_1.OptionModel.findByMarketId(id);
        const baseUrl = process.env.CLIENT_URL || "https://moodring.io";
        const marketUrl = `${baseUrl}/market/${id}`;
        // Always use market's image_url if it exists and is not empty, otherwise fallback to icon
        const marketImage = market.image_url && market.image_url.trim() !== ""
            ? market.image_url
            : `${baseUrl}/icon.png`;
        // Calculate prices for options and build options string
        let optionsText = "";
        if (options && options.length > 0) {
            const liquidityParam = market.liquidity_parameter
                ? new anchor_1.BN(market.liquidity_parameter)
                : null;
            const optionPrices = [];
            // Calculate prices for all options first
            for (const option of options) {
                try {
                    if (liquidityParam && Number(liquidityParam) > 0) {
                        const yesQty = new anchor_1.BN(Math.floor(Number(option.yes_quantity)));
                        const noQty = new anchor_1.BN(Math.floor(Number(option.no_quantity)));
                        const yesPrice = (0, lmsr_1.calculate_yes_price)(yesQty, noQty, liquidityParam) /
                            lmsr_1.PRECISION.toNumber();
                        if (market.is_binary) {
                            // Binary market: show Yes and No
                            optionPrices.push({ label: "Yes", price: yesPrice });
                            optionPrices.push({ label: "No", price: 1 - yesPrice });
                            break; // Only need first option for binary
                        }
                        else {
                            // Multiple choice: show option label
                            optionPrices.push({
                                label: option.option_label,
                                price: yesPrice,
                            });
                        }
                    }
                }
                catch (e) {
                    // Skip if calculation fails
                }
            }
            // Sort by price (highest first) and take top 2-3
            optionPrices.sort((a, b) => b.price - a.price);
            const topOptions = market.is_binary
                ? optionPrices
                : optionPrices.slice(0, 3);
            // Format options text
            if (topOptions.length > 0) {
                optionsText =
                    " • " +
                        topOptions
                            .map((op) => `${op.label}: ${(op.price * 100).toFixed(1)}%`)
                            .join(" | ");
            }
        }
        // Build description with options
        let description = "";
        if (market.market_description) {
            const desc = market.market_description.substring(0, 150);
            description =
                desc +
                    (market.market_description.length > 150 ? "..." : "") +
                    optionsText;
        }
        else {
            description = `Trade on ${market.question}${optionsText}`;
        }
        const title = `${market.question} | Moodring`;
        // Return HTML with meta tags for Discord to scrape
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description.replace(/"/g, "&quot;")}">
  <link rel="canonical" href="${marketUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${marketUrl}">
  <meta property="og:title" content="${title.replace(/"/g, "&quot;")}">
  <meta property="og:description" content="${description.replace(/"/g, "&quot;")}">
  <meta property="og:image" content="${marketImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Moodring">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${marketUrl}">
  <meta name="twitter:title" content="${title.replace(/"/g, "&quot;")}">
  <meta name="twitter:description" content="${description.replace(/"/g, "&quot;")}">
  <meta name="twitter:image" content="${marketImage}">
  
  <meta http-equiv="refresh" content="0;url=${marketUrl}">
</head>
<body>
  <script>window.location.href="${marketUrl}";</script>
  <p>Redirecting to <a href="${marketUrl}">${marketUrl}</a></p>
</body>
</html>`;
        res.setHeader("Content-Type", "text/html");
        res.send(html);
    }
    catch (error) {
        console.error("Get market meta error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarketMeta = getMarketMeta;
//# sourceMappingURL=controller_market.js.map