"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getCurrentUser = exports.refreshAccessToken = exports.authenticateWithWallet = exports.generateWalletNonce = exports.verifyMagicLink = exports.requestMagicLink = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const User_1 = require("../models/User");
const email_1 = require("../utils/email");
const jwt_1 = require("../utils/jwt");
const revocation_1 = require("../utils/revocation");
const web3_js_1 = require("@solana/web3.js");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
const helpers_1 = require("../utils/helpers");
const Wallet_1 = require("../models/Wallet");
const transaction_1 = require("../utils/transaction");
const circleWallet_1 = require("../services/circleWallet");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const Moodring_1 = require("../models/Moodring");
// Constants for security
const NONCE_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MINUTES = 15;
/**
 * @route POST /api/auth/magic-link/request
 * @desc Request magic link (OTP) via email
 * @access Public
 */
const requestMagicLink = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes("@")) {
            return (0, errors_1.sendValidationError)(res, "Valid email is required");
        }
        // Generate OTP
        const otp = (0, email_1.generateOTP)();
        const expiresAt = Math.floor((Date.now() + 10 * 60 * 1000) / 1000); // 10 minutes, Unix timestamp in seconds
        // Store OTP in database
        await db_1.pool.query(`INSERT INTO magic_links (email, token, expires_at) 
       VALUES ($1, $2, $3)`, [email.toLowerCase(), otp, expiresAt]);
        // Send OTP email
        await (0, email_1.sendOTPEmail)(email, otp);
        return (0, errors_1.sendSuccess)(res, {
            message: "OTP sent to your email",
            email: email.toLowerCase(),
            expiresIn: "10 minutes",
        });
    }
    catch (error) {
        console.error("Request magic link error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to send OTP");
    }
};
exports.requestMagicLink = requestMagicLink;
/**
 * @route POST /api/auth/magic-link/verify
 * @desc Verify OTP and login/signup user
 * @access Public
 */
