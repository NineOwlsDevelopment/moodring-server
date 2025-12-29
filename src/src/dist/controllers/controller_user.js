"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWallet = exports.getFollowStatus = exports.unfollowUser = exports.followUser = exports.getUserPosts = exports.deleteCurrentUser = exports.uploadAvatar = exports.updateCurrentUser = exports.getUserProfile = exports.getPublicUserById = void 0;
const db_1 = require("../db");
const Wallet_1 = require("../models/Wallet");
const circleWallet_1 = require("../services/circleWallet");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const reservedNames_1 = require("../utils/reservedNames");
const contentModeration_1 = require("../utils/contentModeration");
const metadata_1 = require("../utils/metadata");
const Post_1 = require("../models/Post");
/**
 * @route GET /api/user/:id
 * @desc Get public user profile by ID (limited data)
 * @access Public
 */
const getPublicUserById = async (req, res) => {
    try {
        const { id } = req.params;
        // Only return public-safe fields
        const result = await db_1.pool.query("SELECT id, username, display_name, created_at FROM users WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        return (0, errors_1.sendSuccess)(res, { user: result.rows[0] });
    }
    catch (error) {
        console.error("Get user by ID error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to get user profile");
    }
};
exports.getPublicUserById = getPublicUserById;
/**
 * @route GET /api/profile/:id
 * @desc Get detailed public user profile with stats
 * @access Public
 * @note Supports both username and UUID as identifier
 */
const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if id is a UUID (36 chars with dashes) or username
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        // Get user with social stats - support both UUID and username
        const userResult = await db_1.pool.query(`SELECT 
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
      WHERE ${isUUID ? "u.id = $1" : "u.username = $1"}`, [id]);
        if (userResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        const user = userResult.rows[0];
        const userId = user.id;
        // Get trading stats from user_stats table (if exists) or calculate from trades
        const statsResult = await db_1.pool.query(`SELECT 
        COALESCE(us.total_trades, 0)::int as total_trades,
        COALESCE(us.winning_trades, 0)::int as winning_trades,
        COALESCE(us.total_profit_loss, 0) as total_pnl
      FROM users u
      LEFT JOIN user_stats us ON us.user_id = u.id
      WHERE u.id = $1`, [userId]);
        // If no stats found, try calculating from trades count
        let stats = statsResult.rows[0];
        if (!stats || stats.total_trades === 0) {
            const tradesCount = await db_1.pool.query(`SELECT COUNT(*)::int as total_trades FROM trades WHERE user_id = $1`, [userId]);
            stats = {
                total_trades: tradesCount.rows[0]?.total_trades || 0,
                winning_trades: 0,
                total_pnl: 0,
            };
        }
        const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0;
        return (0, errors_1.sendSuccess)(res, {
            user: {
                ...user,
                total_trades: stats.total_trades,
                total_pnl: parseFloat(stats.total_pnl) || 0,
                win_rate: winRate,
            },
        });
    }
    catch (error) {
        console.error("Get user profile error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to get user profile");
    }
};
exports.getUserProfile = getUserProfile;
/**
 * @route PUT /api/user/me
 * @desc Update current authenticated user's profile
 * @access Private
 */
