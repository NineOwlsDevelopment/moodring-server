import { Response } from "express";
import crypto from "crypto";
import { pool } from "../db";
import { UserModel } from "../models/User";
import { generateOTP, sendOTPEmail, sendWelcomeEmail } from "../utils/email";
import {
  generateTokenPair,
  verifyRefreshToken,
  generateAccessToken,
} from "../utils/jwt";
import { revokeToken, isTokenRevoked } from "../utils/revocation";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { generateRandomUsername } from "../utils/helpers";
import { WalletModel } from "../models/Wallet";
import { withTransaction, TransactionError } from "../utils/transaction";
import { getCircleWallet } from "../services/circleWallet";
import {
  sendError,
  sendSuccess,
  sendValidationError,
  sendNotFound,
} from "../utils/errors";
import { validateRequired, validateFields } from "../utils/validation";
import {
  RequestMagicLinkRequest,
  VerifyMagicLinkRequest,
  GenerateWalletNonceRequest,
  AuthenticateWithWalletRequest,
  RefreshAccessTokenRequest,
  GetCurrentUserRequest,
  LogoutRequest,
} from "../types/requests";
import { MoodringAdminModel } from "../models/Moodring";

// Constants for security
const NONCE_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MINUTES = 15;

/**
 * @route POST /api/auth/magic-link/request
 * @desc Request magic link (OTP) via email
 * @access Public
 */
