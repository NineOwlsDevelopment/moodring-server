import { Response } from "express";
import { PostModel, PostCommentModel } from "../models/Post";
import { sendError, sendSuccess, sendValidationError } from "../utils/errors";
import { validateRequired, validateLength } from "../utils/validation";
import { validateTextContent } from "../utils/contentModeration";
import { validateImage } from "../utils/contentModeration";
import { uploadImageToS3, uploadVideoToS3 } from "../utils/metadata";
import {
  CreatePostRequest,
  TogglePostLikeRequest,
  GetPostCommentsRequest,
  GetCommentRepliesRequest,
  CreatePostCommentRequest,
} from "../types/requests";
import multer from "multer";
import { UUID } from "crypto";

// Configure multer for file uploads
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

export const createPost = async (req: CreatePostRequest, res: Response) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { content, market_id } = req.body;

    // Validate content
    const contentValidation = validateRequired(content, "Content");
    if (!contentValidation.isValid) {
      return sendValidationError(res, contentValidation.error!);
    }

    const lengthValidation = validateLength(content, "Content", 1, 5000);
    if (!lengthValidation.isValid) {
      return sendValidationError(res, lengthValidation.error!);
    }

    // Validate text content for banned words
    const textValidation = validateTextContent(content, "Post content");
    if (!textValidation.isValid) {
      return sendValidationError(
        res,
        textValidation.error || "Invalid content"
      );
    }

    let imageUrl: string | null = null;
    let videoUrl: string | null = null;

    // Handle file upload (image or video)
    if (req.file) {
      const isImage = req.file.mimetype.startsWith("image/");
      const isVideo = req.file.mimetype.startsWith("video/");

      if (!isImage && !isVideo) {
        return sendValidationError(res, "File must be an image or video");
      }

      // Validate image if it's an image
      if (isImage) {
        const imageValidation = await validateImage(
          req.file.buffer,
          req.file.mimetype
        );
        if (!imageValidation.isValid) {
          return sendValidationError(
            res,
            imageValidation.error || "Invalid image"
          );
        }
      }

      // Upload to S3
      if (!process.env.S3_BUCKET) {
        return sendError(res, 500, "Storage not configured");
      }

      try {
        if (isImage) {
          imageUrl = await uploadImageToS3(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            process.env.S3_BUCKET
          );
        } else if (isVideo) {
          videoUrl = await uploadVideoToS3(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            process.env.S3_BUCKET
          );
        }
      } catch (error) {
        console.error("Failed to upload file to S3:", error);
        return sendError(res, 500, "Failed to upload file");
      }
    }

    // Create post
    const post = await PostModel.create({
      user_id: userId as UUID,
      content: content.trim(),
      image_url: imageUrl as string,
      video_url: videoUrl as string,
      market_id: market_id as UUID,
    });

    return sendSuccess(res, { post });
  } catch (error: any) {
    console.error("Create post error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to create post. Please try again."
    );
  }
};

/**
 * @route POST /api/posts/:id/like
 * @desc Like or unlike a post
 * @access Private
 */
export const togglePostLike = async (
  req: TogglePostLikeRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { id: postId } = req.params;

    const result = await PostModel.toggleLike(postId, userId);

    return sendSuccess(res, result);
  } catch (error: any) {
    console.error("Toggle post like error:", error);
    return sendError(res, 500, error.message || "Failed to toggle like");
  }
};

/**
 * @route GET /api/posts/:id/comments
 * @desc Get comments for a post
 * @access Public (optional auth)
 */
export const getPostComments = async (
  req: GetPostCommentsRequest,
  res: Response
) => {
  try {
    const { id: postId } = req.params;
    const currentUserId = req.id || undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const comments = await PostCommentModel.getByPost(
      postId,
      currentUserId,
      limit,
      offset
    );

    return sendSuccess(res, { comments });
  } catch (error: any) {
    console.error("Get post comments error:", error);
    return sendError(res, 500, error.message || "Failed to get comments");
  }
};

/**
 * @route GET /api/posts/comments/:id/replies
 * @desc Get replies to a comment
 * @access Public (optional auth)
 */
export const getCommentReplies = async (
  req: GetCommentRepliesRequest,
  res: Response
) => {
  try {
    const { id: commentId } = req.params;
    const currentUserId = req.id || undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const replies = await PostCommentModel.getReplies(
      commentId,
      currentUserId,
      limit,
      offset
    );

    return sendSuccess(res, { replies });
  } catch (error: any) {
    console.error("Get comment replies error:", error);
    return sendError(res, 500, error.message || "Failed to get replies");
  }
};

/**
 * @route POST /api/posts/comments
 * @desc Create a comment on a post
 * @access Private
 */
export const createPostComment = async (
  req: CreatePostCommentRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { post_id, content, parent_comment_id } = req.body;

    // Validate content
    const contentValidation = validateRequired(content, "Content");
    if (!contentValidation.isValid) {
      return sendValidationError(res, contentValidation.error!);
    }

    const lengthValidation = validateLength(content, "Content", 1, 5000);
    if (!lengthValidation.isValid) {
      return sendValidationError(res, lengthValidation.error!);
    }

    // Validate text content for banned words
    const textValidation = validateTextContent(content, "Comment content");
    if (!textValidation.isValid) {
      return sendValidationError(
        res,
        textValidation.error || "Invalid content"
      );
    }

    const comment = await PostCommentModel.create({
      post_id: post_id as UUID,
      user_id: userId as UUID,
      content: content.trim(),
      parent_comment_id: parent_comment_id as UUID | null,
    });

    // Get comment with user info
    const comments = await PostCommentModel.getByPost(post_id, userId, 1, 0);
    const commentWithUser = comments.find((c) => c.id === comment.id);

    return sendSuccess(res, {
      comment: commentWithUser || comment,
    });
  } catch (error: any) {
    console.error("Create post comment error:", error);
    return sendError(res, 500, error.message || "Failed to create comment");
  }
};

/**
 * @route POST /api/posts/comments/:id/like
 * @desc Like or unlike a post comment
 * @access Private
 */
export const togglePostCommentLike = async (
  req: TogglePostLikeRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { id: commentId } = req.params;

    const result = await PostCommentModel.toggleLike(commentId, userId);

    return sendSuccess(res, result);
  } catch (error: any) {
    console.error("Toggle post comment like error:", error);
    return sendError(res, 500, error.message || "Failed to toggle like");
  }
};