const verifyMagicLink = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const validation = (0, validation_1.validateFields)([
            (0, validation_1.validateRequired)(otp, "OTP"),
            (0, validation_1.validateRequired)(email, "Email"),
        ]);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        const normalizedEmail = email.toLowerCase();
        // Check for lockout first (before any DB transaction)
        const lockoutResult = await db_1.pool.query(`SELECT * FROM otp_attempts WHERE email = $1`, [normalizedEmail]);
        if (lockoutResult.rows.length > 0) {
            const attemptRecord = lockoutResult.rows[0];
            // Check if locked out
            if (attemptRecord.locked_until &&
                attemptRecord.locked_until > 0 &&
                Math.floor(Date.now() / 1000) < attemptRecord.locked_until) {
                const remainingMinutes = Math.ceil((attemptRecord.locked_until - Math.floor(Date.now() / 1000)) / 60);
                return (0, errors_1.sendError)(res, 429, "Too many failed attempts", {
                    message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
                });
            }
        }
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Find the magic link entry with lock
            const magicLinkResult = await client.query(`SELECT * FROM magic_links 
         WHERE email = $1 AND token = $2 AND is_used = false 
         ORDER BY created_at DESC LIMIT 1
         FOR UPDATE`, [normalizedEmail, otp]);
            // Track attempt regardless of whether OTP was found (prevents brute force)
            if (magicLinkResult.rows.length === 0) {
                // Increment attempt counter for this email
                const now = Math.floor(Date.now() / 1000);
                const lockedUntil = now + OTP_LOCKOUT_MINUTES * 60;
                await client.query(`INSERT INTO otp_attempts (email, attempts, last_attempt_at)
           VALUES ($1, 1, $2)
           ON CONFLICT (email) DO UPDATE SET 
             attempts = otp_attempts.attempts + 1,
             last_attempt_at = $2,
             locked_until = CASE 
               WHEN otp_attempts.attempts + 1 >= $3 
               THEN $4
               ELSE otp_attempts.locked_until 
             END`, [normalizedEmail, now, OTP_MAX_ATTEMPTS, lockedUntil]);
                throw new transaction_1.TransactionError(401, "Invalid or expired OTP");
            }
            const magicLink = magicLinkResult.rows[0];
            // Check if OTP has expired
            if (Math.floor(Date.now() / 1000) > magicLink.expires_at) {
                // Also count as failed attempt
                const now = Math.floor(Date.now() / 1000);
                const lockedUntil = now + OTP_LOCKOUT_MINUTES * 60;
                await client.query(`INSERT INTO otp_attempts (email, attempts, last_attempt_at)
           VALUES ($1, 1, $2)
           ON CONFLICT (email) DO UPDATE SET 
             attempts = otp_attempts.attempts + 1,
             last_attempt_at = $2,
             locked_until = CASE 
               WHEN otp_attempts.attempts + 1 >= $3 
               THEN $4
               ELSE otp_attempts.locked_until 
             END`, [normalizedEmail, now, OTP_MAX_ATTEMPTS, lockedUntil]);
                throw new transaction_1.TransactionError(401, "OTP has expired");
            }
            // Mark OTP as used
            await client.query(`UPDATE magic_links SET is_used = true, attempts = attempts + 1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE id = $1`, [magicLink.id]);
            // Reset attempt counter on successful verification
            await client.query(`DELETE FROM otp_attempts WHERE email = $1`, [
                normalizedEmail,
            ]);
            // Check if user exists (case-insensitive)
            const userResult = await client.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email.toLowerCase()]);
            let user = userResult.rows[0];
            let isNewUser = false;
            let wallet = null;
            if (!user) {
                let username = (0, helpers_1.generateRandomUsername)();
                // check if username is already taken (case-insensitive)
                let usernameCheck = await client.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
                while (usernameCheck.rows.length > 0) {
                    username = (0, helpers_1.generateRandomUsername)();
                    usernameCheck = await client.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
                }
                // Create new user using model
                user = await User_1.UserModel.create({
                    email: email.toLowerCase(),
                    username: username,
                    display_name: username,
                }, client);
                isNewUser = true;
                // Create Circle wallet for deposits/withdrawals INSIDE transaction
                // If this fails, the entire transaction (including user creation) will rollback
                const circleWallet = (0, circleWallet_1.getCircleWallet)();
                if (!circleWallet.isAvailable()) {
                    console.error("[CircleWallet] Service not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables.");
                    throw new transaction_1.TransactionError(500, "Circle wallet service is not available");
                }
                console.log(`[CircleWallet] Creating wallet for user ${user.id}...`);
                let walletId;
                let address;
                try {
                    console.log(circleWallet);
                    const walletResult = await circleWallet.createUserWallet(user.id);
                    walletId = walletResult.walletId;
                    address = walletResult.address;
                    console.log(`[CircleWallet] Wallet created successfully: ${walletId}, address: ${address}`);
                }
                catch (error) {
                    console.error("[CircleWallet] Failed to create Circle wallet:", error.message || error, error.stack);
                    throw new transaction_1.TransactionError(500, `Failed to create wallet: ${error.message || "Unknown error"}. Please try again.`);
                }
                // Create wallet record in database using model (inside transaction)
                wallet = await Wallet_1.WalletModel.create({
                    user_id: user.id,
                    public_key: address,
                    circle_wallet_id: walletId,
                }, client);
                console.log(`[CircleWallet] Wallet record created in database for user ${user.id}`);
            }
            else {
                // Get existing wallet
                const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1`, [user.id]);
                wallet = walletResult.rows[0];
            }
            if (!wallet) {
                throw new transaction_1.TransactionError(500, "Failed to create wallet");
            }
            return { user, wallet, isNewUser };
        });
        // Generate JWT tokens
        const tokens = await (0, jwt_1.generateTokenPair)({
            id: result.user.id,
        });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        };
        res.cookie("accessToken", tokens.accessToken, cookieOptions);
        res.cookie("refreshToken", tokens.refreshToken, cookieOptions);
        const isAdmin = await Moodring_1.MoodringAdminModel.isAdmin(result.user.id);
        if (isAdmin) {
            result.user.isAdmin = true;
        }
        return (0, errors_1.sendSuccess)(res, {
            message: result.isNewUser
                ? "Account created successfully"
                : "Login successful",
            isNewUser: result.isNewUser,
            user: {
                id: result.user.id,
                email: result.user.email,
                username: result.user.username,
                display_name: result.user.display_name,
                created_at: result.user.created_at,
                isAdmin: isAdmin,
                wallet: {
                    id: result.wallet.id,
                    public_key: result.wallet.public_key,
                    created_at: result.wallet.created_at,
                    updated_at: result.wallet.updated_at,
                    balance_sol: result.wallet.balance_sol,
                    balance_usdc: result.wallet.balance_usdc,
                },
            },
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Verify magic link error:", error);
        return (0, errors_1.sendError)(res, 500, error.message ||
            "An error occurred during verification. Please try again.");
    }
};
exports.verifyMagicLink = verifyMagicLink;
/**
 * @route POST /api/auth/wallet/nonce
 * @desc Generate a nonce for wallet authentication (prevents replay attacks)
 * @access Public
 */
const generateWalletNonce = async (req, res) => {
    try {
        const { wallet_address } = req.body;
        if (!(0, validation_1.validateRequired)(wallet_address, "Wallet address").isValid) {
            return (0, errors_1.sendValidationError)(res, "Wallet address is required");
        }
        // Validate wallet address format
        let publicKey;
        try {
            publicKey = new web3_js_1.PublicKey(wallet_address);
        }
        catch {
            return (0, errors_1.sendValidationError)(res, "Invalid wallet address format");
        }
        // Normalize wallet address to base58 string (ensures consistent case)
        const normalizedAddress = publicKey.toBase58();
        // Generate cryptographically secure nonce
        const nonce = crypto_1.default.randomBytes(32).toString("hex");
        const expiresAt = Math.floor((Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000) / 1000); // Unix timestamp in seconds
        // Store nonce in database
        const insertResult = await db_1.pool.query(`INSERT INTO wallet_auth_nonces (nonce, wallet_address, expires_at, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [nonce, normalizedAddress, expiresAt, Math.floor(Date.now() / 1000)]);
        console.log("Nonce created:", {
            nonce,
            wallet_address: normalizedAddress,
            expires_at: expiresAt,
            created_at: insertResult.rows[0]?.created_at,
        });
        // Cleanup expired nonces (async, don't wait, only delete nonces older than expiry time)
        // Only clean up nonces that expired more than 1 minute ago to avoid race conditions
        db_1.pool
            .query(`DELETE FROM wallet_auth_nonces WHERE expires_at < EXTRACT(EPOCH FROM NOW())::BIGINT - 60`)
            .catch(() => { });
        // Return the message to be signed
        const message = `Sign this message to authenticate with MoodRing.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
        return (0, errors_1.sendSuccess)(res, {
            nonce,
            message,
            expires_at: expiresAt,
        });
    }
    catch (error) {
        console.error("Generate wallet nonce error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to generate nonce");
    }
};
exports.generateWalletNonce = generateWalletNonce;
/**
 * @route POST /api/auth/wallet/authenticate
 * @desc Authenticate with wallet address (creates user if doesn't exist)
 * @access Public
 */
const authenticateWithWallet = async (req, res) => {
    try {
        const { wallet_address, signature, message, nonce } = req.body;
        const validation = (0, validation_1.validateFields)([
            (0, validation_1.validateRequired)(wallet_address, "Wallet address"),
            (0, validation_1.validateRequired)(signature, "Signature"),
            (0, validation_1.validateRequired)(message, "Message"),
            (0, validation_1.validateRequired)(nonce, "Nonce"),
        ]);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        // Verify Solana signature first (before transaction)
        let publicKey;
        try {
            publicKey = new web3_js_1.PublicKey(wallet_address);
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = bs58_1.default.decode(signature);
            const isValid = tweetnacl_1.default.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
            if (!isValid) {
                return (0, errors_1.sendError)(res, 401, "Invalid signature");
            }
        }
        catch (error) {
            return (0, errors_1.sendError)(res, 401, "Signature verification failed");
        }
        // Normalize wallet address to base58 string (ensures consistent case)
        const normalizedAddress = publicKey.toBase58();
        // Verify the message contains the nonce
        if (!message.includes(nonce)) {
            return (0, errors_1.sendError)(res, 401, "Message does not contain the expected nonce");
        }
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // SECURITY FIX: Use SELECT FOR UPDATE SKIP LOCKED to prevent race conditions
            // This ensures only one request can claim the nonce
            const nonceResult = await client.query(`SELECT * FROM wallet_auth_nonces 
         WHERE nonce = $1 AND wallet_address = $2 AND used_at = 0
         ORDER BY created_at DESC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`, [nonce, normalizedAddress]);
            if (nonceResult.rows.length === 0) {
                // Check if nonce exists but is already used or doesn't match address
                const checkResult = await client.query(`SELECT * FROM wallet_auth_nonces WHERE nonce = $1`, [nonce]);
                if (checkResult.rows.length > 0) {
                    const record = checkResult.rows[0];
                    // Convert string values from PostgreSQL to numbers for comparison
                    const usedAt = Number(record.used_at);
                    const expiresAt = Number(record.expires_at);
                    const currentTime = Math.floor(Date.now() / 1000);
                    console.error("Nonce lookup failed - nonce exists but query didn't match:", {
                        nonce,
                        requestedAddress: normalizedAddress,
                        storedAddress: record.wallet_address,
                        addressesMatch: record.wallet_address === normalizedAddress,
                        usedAt,
                        usedAtIsZero: usedAt === 0,
                        expiresAt,
                        currentTime,
                        isExpired: currentTime > expiresAt,
                        queryConditions: {
                            nonceMatch: true,
                            addressMatch: record.wallet_address === normalizedAddress,
                            usedAtZero: usedAt === 0,
                        },
                    });
                    if (usedAt > 0) {
                        throw new transaction_1.TransactionError(401, "Nonce has already been used");
                    }
                    if (record.wallet_address !== normalizedAddress) {
                        throw new transaction_1.TransactionError(401, `Nonce does not match wallet address. Expected: ${normalizedAddress}, Got: ${record.wallet_address}`);
                    }
                    if (currentTime > expiresAt) {
                        throw new transaction_1.TransactionError(401, "Nonce has expired");
                    }
                    // If we get here, all checks passed but query still failed - this shouldn't happen
                    // Log detailed info for debugging
                    console.error("Nonce validation passed but query failed - possible database issue:", {
                        nonce,
                        normalizedAddress,
                        record,
                    });
                    throw new transaction_1.TransactionError(401, "Nonce validation failed unexpectedly");
                }
                // Nonce doesn't exist at all
                console.error("Nonce not found in database:", {
                    nonce,
                    normalizedAddress,
                });
                throw new transaction_1.TransactionError(401, "Invalid or expired nonce");
            }
            const nonceRecord = nonceResult.rows[0];
            const expiresAt = Number(nonceRecord.expires_at);
            // Check if nonce has expired
            if (Math.floor(Date.now() / 1000) > expiresAt) {
                throw new transaction_1.TransactionError(401, "Nonce has expired. Please request a new one.");
            }
            // SECURITY FIX: Mark nonce as used IMMEDIATELY (before signature verification)
            // This prevents race conditions - if signature verification fails, we still
            // mark nonce as used to prevent replay attacks
            await client.query(`UPDATE wallet_auth_nonces SET used_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`, [nonceRecord.id]);
            // Check if user exists (case-insensitive)
            const userResult = await client.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [wallet_address.toLowerCase()]);
            let user = userResult.rows[0];
            let isNewUser = false;
            let wallet = null;
            // Create user if doesn't exist using model
            if (!user) {
                user = await User_1.UserModel.create({
                    username: wallet_address.toLowerCase(),
                    display_name: (0, helpers_1.generateRandomUsername)(),
                    email: undefined,
                }, client);
                isNewUser = true;
                // Create Circle wallet for deposits/withdrawals INSIDE transaction
                // If this fails, the entire transaction (including user creation) will rollback
                const circleWallet = (0, circleWallet_1.getCircleWallet)();
                if (!circleWallet.isAvailable()) {
                    console.error("[CircleWallet] Service not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables.");
                    throw new transaction_1.TransactionError(500, "Circle wallet service is not available");
                }
                console.log(`[CircleWallet] Creating wallet for user ${user.id}...`);
                let walletId;
                let address;
                try {
                    const walletResult = await circleWallet.createUserWallet(user.id);
                    walletId = walletResult.walletId;
                    address = walletResult.address;
                    console.log(`[CircleWallet] Wallet created successfully: ${walletId}, address: ${address}`);
                }
                catch (error) {
                    console.error("[CircleWallet] Failed to create Circle wallet:", error.message || error, error.stack);
                    throw new transaction_1.TransactionError(500, `Failed to create wallet: ${error.message || "Unknown error"}. Please try again.`);
                }
                // Create wallet record in database using model (inside transaction)
                wallet = await Wallet_1.WalletModel.create({
                    user_id: user.id,
                    public_key: address,
                    circle_wallet_id: walletId,
                }, client);
                console.log(`[CircleWallet] Wallet record created in database for user ${user.id}`);
            }
            else {
                // Get existing wallet
                const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1`, [user.id]);
                wallet = walletResult.rows[0];
            }
            if (!wallet) {
                throw new transaction_1.TransactionError(500, "Failed to create wallet");
            }
            return { user, wallet, isNewUser };
        });
        // Generate JWT tokens
        const tokens = await (0, jwt_1.generateTokenPair)({
            id: result.user.id,
        });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        };
        res.cookie("accessToken", tokens.accessToken, cookieOptions);
        res.cookie("refreshToken", tokens.refreshToken, cookieOptions);
        const isAdmin = await Moodring_1.MoodringAdminModel.isAdmin(result.user.id);
        if (isAdmin) {
            result.user.isAdmin = true;
        }
        console.log("result", result);
        return (0, errors_1.sendSuccess)(res, {
            message: result.isNewUser
                ? "Account created successfully"
                : "Login successful",
            isNewUser: result.isNewUser,
            user: {
                id: result.user.id,
                email: result.user.email,
                username: result.user.username,
                display_name: result.user.display_name || null,
                created_at: result.user.created_at,
                isAdmin: isAdmin,
                wallet: {
                    id: result.wallet.id,
                    public_key: result.wallet.public_key,
                    created_at: result.wallet.created_at,
                    updated_at: result.wallet.updated_at,
                    balance_sol: result.wallet.balance_sol,
                    balance_usdc: result.wallet.balance_usdc,
                },
            },
        }, result.isNewUser ? 201 : 200);
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Wallet authentication error:", error);
        return (0, errors_1.sendError)(res, 500, error.message ||
            "An error occurred during authentication. Please try again.");
    }
};
exports.authenticateWithWallet = authenticateWithWallet;
/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token (with token rotation)
 * @access Public
 */