export const requestMagicLink = async (
  req: RequestMagicLinkRequest,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return sendValidationError(res, "Valid email is required");
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await pool.query(
      `INSERT INTO magic_links (email, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [email.toLowerCase(), otp, expiresAt]
    );

    // Send OTP email
    await sendOTPEmail(email, otp);

    return sendSuccess(res, {
      message: "OTP sent to your email",
      email: email.toLowerCase(),
      expiresIn: "10 minutes",
    });
  } catch (error: any) {
    console.error("Request magic link error:", error);
    return sendError(res, 500, error.message || "Failed to send OTP");
  }
};

/**
 * @route POST /api/auth/magic-link/verify
 * @desc Verify OTP and login/signup user
 * @access Public
 */
export const verifyMagicLink = async (
  req: VerifyMagicLinkRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, otp } = req.body;

    const validation = validateFields([
      validateRequired(otp, "OTP"),
      validateRequired(email, "Email"),
    ]);
    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    const normalizedEmail = email.toLowerCase();

    // Check for lockout first (before any DB transaction)
    const lockoutResult = await pool.query(
      `SELECT * FROM otp_attempts WHERE email = $1`,
      [normalizedEmail]
    );

    if (lockoutResult.rows.length > 0) {
      const attemptRecord = lockoutResult.rows[0];

      // Check if locked out
      if (
        attemptRecord.locked_until &&
        new Date() < new Date(attemptRecord.locked_until)
      ) {
        const remainingMinutes = Math.ceil(
          (new Date(attemptRecord.locked_until).getTime() - Date.now()) / 60000
        );
        return sendError(res, 429, "Too many failed attempts", {
          message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
        });
      }
    }

    const result = await withTransaction(async (client) => {
      // Find the magic link entry with lock
      const magicLinkResult = await client.query(
        `SELECT * FROM magic_links 
         WHERE email = $1 AND token = $2 AND is_used = false 
         ORDER BY created_at DESC LIMIT 1
         FOR UPDATE`,
        [normalizedEmail, otp]
      );

      // Track attempt regardless of whether OTP was found (prevents brute force)
      if (magicLinkResult.rows.length === 0) {
        // Increment attempt counter for this email
        await client.query(
          `INSERT INTO otp_attempts (email, attempts, last_attempt_at)
           VALUES ($1, 1, NOW())
           ON CONFLICT (email) DO UPDATE SET 
             attempts = otp_attempts.attempts + 1,
             last_attempt_at = NOW(),
             locked_until = CASE 
               WHEN otp_attempts.attempts + 1 >= $2 
               THEN NOW() + $3 * INTERVAL '1 minute'
               ELSE otp_attempts.locked_until 
             END`,
          [normalizedEmail, OTP_MAX_ATTEMPTS, OTP_LOCKOUT_MINUTES]
        );

        throw new TransactionError(401, "Invalid or expired OTP");
      }

      const magicLink = magicLinkResult.rows[0];

      // Check if OTP has expired
      if (new Date() > new Date(magicLink.expires_at)) {
        // Also count as failed attempt
        await client.query(
          `INSERT INTO otp_attempts (email, attempts, last_attempt_at)
           VALUES ($1, 1, NOW())
           ON CONFLICT (email) DO UPDATE SET 
             attempts = otp_attempts.attempts + 1,
             last_attempt_at = NOW(),
             locked_until = CASE 
               WHEN otp_attempts.attempts + 1 >= $2 
               THEN NOW() + $3 * INTERVAL '1 minute'
               ELSE otp_attempts.locked_until 
             END`,
          [normalizedEmail, OTP_MAX_ATTEMPTS, OTP_LOCKOUT_MINUTES]
        );

        throw new TransactionError(401, "OTP has expired");
      }

      // Mark OTP as used
      await client.query(
        `UPDATE magic_links SET is_used = true, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [magicLink.id]
      );

      // Reset attempt counter on successful verification
      await client.query(`DELETE FROM otp_attempts WHERE email = $1`, [
        normalizedEmail,
      ]);

      // Check if user exists (case-insensitive)
      const userResult = await client.query(
        `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`,
        [email.toLowerCase()]
      );
      let user = userResult.rows[0];
      let isNewUser = false;
      let wallet = null;

      if (!user) {
        let username = generateRandomUsername();

        // check if username is already taken (case-insensitive)
        let usernameCheck = await client.query(
          `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
          [username]
        );
        while (usernameCheck.rows.length > 0) {
          username = generateRandomUsername();
          usernameCheck = await client.query(
            `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
            [username]
          );
        }

        // Create new user
        const userInsertResult = await client.query(
          `INSERT INTO users (email, username, display_name) VALUES ($1, $2, $3) RETURNING *`,
          [email.toLowerCase(), username, username]
        );
        user = userInsertResult.rows[0];
        isNewUser = true;

        // Create Circle wallet for deposits/withdrawals INSIDE transaction
        // If this fails, the entire transaction (including user creation) will rollback
        const circleWallet = getCircleWallet();
        if (!circleWallet.isAvailable()) {
          console.error(
            "[CircleWallet] Service not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables."
          );
          throw new TransactionError(
            500,
            "Circle wallet service is not available"
          );
        }

        console.log(`[CircleWallet] Creating wallet for user ${user.id}...`);
        let walletId: string;
        let address: string;
        try {
          console.log(circleWallet);
          const walletResult = await circleWallet.createUserWallet(user.id);
          walletId = walletResult.walletId;
          address = walletResult.address;
          console.log(
            `[CircleWallet] Wallet created successfully: ${walletId}, address: ${address}`
          );
        } catch (error: any) {
          console.error(
            "[CircleWallet] Failed to create Circle wallet:",
            error.message || error,
            error.stack
          );
          throw new TransactionError(
            500,
            `Failed to create wallet: ${
              error.message || "Unknown error"
            }. Please try again.`
          );
        }

        // Create wallet record in database (inside transaction)
        const walletInsertResult = await client.query(
          `INSERT INTO wallets (user_id, public_key, circle_wallet_id) 
           VALUES ($1, $2, $3) RETURNING *`,
          [user.id, address, walletId]
        );
        wallet = walletInsertResult.rows[0];
        console.log(
          `[CircleWallet] Wallet record created in database for user ${user.id}`
        );
      } else {
        // Get existing wallet
        const walletResult = await client.query(
          `SELECT * FROM wallets WHERE user_id = $1`,
          [user.id]
        );
        wallet = walletResult.rows[0];
      }

      if (!wallet) {
        throw new TransactionError(500, "Failed to create wallet");
      }

      return { user, wallet, isNewUser };
    });

    // Send welcome email (non-blocking, outside transaction)
    if (result.isNewUser) {
      sendWelcomeEmail(email.toLowerCase()).catch((err) =>
        console.error("Failed to send welcome email:", err)
      );
    }

    // Generate JWT tokens
    const tokens = generateTokenPair({
      id: result.user.id,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    };

    res.cookie("accessToken", tokens.accessToken, cookieOptions);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    const isAdmin = await MoodringAdminModel.isAdmin(result.user.id);
    if (isAdmin) {
      result.user.isAdmin = true;
    }

    return sendSuccess(res, {
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
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Verify magic link error:", error);
    return sendError(
      res,
      500,
      error.message ||
        "An error occurred during verification. Please try again."
    );
  }
};

/**
 * @route POST /api/auth/wallet/nonce
 * @desc Generate a nonce for wallet authentication (prevents replay attacks)
 * @access Public
 */
export const generateWalletNonce = async (
  req: GenerateWalletNonceRequest,
  res: Response
): Promise<void> => {
  try {
    const { wallet_address } = req.body;

    if (!validateRequired(wallet_address, "Wallet address").isValid) {
      return sendValidationError(res, "Wallet address is required");
    }

    // Validate wallet address format
    try {
      new PublicKey(wallet_address);
    } catch {
      return sendValidationError(res, "Invalid wallet address format");
    }

    // Generate cryptographically secure nonce
    const nonce = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    // Store nonce in database
    await pool.query(
      `INSERT INTO wallet_auth_nonces (nonce, wallet_address, expires_at)
       VALUES ($1, $2, $3)`,
      [nonce, wallet_address, expiresAt]
    );

    // Cleanup expired nonces (async, don't wait)
    pool
      .query(`DELETE FROM wallet_auth_nonces WHERE expires_at < NOW()`)
      .catch(() => {});

    // Return the message to be signed
    const message = `Sign this message to authenticate with MoodRing.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

    return sendSuccess(res, {
      nonce,
      message,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Generate wallet nonce error:", error);
    return sendError(res, 500, error.message || "Failed to generate nonce");
  }
};

/**
 * @route POST /api/auth/wallet/authenticate
 * @desc Authenticate with wallet address (creates user if doesn't exist)
 * @access Public
 */
export const authenticateWithWallet = async (
  req: AuthenticateWithWalletRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { wallet_address, signature, message, nonce } = req.body;

    const validation = validateFields([
      validateRequired(wallet_address, "Wallet address"),
      validateRequired(signature, "Signature"),
      validateRequired(message, "Message"),
      validateRequired(nonce, "Nonce"),
    ]);
    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    // Verify Solana signature first (before transaction)
    try {
      const publicKey = new PublicKey(wallet_address);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );

      if (!isValid) {
        return sendError(res, 401, "Invalid signature");
      }
    } catch (error: any) {
      return sendError(res, 401, "Signature verification failed");
    }

    // Verify the message contains the nonce
    if (!message.includes(nonce)) {
      return sendError(res, 401, "Message does not contain the expected nonce");
    }

    const result = await withTransaction(async (client) => {
      // Verify nonce exists and is valid (within transaction with lock)
      const nonceResult = await client.query(
        `SELECT * FROM wallet_auth_nonces 
         WHERE nonce = $1 AND wallet_address = $2 AND used_at IS NULL
         FOR UPDATE`,
        [nonce, wallet_address]
      );

      if (nonceResult.rows.length === 0) {
        throw new TransactionError(401, "Invalid or expired nonce");
      }

      const nonceRecord = nonceResult.rows[0];

      // Check if nonce has expired
      if (new Date() > new Date(nonceRecord.expires_at)) {
        throw new TransactionError(
          401,
          "Nonce has expired. Please request a new one."
        );
      }

      // Mark nonce as used AFTER successful signature verification (prevents replay)
      await client.query(
        `UPDATE wallet_auth_nonces SET used_at = NOW() WHERE id = $1`,
        [nonceRecord.id]
      );

      // Check if user exists (case-insensitive)
      const userResult = await client.query(
        `SELECT * FROM users WHERE LOWER(username) = LOWER($1)`,
        [wallet_address.toLowerCase()]
      );
      let user = userResult.rows[0];
      let isNewUser = false;
      let wallet = null;

      // Create user if doesn't exist
      if (!user) {
        const userInsertResult = await client.query(
          `INSERT INTO users (username, display_name, email) VALUES ($1, $2, $3) RETURNING *`,
          [wallet_address.toLowerCase(), generateRandomUsername(), null]
        );
        user = userInsertResult.rows[0];
        isNewUser = true;

        // Create Circle wallet for deposits/withdrawals INSIDE transaction
        // If this fails, the entire transaction (including user creation) will rollback
        const circleWallet = getCircleWallet();
        if (!circleWallet.isAvailable()) {
          console.error(
            "[CircleWallet] Service not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables."
          );
          throw new TransactionError(
            500,
            "Circle wallet service is not available"
          );
        }

        console.log(`[CircleWallet] Creating wallet for user ${user.id}...`);
        let walletId: string;
        let address: string;

        try {
          const walletResult = await circleWallet.createUserWallet(user.id);
          walletId = walletResult.walletId;
          address = walletResult.address;
          console.log(
            `[CircleWallet] Wallet created successfully: ${walletId}, address: ${address}`
          );
        } catch (error: any) {
          console.error(
            "[CircleWallet] Failed to create Circle wallet:",
            error.message || error,
            error.stack
          );
          throw new TransactionError(
            500,
            `Failed to create wallet: ${
              error.message || "Unknown error"
            }. Please try again.`
          );
        }

        // Create wallet record in database (inside transaction)
        const walletInsertResult = await client.query(
          `INSERT INTO wallets (user_id, public_key, circle_wallet_id) 
           VALUES ($1, $2, $3) RETURNING *`,
          [user.id, address, walletId]
        );
        wallet = walletInsertResult.rows[0];
        console.log(
          `[CircleWallet] Wallet record created in database for user ${user.id}`
        );
      } else {
        // Get existing wallet
        const walletResult = await client.query(
          `SELECT * FROM wallets WHERE user_id = $1`,
          [user.id]
        );
        wallet = walletResult.rows[0];
      }

      if (!wallet) {
        throw new TransactionError(500, "Failed to create wallet");
      }

      return { user, wallet, isNewUser };
    });

    // Generate JWT tokens
    const tokens = generateTokenPair({
      id: result.user.id,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    };

    res.cookie("accessToken", tokens.accessToken, cookieOptions);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    const isAdmin = await MoodringAdminModel.isAdmin(result.user.id);
    if (isAdmin) {
      result.user.isAdmin = true;
    }

    console.log("result", result);

    return sendSuccess(
      res,
      {
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
      },
      result.isNewUser ? 201 : 200
    );
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Wallet authentication error:", error);
    return sendError(
      res,
      500,
      error.message ||
        "An error occurred during authentication. Please try again."
    );
  }
};

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token (with token rotation)
 * @access Public
 */
export const refreshAccessToken = async (
  req: RefreshAccessTokenRequest,
  res: Response
): Promise<void> => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      return sendValidationError(res, "Refresh token is required");
    }

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch (error) {
      return sendError(res, 403, "Invalid refresh token", {
        message: error instanceof Error ? error.message : "Token expired",
      });
    }

    // Check if refresh token has been revoked
    const isRevoked = await isTokenRevoked(oldRefreshToken);

    if (isRevoked) {
      return sendError(res, 403, "Refresh token revoked", {
        message: "This refresh token has been revoked. Please login again.",
      });
    }

    // Verify user still exists
    const user = await UserModel.findById(payload.id);

    if (!user) {
      return sendNotFound(res, "User");
    }

    // Revoke old refresh token (token rotation for security)
    try {
      await revokeToken(oldRefreshToken, user.id, "refresh");
    } catch (error) {
      console.error("Error revoking old refresh token:", error);
      // Continue anyway - new token will still be valid
    }

    // Generate new token pair (both access AND refresh tokens)
    const tokens = generateTokenPair({
      id: user.id,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    };

    res.cookie("accessToken", tokens.accessToken, cookieOptions);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    return sendSuccess(res, {
      message: "Token refreshed successfully",
      accessToken: tokens.accessToken,
    });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    return sendError(
      res,
      500,
      error.message || "An error occurred. Please login again."
    );
  }
};

/**
 * @route GET /api/auth/me
 * @desc Get current user info (requires authentication)
 * @access Private
 */
export const getCurrentUser = async (
  req: GetCurrentUserRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.id) {
      return sendError(res, 401, "Unauthorized");
    }
    const user = await UserModel.findById(req.id);

    if (!user) {
      return sendNotFound(res, "User");
    }

    // check if user is admin
    const isAdmin = await MoodringAdminModel.isAdmin(user.id);
    if (isAdmin) {
      user.isAdmin = true;
    }

    const wallet = await WalletModel.findByUserId(user.id);

    if (!wallet) {
      return sendNotFound(res, "Wallet");
    }

    return sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name || null,
        avatar_url: (user as any).avatar_url || null,
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
  } catch (error: any) {
    console.error("Get current user error:", error);
    return sendError(
      res,
      500,
      error.message || "An error occurred. Please try again."
    );
  }
};

/**
 * @route POST /api/auth/logout
 * @desc Logout user and revoke tokens
 * @access Private
 */
export const logout = async (
  req: LogoutRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.id) {
      return sendError(res, 401, "Unauthorized");
    }
    const authHeader = req.headers["authorization"];
    let accessToken = authHeader && authHeader.split(" ")[1];
    let refreshToken = req.cookies.refreshToken;

    !accessToken && (accessToken = req.cookies.accessToken || "");
    !refreshToken && (refreshToken = req.cookies.refreshToken || "");

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    };

    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);

    // Revoke the access token if provided
    if (accessToken) {
      try {
        await revokeToken(accessToken, req.id, "access");
      } catch (error) {
        console.error("Error revoking access token:", error);
      }
    }

    // If refresh token is provided in body, revoke it too
    if (refreshToken) {
      try {
        await revokeToken(refreshToken, req.id, "refresh");
      } catch (error) {
        console.error("Error revoking refresh token:", error);
      }
    }

    return sendSuccess(res, {
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    return sendError(
      res,
      500,
      error.message || "An error occurred during logout."
    );
  }
};
