import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import {
  fetchMarketComments,
  fetchCommentReplies,
  createComment,
  voteComment,
  deleteComment,
  Comment,
} from "@/api/api";
import { formatDistanceToNow } from "@/utils/format";
import { useCommentSocket } from "@/hooks/useSocket";
import { CommentUpdate } from "@/services/socket";
import { socketService } from "@/services/socket";
import { validateTextContent } from "@/utils/bannedWords";
import {
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Trash2,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { ConfirmationModal } from "./ConfirmationModal";
import { getUserProfileUrl } from "@/utils/userProfile";

interface CommentSectionProps {
  marketId: string;
  market?: {
    categories?: Array<{ name: string }>;
    category?: string;
  };
}

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string) => void;
  onVote: (id: string, vote: "up" | "down" | "none") => void;
  onDelete: (id: string) => void;
  isNested?: boolean;
  onCommentUpdate?: (update: CommentUpdate) => void;
}

const CommentItem = ({
  comment,
  onReply,
  onVote,
  onDelete,
  isNested = false,
  onCommentUpdate,
}: CommentItemProps) => {
  const { user } = useUserStore();
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  const loadReplies = useCallback(async () => {
    if (replies.length > 0 && showReplies) {
      setShowReplies(false);
      return;
    }

    setIsLoadingReplies(true);
    try {
      const { replies: data } = await fetchCommentReplies(comment.id);
      setReplies(data);
      setShowReplies(true);
    } catch (error) {
      console.error("Failed to load replies:", error);
    } finally {
      setIsLoadingReplies(false);
    }
  }, [comment.id, replies.length, showReplies]);

  // Handle realtime updates for replies when they're loaded
  useEffect(() => {
    if (!showReplies) return;

    const handleUpdate = (update: CommentUpdate) => {
      // Handle replies to this comment
      if (update.parent_id === comment.id) {
        switch (update.event) {
          case "created":
            if (update.comment) {
              // Reload replies to get the new one
              loadReplies();
            }
            break;
          case "updated":
            if (update.comment) {
              setReplies((prev) =>
                prev.map((r) =>
                  r.id === update.comment_id ? update.comment : r
                )
              );
            }
            break;
          case "deleted":
            setReplies((prev) =>
              prev.filter((r) => r.id !== update.comment_id)
            );
            break;
          case "voted":
            if (
              update.upvotes !== undefined &&
              update.downvotes !== undefined
            ) {
              setReplies((prev) =>
                prev.map((r) =>
                  r.id === update.comment_id
                    ? {
                        ...r,
                        upvotes: update.upvotes!,
                        downvotes: update.downvotes!,
                      }
                    : r
                )
              );
            }
            break;
        }
      }
    };

    // Subscribe to comment updates
    const unsubscribe = socketService.onComment(handleUpdate);
    return unsubscribe;
  }, [comment.id, showReplies, loadReplies]);

  const handleVote = (vote: "up" | "down") => {
    const newVote = comment.user_vote === vote ? "none" : vote;
    onVote(comment.id, newVote);
  };

  const isOwner = user?.id === comment.user_id;
  const score = comment.upvotes - comment.downvotes;

  const truncateUsername = (name: string, maxLength: number = 16) => {
    if (!name) return "";
    if (name.length <= maxLength) return name;
    return `${name.slice(0, maxLength)}...`;
  };

  return (
    <div className={`${isNested ? "ml-4 sm:ml-8 mt-3" : ""}`}>
      <div className="flex gap-2 sm:gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Link
            to={getUserProfileUrl(comment.username || comment.user_id)}
            className="block hover:opacity-80 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs sm:text-sm font-bold cursor-pointer">
              {comment.display_name?.charAt(0).toUpperCase() || "U"}
            </div>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              to={getUserProfileUrl(comment.username || comment.user_id)}
              className="font-medium text-white text-sm truncate max-w-[100px] sm:max-w-[150px] hover:text-neon-iris transition-colors cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              {truncateUsername(comment.display_name || comment.username || "")}
            </Link>
            <span className="text-xs text-moon-grey-dark">
              {formatDistanceToNow(
                new Date(Number(comment.created_at)).getTime()
              )}
            </span>
          </div>

          <p className="text-moon-grey text-sm whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4 mt-2 flex-wrap">
            {/* Votes */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => handleVote("up")}
                className={`p-1.5 rounded-lg transition-colors tap-target ${
                  comment.user_vote === "up"
                    ? "text-neon-iris bg-neon-iris/10"
                    : "text-moon-grey-dark hover:text-neon-iris hover:bg-neon-iris/10"
                }`}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span
                className={`text-xs font-medium min-w-[20px] text-center tabular-nums ${
                  score > 0
                    ? "text-neon-iris"
                    : score < 0
                    ? "text-brand-danger"
                    : "text-moon-grey-dark"
                }`}
              >
                {score}
              </span>
              <button
                onClick={() => handleVote("down")}
                className={`p-1.5 rounded-lg transition-colors tap-target ${
                  comment.user_vote === "down"
                    ? "text-brand-danger bg-brand-danger/10"
                    : "text-moon-grey-dark hover:text-brand-danger hover:bg-brand-danger/10"
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Reply button */}
            {!isNested && user && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-xs text-moon-grey-dark hover:text-neon-iris transition-colors font-medium flex items-center gap-1 py-1"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Reply
              </button>
            )}

            {/* Show replies */}
            {!isNested && comment.reply_count > 0 && (
              <button
                onClick={loadReplies}
                className="text-xs text-neon-iris hover:text-neon-iris-light transition-colors font-medium py-1"
              >
                {isLoadingReplies
                  ? "Loading..."
                  : showReplies
                  ? "Hide replies"
                  : `${comment.reply_count} ${
                      comment.reply_count === 1 ? "reply" : "replies"
                    }`}
              </button>
            )}

            {/* Delete */}
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-moon-grey-dark hover:text-brand-danger transition-colors font-medium flex items-center gap-1 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>

          {/* Nested Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onVote={onVote}
                  onDelete={onDelete}
                  isNested
                  onCommentUpdate={onCommentUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CommentSection = ({ marketId }: CommentSectionProps) => {
  const { user } = useUserStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<"top" | "new">("top");
  const [error, setError] = useState<string | null>(null);
  const [commentValidationError, setCommentValidationError] = useState<
    string | null
  >(null);

  // Pagination state (all markets use pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    commentId: string | null;
    isLoading: boolean;
  }>({ isOpen: false, commentId: null, isLoading: false });

  // Track recently added comments to prevent duplicate websocket additions
  // Track by both comment ID and content hash to catch early websocket events
  const recentlyAddedCommentsRef = useRef<Set<string>>(new Set());
  const pendingCommentsRef = useRef<Map<string, string>>(new Map()); // content -> commentId

  useEffect(() => {
    setCurrentPage(1);
    setComments([]);
    // Clear recently added comments when market or sort changes
    recentlyAddedCommentsRef.current.clear();
    pendingCommentsRef.current.clear();
    loadComments(1, true);
  }, [marketId, sortBy]);

  const loadComments = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // All markets use pagination with 10 comments per page
      const limit = 10;
      const { comments: data, pagination } = await fetchMarketComments(
        marketId,
        {
          sort: sortBy,
          page,
          limit,
        }
      );

      console.log("data", comments);
      if (reset) {
        setComments(data);
      } else {
        setComments((prev) => [...prev, ...data]);
      }

      setHasMore(pagination?.hasMore || false);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadComments(currentPage + 1, false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    // Validate for banned words before submission
    const validation = validateTextContent(
      newComment.trim(),
      "Comment content"
    );
    if (!validation.isValid) {
      setCommentValidationError(validation.error || null);
      setError(validation.error || "Invalid content in comment");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setCommentValidationError(null);

    // Create a content hash to track this comment before API call
    const contentHash = `${marketId}-${newComment
      .trim()
      .slice(0, 50)}-${Date.now()}`;

    try {
      const comment = await createComment({
        market_id: marketId,
        content: newComment.trim(),
        parent_id: replyingTo || undefined,
      });

      // Track this comment to prevent duplicate from websocket
      // Map content hash to comment ID
      pendingCommentsRef.current.set(contentHash, comment.id);
      recentlyAddedCommentsRef.current.add(comment.id);

      // Clean up after 10 seconds
      setTimeout(() => {
        recentlyAddedCommentsRef.current.delete(comment.id);
        pendingCommentsRef.current.delete(contentHash);
      }, 10000);

      if (replyingTo) {
        // Refresh to show nested reply
        await loadComments(1, true);
      } else {
        setComments((prev) => {
          // Defensive check: don't add if it's already there
          if (prev.some((c) => c.id === comment.id)) {
            return prev;
          }
          return [comment, ...prev];
        });
      }

      setNewComment("");
      setReplyingTo(null);
    } catch (error: any) {
      console.error("Failed to create comment:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to create comment. Please try again.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (id: string, vote: "up" | "down" | "none") => {
    if (!user) return;

    try {
      const { upvotes, downvotes } = await voteComment(id, vote);
      setComments((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                upvotes,
                downvotes,
                user_vote: vote === "none" ? null : vote,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, commentId: id, isLoading: false });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.commentId) return;

    // Set loading state immediately
    setDeleteConfirm((prev) => ({ ...prev, isLoading: true }));

    try {
      await deleteComment(deleteConfirm.commentId);
      setComments((prev) =>
        prev.filter((c) => c.id !== deleteConfirm.commentId)
      );
      setDeleteConfirm({ isOpen: false, commentId: null, isLoading: false });
    } catch (error) {
      console.error("Failed to delete comment:", error);
      setDeleteConfirm((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Handle realtime comment updates
  const handleCommentUpdate = useCallback(
    (update: CommentUpdate) => {
      if (update.market_id !== marketId) return;

      switch (update.event) {
        case "created":
          if (update.comment) {
            // If it's a reply, we need to refresh to show it in the nested structure
            // and update the reply_count on the parent comment
            if (update.parent_id) {
              // Update the parent comment's reply_count
              setComments((prev) =>
                prev.map((c) =>
                  c.id === update.parent_id
                    ? { ...c, reply_count: (c.reply_count || 0) + 1 }
                    : c
                )
              );
              // Note: The actual reply will be loaded when the user expands replies
              // or we could trigger a reload of replies if they're currently shown
            } else {
              // For top-level comments, add to the list
              setComments((prev) => {
                // First check: is it already in the list?
                const alreadyExists = prev.some(
                  (c) => c.id === update.comment_id
                );
                if (alreadyExists) {
                  return prev;
                }

                // Second check: was it recently added by current user (optimistic update)?
                const isRecentlyAdded = recentlyAddedCommentsRef.current.has(
                  update.comment_id
                );
                if (isRecentlyAdded) {
                  return prev;
                }

                // Third check: is it in pending comments?
                const isPending = Array.from(
                  pendingCommentsRef.current.values()
                ).includes(update.comment_id);
                if (isPending) {
                  return prev;
                }

                // Fourth check: is it the current user's own comment created very recently?
                // This catches cases where the websocket arrives before the ref is set
                if (user && update.comment?.user_id === user.id) {
                  if (update.comment?.created_at) {
                    const commentTime =
                      typeof update.comment.created_at === "number"
                        ? update.comment.created_at
                        : new Date(update.comment.created_at).getTime() / 1000;
                    const now = Math.floor(Date.now() / 1000);
                    const timeDiff = now - commentTime;

                    // If comment was created in the last 10 seconds by current user, skip it
                    // (they already added it optimistically)
                    if (timeDiff < 10) {
                      return prev;
                    }
                  }
                }

                return [update.comment, ...prev];
              });
            }
          }
          break;

        case "updated":
          if (update.comment) {
            setComments((prev) =>
              prev.map((c) => (c.id === update.comment_id ? update.comment : c))
            );
          }
          break;

        case "deleted":
          setComments((prev) => {
            const deleted = prev.find((c) => c.id === update.comment_id);
            // If deleting a reply, decrement parent's reply_count
            if (deleted?.parent_id) {
              return prev
                .map((c) =>
                  c.id === deleted.parent_id
                    ? {
                        ...c,
                        reply_count: Math.max(0, (c.reply_count || 0) - 1),
                      }
                    : c.id !== update.comment_id
                    ? c
                    : null
                )
                .filter(Boolean) as Comment[];
            }
            return prev.filter((c) => c.id !== update.comment_id);
          });
          break;

        case "voted":
          if (update.upvotes !== undefined && update.downvotes !== undefined) {
            setComments((prev) =>
              prev.map((c) =>
                c.id === update.comment_id
                  ? {
                      ...c,
                      upvotes: update.upvotes!,
                      downvotes: update.downvotes!,
                    }
                  : c
              )
            );
          }
          break;
      }
    },
    [marketId, user]
  );

  // Subscribe to realtime comment updates
  useCommentSocket(marketId, {
    onComment: handleCommentUpdate,
  });

  return (
    <div className="card card-mobile mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-neon-iris" />
          Discussion ({comments.length})
        </h2>
        <div className="flex gap-1 p-1 bg-graphite-light rounded-xl">
          <button
            onClick={() => setSortBy("top")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              sortBy === "top"
                ? "bg-neon-iris text-white"
                : "text-moon-grey hover:text-white hover:bg-white/5"
            }`}
          >
            Top
          </button>
          <button
            onClick={() => setSortBy("new")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              sortBy === "new"
                ? "bg-neon-iris text-white"
                : "text-moon-grey hover:text-white hover:bg-white/5"
            }`}
          >
            New
          </button>
        </div>
      </div>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          {replyingTo && (
            <div className="relative overflow-hidden flex items-center justify-between bg-graphite-light px-3 py-2 rounded-t-xl">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
              <span className="text-sm text-moon-grey">
                Replying to comment
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-moon-grey-dark hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-brand-danger/10 rounded-xl text-sm text-brand-danger">
              {error}
            </div>
          )}
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-shrink-0 hidden sm:block">
              <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-bold">
                {user.display_name?.charAt(0).toUpperCase() || "U"}
              </div>
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewComment(value);
                  setError(null);
                  // Check for banned words
                  const validation = validateTextContent(
                    value,
                    "Comment content"
                  );
                  if (!validation.isValid) {
                    setCommentValidationError(validation.error || null);
                  } else {
                    setCommentValidationError(null);
                  }
                }}
                placeholder={
                  replyingTo ? "Write a reply..." : "Share your thoughts..."
                }
                className={`input min-h-[80px] resize-none text-sm sm:text-base ${
                  replyingTo ? "rounded-t-none" : ""
                } ${
                  commentValidationError
                    ? "border-brand-danger focus:border-brand-danger"
                    : ""
                }`}
                rows={3}
              />
              {commentValidationError && (
                <p className="text-sm text-brand-danger flex items-center gap-1.5 mt-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {commentValidationError}
                </p>
              )}
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={
                    !newComment.trim() ||
                    isSubmitting ||
                    !!commentValidationError
                  }
                  className="btn btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {replyingTo ? "Reply" : "Comment"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="relative overflow-hidden mb-6 p-4 bg-graphite-light rounded-xl text-center">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
          <p className="text-moon-grey">
            Connect your wallet to join the discussion
          </p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-neon-iris animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-graphite-light flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-moon-grey-dark" />
          </div>
          <p className="text-moon-grey font-medium">No comments yet</p>
          <p className="text-moon-grey-dark text-sm mt-1">
            Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4 sm:space-y-6">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={setReplyingTo}
                onVote={handleVote}
                onDelete={handleDeleteClick}
                onCommentUpdate={handleCommentUpdate}
              />
            ))}
          </div>

          {/* Load More button */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="btn btn-secondary flex items-center gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More Comments"
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() =>
          setDeleteConfirm({ isOpen: false, commentId: null, isLoading: false })
        }
        onConfirm={handleDeleteConfirm}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteConfirm.isLoading}
      />
    </div>
  );
};
