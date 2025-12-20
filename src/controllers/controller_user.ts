import { Response } from "express";
import { pool } from "../db";
import { WalletModel } from "../models/Wallet";
import { getCircleWallet } from "../services/circleWallet";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../utils/errors";
import { validateRequired, validateLength } from "../utils/validation";
import { isReservedDisplayName } from "../utils/reservedNames";
import { validateImage } from "../utils/contentModeration";
import { uploadImageToS3 } from "../utils/metadata";
import {
  GetPublicUserByIdRequest,
  GetUserProfileRequest,
  UpdateCurrentUserRequest,
  DeleteCurrentUserRequest,
  GenerateWalletRequest,
  UploadAvatarRequest,
} from "../types/requests";

/**
 * @route GET /api/user/:id
 * @desc Get public user profile by ID (limited data)
 * @access Public
 */
export const getPublicUserById = async (
  req: GetPublicUserByIdRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    // Only return public-safe fields
    const result = await pool.query(
      "SELECT id, username, display_name, created_at FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    return sendSuccess(res, { user: result.rows[0] });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return sendError(res, 500, "Failed to get user profile");
  }
};

/**
 * @route GET /api/user/:id/profile
 * @desc Get detailed public user profile with stats
 * @access Public
 */
export const getUserProfile = async (
  req: GetUserProfileRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    // Get user with social stats
    const userResult = await pool.query(
      `SELECT 
        u.id, 
        u.username, 
        u.display_name, 
        u.bio,
        u.avatar_url,
        u.created_at,
        COALESCE(u.followers_count, 0)::int as followers_count,
        COALESCE(u.following_count, 0)::int as following_count,
        COALESCE(u.posts_count, 0)::int as posts_count
      FROM users u 
      WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    const user = userResult.rows[0];

    // Get trading stats from user_stats table (if exists) or calculate from trades
    const statsResult = await pool.query(
      `SELECT 
        COALESCE(us.total_trades, 0)::int as total_trades,
        COALESCE(us.winning_trades, 0)::int as winning_trades,
        COALESCE(us.total_profit_loss, 0) as total_pnl
      FROM users u
      LEFT JOIN user_stats us ON us.user_id = u.id
      WHERE u.id = $1`,
      [id]
    );

    // If no stats found, try calculating from trades count
    let stats = statsResult.rows[0];
    if (!stats || stats.total_trades === 0) {
      const tradesCount = await pool.query(
        `SELECT COUNT(*)::int as total_trades FROM trades WHERE user_id = $1`,
        [id]
      );
      stats = {
        total_trades: tradesCount.rows[0]?.total_trades || 0,
        winning_trades: 0,
        total_pnl: 0,
      };
    }

    const winRate =
      stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0;

    return sendSuccess(res, {
      user: {
        ...user,
        total_trades: stats.total_trades,
        total_pnl: parseFloat(stats.total_pnl) || 0,
        win_rate: winRate,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return sendError(res, 500, "Failed to get user profile");
  }
};

/**
 * @route PUT /api/user/me
 * @desc Update current authenticated user's profile
 * @access Private
 */
export const updateCurrentUser = async (
  req: UpdateCurrentUserRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const { username, display_name } = req.body;

    // Check if user exists
    const checkUser = await pool.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    if (checkUser.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    const currentUser = checkUser.rows[0];

    // Prevent username editing - usernames cannot be changed
    if (username !== undefined) {
      return sendError(
        res,
        403,
        "Username cannot be changed. Usernames are permanent."
      );
    }

    // Build dynamic update query - only allow safe fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      // Validate display name
      const displayNameValidation = validateLength(
        display_name,
        "Display name",
        1,
        50
      );
      if (!displayNameValidation.isValid) {
        return sendValidationError(res, displayNameValidation.error!);
      }

      // Check if display name is reserved
      if (isReservedDisplayName(display_name)) {
        return sendError(
          res,
          403,
          "This display name is reserved and cannot be used. Please choose a different name."
        );
      }

      // Check if display name is different from current
      const isChangingDisplayName =
        currentUser.display_name?.toLowerCase() !== display_name.toLowerCase();

      if (isChangingDisplayName) {
        // Check 30-day restriction
        if (currentUser.display_name_changed_at) {
          const lastChanged = new Date(currentUser.display_name_changed_at);
          const now = new Date();
          const daysSinceChange =
            (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceChange < 30) {
            const daysRemaining = Math.ceil(30 - daysSinceChange);
            return sendError(
              res,
              429,
              `Display name can only be changed once every 30 days. Please wait ${daysRemaining} more day${
                daysRemaining !== 1 ? "s" : ""
              }.`
            );
          }
        }

        // Check if display name is already taken by another user (case-insensitive)
        const displayNameCheck = await pool.query(
          `SELECT id FROM users WHERE LOWER(display_name) = LOWER($1) AND id != $2`,
          [display_name, userId]
        );
        if (displayNameCheck.rows.length > 0) {
          return sendError(res, 409, "Display name already exists");
        }

        // Update display name and set the changed timestamp
        updates.push(`display_name = $${paramCount}`);
        values.push(display_name);
        paramCount++;
        updates.push(`display_name_changed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (updates.length === 0) {
      return sendValidationError(res, "No valid fields to update");
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    if (updates.length === 0) {
      return sendValidationError(res, "No valid fields to update");
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, username, display_name, created_at, updated_at, display_name_changed_at
    `;

    const result = await pool.query(query, values);

    return sendSuccess(res, {
      message: "Profile updated successfully",
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error("Update user error:", error);

    // Handle unique constraint violation for display_name
    if (error.code === "23505") {
      if (
        error.constraint?.includes("display_name") ||
        error.constraint?.includes("idx_users_display_name_unique")
      ) {
        return sendError(res, 409, "Display name already exists");
      }
      if (error.constraint?.includes("username")) {
        return sendError(res, 409, "Username already exists");
      }
    }

    return sendError(res, 500, "Failed to update profile");
  }
};

/**
 * @route POST /api/user/me/avatar
 * @desc Upload avatar/profile picture for current authenticated user
 * @access Private
 */
export const uploadAvatar = async (req: UploadAvatarRequest, res: Response) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    // Check if file was uploaded
    if (!req.file) {
      return sendValidationError(res, "Image file is required");
    }

    // Check if user exists
    const checkUser = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);

    if (checkUser.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    // Validate image (file type, size, and NSFW content)
    const validation = await validateImage(req.file.buffer, req.file.mimetype);
    if (!validation.isValid) {
      return sendValidationError(res, validation.error || "Invalid image");
    }

    // Upload to S3
    if (!process.env.S3_BUCKET) {
      console.warn("AWS S3 bucket not configured for image upload");
      return sendError(res, 500, "Storage not configured");
    }

    let avatarUrl: string;
    try {
      avatarUrl = await uploadImageToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        process.env.S3_BUCKET
      );
    } catch (error) {
      console.error("Failed to upload avatar to S3:", error);
      return sendError(res, 500, "Failed to upload avatar");
    }

    // Update user's avatar_url in database
    const result = await pool.query(
      `UPDATE users 
       SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, username, display_name, avatar_url, created_at, updated_at`,
      [avatarUrl, userId]
    );

    return sendSuccess(res, {
      message: "Avatar uploaded successfully",
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error("Upload avatar error:", error);
    return sendError(res, 500, "Failed to upload avatar");
  }
};

/**
 * @route DELETE /api/user/me
 * @desc Delete current authenticated user's account
 * @access Private
 */
export const deleteCurrentUser = async (
  req: DeleteCurrentUserRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    // Check if user exists
    const checkUser = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);

    if (checkUser.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    // Delete the user (cascading deletes should handle related data)
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [userId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    return sendSuccess(res, {
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return sendError(res, 500, "Failed to delete account");
  }
};

/**
 * @route POST /api/user/wallet/generate
 * @desc Generate or replace user's wallet (deletes old wallet if exists)
 * @access Private (requires authentication)
 */
export const generateWallet = async (
  req: GenerateWalletRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    // Check if user exists
    const user = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);

    if (user.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    // Replace wallet (deletes old and creates new Circle wallet)
    const circleWallet = getCircleWallet();
    if (!circleWallet.isAvailable()) {
      return sendError(res, 500, "Circle wallet service is not available");
    }

    const { walletId, address } = await circleWallet.createUserWallet(userId);
    const wallet = await WalletModel.replaceWallet(userId, walletId, address);

    return sendSuccess(res, {
      message: "Wallet generated successfully",
      wallet: {
        id: wallet.id,
        public_key: wallet.public_key,
        created_at: wallet.created_at,
        updated_at: wallet.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Generate wallet error:", error);
    return sendError(res, 500, "Failed to generate wallet");
  }
};