const updateCurrentUser = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { username, display_name } = req.body;
        // Check if user exists
        const checkUser = await db_1.pool.query("SELECT * FROM users WHERE id = $1", [
            userId,
        ]);
        if (checkUser.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        const currentUser = checkUser.rows[0];
        // Prevent username editing - usernames cannot be changed
        if (username !== undefined) {
            return (0, errors_1.sendError)(res, 403, "Username cannot be changed. Usernames are permanent.");
        }
        // Build dynamic update query - only allow safe fields
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (display_name !== undefined) {
            // Validate display name
            const displayNameValidation = (0, validation_1.validateLength)(display_name, "Display name", 1, 50);
            if (!displayNameValidation.isValid) {
                return (0, errors_1.sendValidationError)(res, displayNameValidation.error);
            }
            // Check if display name is reserved
            if ((0, reservedNames_1.isReservedDisplayName)(display_name)) {
                return (0, errors_1.sendError)(res, 403, "This display name is reserved and cannot be used. Please choose a different name.");
            }
            // Check if display name is different from current
            const isChangingDisplayName = currentUser.display_name?.toLowerCase() !== display_name.toLowerCase();
            if (isChangingDisplayName) {
                // Check 30-day restriction
                if (currentUser.display_name_changed_at) {
                    const lastChanged = currentUser.display_name_changed_at;
                    const now = Math.floor(Date.now() / 1000);
                    const daysSinceChange = (now - lastChanged) / (60 * 60 * 24);
                    if (daysSinceChange < 30) {
                        const daysRemaining = Math.ceil(30 - daysSinceChange);
                        return (0, errors_1.sendError)(res, 429, `Display name can only be changed once every 30 days. Please wait ${daysRemaining} more day${daysRemaining !== 1 ? "s" : ""}.`);
                    }
                }
                // Check if display name is already taken by another user (case-insensitive)
                const displayNameCheck = await db_1.pool.query(`SELECT id FROM users WHERE LOWER(display_name) = LOWER($1) AND id != $2`, [display_name, userId]);
                if (displayNameCheck.rows.length > 0) {
                    return (0, errors_1.sendError)(res, 409, "Display name already exists");
                }
                // Update display name and set the changed timestamp
                updates.push(`display_name = $${paramCount}`);
                values.push(display_name);
                paramCount++;
                updates.push(`display_name_changed_at = EXTRACT(EPOCH FROM NOW())::BIGINT`);
            }
        }
        if (updates.length === 0) {
            return (0, errors_1.sendValidationError)(res, "No valid fields to update");
        }
        updates.push(`updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT`);
        values.push(userId);
        if (updates.length === 0) {
            return (0, errors_1.sendValidationError)(res, "No valid fields to update");
        }
        updates.push(`updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT`);
        values.push(userId);
        const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, username, display_name, created_at, updated_at, display_name_changed_at
    `;
        const result = await db_1.pool.query(query, values);
        return (0, errors_1.sendSuccess)(res, {
            message: "Profile updated successfully",
            user: result.rows[0],
        });
    }
    catch (error) {
        console.error("Update user error:", error);
        // Handle unique constraint violation for display_name
        if (error.code === "23505") {
            if (error.constraint?.includes("display_name") ||
                error.constraint?.includes("idx_users_display_name_unique")) {
                return (0, errors_1.sendError)(res, 409, "Display name already exists");
            }
            if (error.constraint?.includes("username")) {
                return (0, errors_1.sendError)(res, 409, "Username already exists");
            }
        }
        return (0, errors_1.sendError)(res, 500, "Failed to update profile");
    }
};
exports.updateCurrentUser = updateCurrentUser;
/**
 * @route POST /api/user/me/avatar
 * @desc Upload avatar/profile picture for current authenticated user
 * @access Private
 */
const uploadAvatar = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Check if file was uploaded
        if (!req.file) {
            return (0, errors_1.sendValidationError)(res, "Image file is required");
        }
        // Check if user exists
        const checkUser = await db_1.pool.query("SELECT id FROM users WHERE id = $1", [
            userId,
        ]);
        if (checkUser.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        // Validate image (file type, size, and NSFW content)
        const validation = await (0, contentModeration_1.validateImage)(req.file.buffer, req.file.mimetype);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error || "Invalid image");
        }
        // Upload to S3
        if (!process.env.S3_BUCKET) {
            console.warn("AWS S3 bucket not configured for image upload");
            return (0, errors_1.sendError)(res, 500, "Storage not configured");
        }
        let avatarUrl;
        try {
            avatarUrl = await (0, metadata_1.uploadImageToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
        }
        catch (error) {
            console.error("Failed to upload avatar to S3:", error);
            return (0, errors_1.sendError)(res, 500, "Failed to upload avatar");
        }
        // Update user's avatar_url in database
        const result = await db_1.pool.query(`UPDATE users 
       SET avatar_url = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
       WHERE id = $2 
       RETURNING id, username, display_name, avatar_url, created_at, updated_at`, [avatarUrl, userId]);
        return (0, errors_1.sendSuccess)(res, {
            message: "Avatar uploaded successfully",
            user: result.rows[0],
        });
    }
    catch (error) {
        console.error("Upload avatar error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to upload avatar");
    }
};
exports.uploadAvatar = uploadAvatar;
/**
 * @route DELETE /api/user/me
 * @desc Delete current authenticated user's account
 * @access Private
 */
const deleteCurrentUser = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Check if user exists
        const checkUser = await db_1.pool.query("SELECT id FROM users WHERE id = $1", [
            userId,
        ]);
        if (checkUser.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        // Delete the user (cascading deletes should handle related data)
        const result = await db_1.pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
        if (result.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Account deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete user error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to delete account");
    }
};
exports.deleteCurrentUser = deleteCurrentUser;
/**
 * @route GET /api/user/:id/posts
 * @desc Get user's posts
 * @access Public
 * @note Supports both username and UUID as identifier
 */
const getUserPosts = async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const currentUserId = req.id || undefined; // Optional authenticated user ID
        // Check if id is a UUID (36 chars with dashes) or username
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        // Get user ID from username or UUID
        const userResult = await db_1.pool.query(`SELECT id FROM users WHERE ${isUUID ? "id = $1" : "username = $1"}`, [id]);
        if (userResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        const userId = userResult.rows[0].id;
        // Get posts using PostModel
        const posts = await Post_1.PostModel.getByUser(userId, currentUserId, limit, offset);
        return (0, errors_1.sendSuccess)(res, { posts });
    }
    catch (error) {
        console.error("Get user posts error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to get user posts");
    }
};
exports.getUserPosts = getUserPosts;
/**
 * @route POST /api/user/follow/:id
 * @desc Follow a user
 * @access Private
 * @note Supports both username and UUID as identifier
 */
const followUser = async (req, res) => {
    try {
        const currentUserId = req.id;
        if (!currentUserId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { id } = req.params;
        // Check if id is a UUID (36 chars with dashes) or username
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        // Get user ID from username or UUID
        const userResult = await db_1.pool.query(`SELECT id FROM users WHERE ${isUUID ? "id = $1" : "username = $1"}`, [id]);
        if (userResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        const targetUserId = userResult.rows[0].id;
        // Can't follow yourself
        if (currentUserId === targetUserId) {
            return (0, errors_1.sendError)(res, 400, "You cannot follow yourself");
        }
        // Check if already following
        const existing = await db_1.pool.query(`SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, targetUserId]);
        if (existing.rows.length > 0) {
            return (0, errors_1.sendSuccess)(res, { message: "Already following this user" });
        }
        // Create follow relationship
        const now = Math.floor(Date.now() / 1000);
        await db_1.pool.query(`INSERT INTO user_follows (follower_id, following_id, created_at) VALUES ($1, $2, $3)`, [currentUserId, targetUserId, now]);
        // Update follower's following_count
        await db_1.pool.query(`UPDATE users SET following_count = COALESCE(following_count, 0) + 1 WHERE id = $1`, [currentUserId]);
        // Update target user's followers_count
        await db_1.pool.query(`UPDATE users SET followers_count = COALESCE(followers_count, 0) + 1 WHERE id = $1`, [targetUserId]);
        return (0, errors_1.sendSuccess)(res, { message: "Successfully followed user" });
    }
    catch (error) {
        console.error("Follow user error:", error);
        // Handle unique constraint violation
        if (error.code === "23505") {
            return (0, errors_1.sendSuccess)(res, { message: "Already following this user" });
        }
        return (0, errors_1.sendError)(res, 500, "Failed to follow user");
    }
};
exports.followUser = followUser;
/**
 * @route POST /api/user/unfollow/:id
 * @desc Unfollow a user
 * @access Private
 * @note Supports both username and UUID as identifier
 */