const refreshAccessToken = async (req, res) => {
    try {
        const oldRefreshToken = req.cookies.refreshToken;
        if (!oldRefreshToken) {
            return (0, errors_1.sendValidationError)(res, "Refresh token is required");
        }
        // Verify refresh token
        let payload;
        try {
            payload = await (0, jwt_1.verifyRefreshToken)(oldRefreshToken);
        }
        catch (error) {
            return (0, errors_1.sendError)(res, 403, "Invalid refresh token", {
                message: error instanceof Error ? error.message : "Token expired",
            });
        }
        // Check if refresh token has been revoked
        const isRevoked = await (0, revocation_1.isTokenRevoked)(oldRefreshToken);
        if (isRevoked) {
            return (0, errors_1.sendError)(res, 403, "Refresh token revoked", {
                message: "This refresh token has been revoked. Please login again.",
            });
        }
        // Verify user still exists
        const user = await User_1.UserModel.findById(payload.id);
        if (!user) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        // Revoke old refresh token (token rotation for security)
        try {
            await (0, revocation_1.revokeToken)(oldRefreshToken, user.id, "refresh");
        }
        catch (error) {
            console.error("Error revoking old refresh token:", error);
            // Continue anyway - new token will still be valid
        }
        // Generate new token pair (both access AND refresh tokens)
        const tokens = await (0, jwt_1.generateTokenPair)({
            id: user.id,
        });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        };
        res.cookie("accessToken", tokens.accessToken, cookieOptions);
        res.cookie("refreshToken", tokens.refreshToken, cookieOptions);
        return (0, errors_1.sendSuccess)(res, {
            message: "Token refreshed successfully",
            accessToken: tokens.accessToken,
        });
    }
    catch (error) {
        console.error("Token refresh error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "An error occurred. Please login again.");
    }
};
exports.refreshAccessToken = refreshAccessToken;
/**
 * @route GET /api/auth/me
 * @desc Get current user info (requires authentication)
 * @access Private
 */