const unfollowUser = async (req, res) => {
    try {
        const currentUserId = req.id;
        if (!currentUserId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { id } = req.params;
        // Check if id is a UUID (36 chars with dashes) or username
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        // Get user ID from username or UUID
        const userResult = await db_1.pool.query(`SELECT id FROM users WHERE ${isUUID ? "id = $1" : "username = $1"}`, [id]);
        if (userResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        const targetUserId = userResult.rows[0].id;
        // Check if following
        const existing = await db_1.pool.query(`SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, targetUserId]);
        if (existing.rows.length === 0) {
            return (0, errors_1.sendSuccess)(res, { message: "Not following this user" });
        }
        // Remove follow relationship
        await db_1.pool.query(`DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, targetUserId]);
        // Update follower's following_count
        await db_1.pool.query(`UPDATE users SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0) WHERE id = $1`, [currentUserId]);
        // Update target user's followers_count
        await db_1.pool.query(`UPDATE users SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0) WHERE id = $1`, [targetUserId]);
        return (0, errors_1.sendSuccess)(res, { message: "Successfully unfollowed user" });
    }
    catch (error) {
        console.error("Unfollow user error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to unfollow user");
    }
};
exports.unfollowUser = unfollowUser;
/**
 * @route GET /api/user/follow-status/:id
 * @desc Get follow status (whether current user is following target user)
 * @access Private
 * @note Supports both username and UUID as identifier
 */
const getFollowStatus = async (req, res) => {
    try {
        const currentUserId = req.id;
        if (!currentUserId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { id } = req.params;
        // Check if id is a UUID (36 chars with dashes) or username
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        // Get user ID from username or UUID
        const userResult = await db_1.pool.query(`SELECT id FROM users WHERE ${isUUID ? "id = $1" : "username = $1"}`, [id]);
        if (userResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        const targetUserId = userResult.rows[0].id;
        // Check if following
        const followResult = await db_1.pool.query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, targetUserId]);
        const is_following = followResult.rows.length > 0;
        return (0, errors_1.sendSuccess)(res, { is_following });
    }
    catch (error) {
        console.error("Get follow status error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to get follow status");
    }
};
exports.getFollowStatus = getFollowStatus;
/**
 * @route POST /api/user/wallet/generate
 * @desc Generate or replace user's wallet (deletes old wallet if exists)
 * @access Private (requires authentication)
 */
const generateWallet = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Check if user exists
        const user = await db_1.pool.query("SELECT id FROM users WHERE id = $1", [
            userId,
        ]);
        if (user.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        // Replace wallet (deletes old and creates new Circle wallet)
        const circleWallet = (0, circleWallet_1.getCircleWallet)();
        if (!circleWallet.isAvailable()) {
            return (0, errors_1.sendError)(res, 500, "Circle wallet service is not available");
        }
        const { walletId, address } = await circleWallet.createUserWallet(userId);
        const wallet = await Wallet_1.WalletModel.replaceWallet(userId, walletId, address);
        return (0, errors_1.sendSuccess)(res, {
            message: "Wallet generated successfully",
            wallet: {
                id: wallet.id,
                public_key: wallet.public_key,
                created_at: wallet.created_at,
                updated_at: wallet.updated_at,
            },
        });
    }
    catch (error) {
        console.error("Generate wallet error:", error);
        return (0, errors_1.sendError)(res, 500, "Failed to generate wallet");
    }
};
exports.generateWallet = generateWallet;
//# sourceMappingURL=controller_user.js.map