const getCurrentUser = async (req, res) => {
    try {
        if (!req.id) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const user = await User_1.UserModel.findById(req.id);
        if (!user) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        // check if user is admin
        const isAdmin = await Moodring_1.MoodringAdminModel.isAdmin(user.id);
        if (isAdmin) {
            user.isAdmin = true;
        }
        const wallet = await Wallet_1.WalletModel.findByUserId(user.id);
        if (!wallet) {
            return (0, errors_1.sendNotFound)(res, "Wallet");
        }
        return (0, errors_1.sendSuccess)(res, {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                display_name: user.display_name || null,
                avatar_url: user.avatar_url || null,
                created_at: user.created_at,
                updated_at: user.updated_at,
                isAdmin: isAdmin,
                wallet: {
                    id: wallet.id,
                    public_key: wallet.public_key,
                    created_at: wallet.created_at,
                    updated_at: wallet.updated_at,
                    balance_sol: wallet.balance_sol,
                    balance_usdc: wallet.balance_usdc,
                },
            },
        });
    }
    catch (error) {
        console.error("Get current user error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "An error occurred. Please try again.");
    }
};
exports.getCurrentUser = getCurrentUser;
/**
 * @route POST /api/auth/logout
 * @desc Logout user and revoke tokens
 * @access Private
 */
const logout = async (req, res) => {
    try {
        if (!req.id) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const authHeader = req.headers["authorization"];
        let accessToken = authHeader && authHeader.split(" ")[1];
        let refreshToken = req.cookies.refreshToken;
        !accessToken && (accessToken = req.cookies.accessToken || "");
        !refreshToken && (refreshToken = req.cookies.refreshToken || "");
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        };
        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);
        // Revoke the access token if provided
        if (accessToken) {
            try {
                await (0, revocation_1.revokeToken)(accessToken, req.id, "access");
            }
            catch (error) {
                console.error("Error revoking access token:", error);
            }
        }
        // If refresh token is provided in body, revoke it too
        if (refreshToken) {
            try {
                await (0, revocation_1.revokeToken)(refreshToken, req.id, "refresh");
            }
            catch (error) {
                console.error("Error revoking refresh token:", error);
            }
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Logged out successfully",
        });
    }
    catch (error) {
        console.error("Logout error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "An error occurred during logout.");
    }
};
exports.logout = logout;
//# sourceMappingURL=controller_auth.js.map