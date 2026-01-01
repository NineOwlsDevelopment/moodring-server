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
import { UserAvatar } from "./UserAvatar";

interface CommentSectionProps {
  marketId: string;
  market?: {
    categories?: Array<{ name: string }>;
    category?: string;
  };
}

export const CommentSection = ({ marketId }: CommentSectionProps) => {
  const { user } = useUserStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [repliesMap, setRepliesMap] = useState<Map<string, Comment[]>>(
    new Map()
  );
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<"top" | "new">("top");
  const [error, setError] = useState<string | null>(null);
  const [commentValidationError, setCommentValidationError] = useState<
    string | null
  >(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pagination state
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
  const recentlyAddedCommentsRef = useRef<Set<string>>(new Set());
  const pendingCommentsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setCurrentPage(1);
    setComments([]);
    setRepliesMap(new Map());
    setExpandedReplies(new Set());
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
      const limit = 10;
      const { comments: data, pagination } = await fetchMarketComments(
        marketId,
        {
          sort: sortBy,
          page,
          limit,
        }
      );

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

  const loadReplies = async (commentId: string) => {
    if (repliesMap.has(commentId) || loadingReplies.has(commentId)) return;

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const { replies } = await fetchCommentReplies(commentId, { limit: 50 });
      setRepliesMap((prev) => {
        const next = new Map(prev);
        next.set(commentId, replies);
        return next;
      });
    } catch (error) {
      console.error("Failed to load replies:", error);
    } finally {
      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const toggleReplies = (commentId: string) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      setExpandedReplies((prev) => new Set(prev).add(commentId));
      loadReplies(commentId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    // Validate for banned words
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

    const contentHash = `${marketId}-${newComment
      .trim()
      .slice(0, 50)}-${Date.now()}`;

    try {
      const comment = await createComment({
        market_id: marketId,
        content: newComment.trim(),
        parent_id: replyingTo?.id || undefined,
      });

      pendingCommentsRef.current.set(contentHash, comment.id);
      recentlyAddedCommentsRef.current.add(comment.id);

      setTimeout(() => {
        recentlyAddedCommentsRef.current.delete(comment.id);
        pendingCommentsRef.current.delete(contentHash);
      }, 10000);

      if (replyingTo?.id) {
        // Reload replies if we were replying to a comment
        setRepliesMap((prev) => {
          const next = new Map(prev);
          next.delete(replyingTo.id);
          return next;
        });
        await loadReplies(replyingTo.id);
        // Reload comments to update reply count
        await loadComments(1, true);
      } else {
        setComments((prev) => {
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
      // Also update in replies map
      setRepliesMap((prev) => {
        const next = new Map(prev);
        for (const [parentId, replies] of next.entries()) {
          const updatedReplies = replies.map((r) =>
            r.id === id
              ? {
                  ...r,
                  upvotes,
                  downvotes,
                  user_vote: vote === "none" ? null : vote,
                }
              : r
          );
          next.set(parentId, updatedReplies);
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, commentId: id, isLoading: false });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.commentId) return;

    setDeleteConfirm((prev) => ({ ...prev, isLoading: true }));

    try {
      await deleteComment(deleteConfirm.commentId);
      const deleted = comments.find((c) => c.id === deleteConfirm.commentId);
      // If deleting a reply, remove from replies map
      if (deleted?.parent_id) {
        setRepliesMap((prev) => {
          const next = new Map(prev);
          const replies = next.get(deleted.parent_id!);
          if (replies) {
            next.set(
              deleted.parent_id!,
              replies.filter((r) => r.id !== deleteConfirm.commentId)
            );
          }
          return next;
        });
        // Update parent comment's reply count
        setComments((prev) =>
          prev.map((c) =>
            c.id === deleted.parent_id
              ? {
                  ...c,
                  reply_count: Math.max(0, (c.reply_count || 0) - 1),
                }
              : c
          )
        );
      } else {
        setComments((prev) =>
          prev.filter((c) => c.id !== deleteConfirm.commentId)
        );
      }
      setDeleteConfirm({ isOpen: false, commentId: null, isLoading: false });
    } catch (error) {
      console.error("Failed to delete comment:", error);
      setDeleteConfirm((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleReplyToComment = (
    commentId: string,
    displayName: string | null,
    username: string
  ) => {
    const name = displayName || username;
    setReplyingTo({ id: commentId, name });
    setNewComment(`@${name} `);
    inputRef.current?.focus();
  };

  // Build a flat list of all comments with their parent info
  const buildFlatCommentList = (
    comments: Comment[],
    parentComment?: Comment,
    result: Array<{
      comment: Comment;
      parent?: Comment;
      depth: number;
    }> = []
  ): Array<{ comment: Comment; parent?: Comment; depth: number }> => {
    for (const comment of comments) {
      result.push({
        comment,
        parent: parentComment,
        depth: parentComment ? 1 : 0,
      });

      const replies = repliesMap.get(comment.id);
      if (replies && expandedReplies.has(comment.id)) {
        buildFlatCommentList(replies, comment, result);
      }
    }
    return result;
  };

  const renderComment = (item: {
    comment: Comment;
    parent?: Comment;
    depth: number;
  }) => {
    const { comment, parent, depth } = item;
    const replies = repliesMap.get(comment.id);
    const hasLoadedReplies = repliesMap.has(comment.id);
    const hasReplies = replies && replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const isReply = !!parent;
    const isOwner = user?.id === comment.user_id;
    const score = comment.upvotes - comment.downvotes;

    return (
      <div
        key={comment.id}
        className={`relative pr-3 py-3 hover:bg-graphite-light/30 transition-colors border-b border-white/[0.04] last:border-b-0 ${
          isReply ? "pl-12 ml-8" : "pl-3"
        }`}
      >
        {/* YouTube-style threading branch for replies */}
        {isReply && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute left-0 top-[18px] w-8 h-px bg-white/10" />
          </>
        )}

        <div className="flex gap-3 relative">
          <div className="flex-shrink-0 relative">
            <Link
              to={getUserProfileUrl(comment.username || comment.user_id)}
              onClick={(e) => e.stopPropagation()}
            >
              <UserAvatar
                name={comment.display_name || comment.username || "User"}
                size="sm"
                imageUrl={comment.avatar_url || undefined}
              />
            </Link>
          </div>

          <div className="flex-1 min-w-0">
            {/* Parent reference for replies */}
            {parent && (
              <div className="mb-1.5">
                <span className="text-xs text-moon-grey-dark">
                  Replying to{" "}
                  <span className="font-medium text-moon-grey">
                    {parent.display_name || parent.username}
                  </span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={getUserProfileUrl(comment.username || comment.user_id)}
                className="font-semibold text-sm text-white hover:text-neon-iris transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {comment.display_name || comment.username}
              </Link>
              <span className="text-xs text-moon-grey-dark">
                {comment.created_at
                  ? formatDistanceToNow(
                      new Date(Number(comment.created_at)).getTime()
                    )
                  : "now"}
              </span>
            </div>
            <p className="text-sm text-moon-grey-light mt-1 whitespace-pre-wrap leading-relaxed">
              {comment.content}
            </p>
            <div className="flex items-center gap-3 mt-2">
              {/* Votes */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() =>
                    handleVote(
                      comment.id,
                      comment.user_vote === "up" ? "none" : "up"
                    )
                  }
                  className={`p-1.5 rounded-lg transition-colors ${
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
                  onClick={() =>
                    handleVote(
                      comment.id,
                      comment.user_vote === "down" ? "none" : "down"
                    )
                  }
                  className={`p-1.5 rounded-lg transition-colors ${
                    comment.user_vote === "down"
                      ? "text-brand-danger bg-brand-danger/10"
                      : "text-moon-grey-dark hover:text-brand-danger hover:bg-brand-danger/10"
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Reply button */}
              {user && (
                <button
                  onClick={() =>
                    handleReplyToComment(
                      comment.id,
                      comment.display_name,
                      comment.username
                    )
                  }
                  className="text-xs text-moon-grey/60 hover:text-neon-iris transition-all duration-300 font-medium uppercase tracking-wide"
                >
                  Reply
                </button>
              )}

              {/* Show replies */}
              {depth === 0 && comment.reply_count > 0 && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="text-xs text-moon-grey/60 hover:text-neon-iris transition-all duration-300 font-medium uppercase tracking-wide"
                >
                  {loadingReplies.has(comment.id)
                    ? "Loading..."
                    : isExpanded
                    ? "Hide replies"
                    : hasLoadedReplies && hasReplies
                    ? `${replies.length} ${
                        replies.length === 1 ? "reply" : "replies"
                      }`
                    : hasLoadedReplies && !hasReplies
                    ? "No replies"
                    : `View ${comment.reply_count} ${
                        comment.reply_count === 1 ? "reply" : "replies"
                      }`}
                </button>
              )}

              {/* Delete */}
              {isOwner && (
                <button
                  onClick={() => handleDeleteClick(comment.id)}
                  className="text-xs text-moon-grey/60 hover:text-brand-danger transition-all duration-300 font-medium uppercase tracking-wide flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Handle realtime comment updates
  const handleCommentUpdate = useCallback(
    (update: CommentUpdate) => {
      if (update.market_id !== marketId) return;

      switch (update.event) {
        case "created":
          if (update.comment) {
            if (update.parent_id) {
              // Update parent comment's reply_count
              setComments((prev) =>
                prev.map((c) =>
                  c.id === update.parent_id
                    ? { ...c, reply_count: (c.reply_count || 0) + 1 }
                    : c
                )
              );
              // Reload replies if they're currently shown
              if (expandedReplies.has(update.parent_id)) {
                loadReplies(update.parent_id);
              }
            } else {
              setComments((prev) => {
                const alreadyExists = prev.some(
                  (c) => c.id === update.comment_id
                );
                if (alreadyExists) return prev;

                const isRecentlyAdded = recentlyAddedCommentsRef.current.has(
                  update.comment_id
                );
                if (isRecentlyAdded) return prev;

                const isPending = Array.from(
                  pendingCommentsRef.current.values()
                ).includes(update.comment_id);
                if (isPending) return prev;

                if (user && update.comment?.user_id === user.id) {
                  if (update.comment?.created_at) {
                    const commentTime =
                      typeof update.comment.created_at === "number"
                        ? update.comment.created_at
                        : new Date(update.comment.created_at).getTime() / 1000;
                    const now = Math.floor(Date.now() / 1000);
                    const timeDiff = now - commentTime;
                    if (timeDiff < 10) return prev;
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
            setRepliesMap((prev) => {
              const next = new Map(prev);
              for (const [parentId, replies] of next.entries()) {
                const updatedReplies = replies.map((r) =>
                  r.id === update.comment_id ? update.comment : r
                );
                next.set(parentId, updatedReplies);
              }
              return next;
            });
          }
          break;

        case "deleted":
          const deleted = comments.find((c) => c.id === update.comment_id);
          if (deleted?.parent_id) {
            setRepliesMap((prev) => {
              const next = new Map(prev);
              const replies = next.get(deleted.parent_id!);
              if (replies) {
                next.set(
                  deleted.parent_id!,
                  replies.filter((r) => r.id !== update.comment_id)
                );
              }
              return next;
            });
            setComments((prev) =>
              prev.map((c) =>
                c.id === deleted.parent_id
                  ? {
                      ...c,
                      reply_count: Math.max(0, (c.reply_count || 0) - 1),
                    }
                  : c
              )
            );
          } else {
            setComments((prev) =>
              prev.filter((c) => c.id !== update.comment_id)
            );
          }
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
            setRepliesMap((prev) => {
              const next = new Map(prev);
              for (const [parentId, replies] of next.entries()) {
                const updatedReplies = replies.map((r) =>
                  r.id === update.comment_id
                    ? {
                        ...r,
                        upvotes: update.upvotes!,
                        downvotes: update.downvotes!,
                      }
                    : r
                );
                next.set(parentId, updatedReplies);
              }
              return next;
            });
          }
          break;
      }
    },
    [marketId, user, comments, expandedReplies]
  );

  // Subscribe to realtime comment updates
  useCommentSocket(marketId, {
    onComment: handleCommentUpdate,
  });

  return (
    <div className="relative bg-graphite-deep/40 border border-white/[0.04] overflow-visible">
      {/* Gradient Accent Lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-neon-iris" />
            Discussion ({comments.length})
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy("top")}
              className={`px-4 py-2 text-xs tracking-wide uppercase font-medium transition-all duration-300 ${
                sortBy === "top"
                  ? "bg-white text-ink-black"
                  : "text-moon-grey/60 hover:text-white hover:bg-white/5 border border-white/10"
              }`}
            >
              Top
            </button>
            <button
              onClick={() => setSortBy("new")}
              className={`px-4 py-2 text-xs tracking-wide uppercase font-medium transition-all duration-300 ${
                sortBy === "new"
                  ? "bg-white text-ink-black"
                  : "text-moon-grey/60 hover:text-white hover:bg-white/5 border border-white/10"
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
              <div className="relative overflow-hidden flex items-center justify-between bg-graphite-light/50 border border-white/10 px-3 py-2 rounded-none mb-0">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-moon-grey-dark">Replying to</span>
                  <span className="text-neon-iris font-semibold">
                    {replyingTo.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setNewComment("");
                  }}
                  className="p-1 hover:bg-white/5 text-moon-grey hover:text-white transition-all duration-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-brand-danger/10 border border-brand-danger/20 rounded-xl text-sm text-brand-danger">
                {error}
              </div>
            )}
            <div className="flex gap-2 sm:gap-3">
              <div className="flex-shrink-0 hidden sm:block">
                <UserAvatar
                  name={user.display_name || user.username || "User"}
                  size="md"
                  imageUrl={user.avatar_url || undefined}
                />
              </div>
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={newComment}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewComment(value);
                    setError(null);
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
                    replyingTo
                      ? `Reply to ${replyingTo.name}...`
                      : "Share your thoughts..."
                  }
                  className={`w-full bg-ink-black border border-white/10 text-white text-sm placeholder-moon-grey/40 focus:border-neon-iris/50 focus:ring-1 focus:ring-neon-iris/20 transition-all resize-none min-h-[80px] leading-relaxed px-4 py-3 ${
                    replyingTo ? "rounded-none" : "rounded-none"
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
                    className="px-6 py-3 text-sm font-medium tracking-wide uppercase bg-white text-ink-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-2"
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
          <div className="relative overflow-hidden mb-6 p-4 bg-graphite-light/50 border border-white/[0.04] rounded-xl text-center">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
            <p className="text-moon-grey">
              Connect your wallet to join the discussion
            </p>
          </div>
        )}

        {/* Comments List - Flat Continuous View */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-neon-iris animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-graphite-light/50 border border-white/[0.04] flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-moon-grey-dark" />
            </div>
            <p className="text-moon-grey font-medium">No comments yet</p>
            <p className="text-moon-grey-dark text-sm mt-1">
              Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-white/[0.04] mt-6 pt-6">
              <div className="max-h-[600px] overflow-y-auto">
                {buildFlatCommentList(comments).map((item) => (
                  <div key={item.comment.id}>{renderComment(item)}</div>
                ))}
              </div>
            </div>

            {/* Load More button */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => loadComments(currentPage + 1, false)}
                  disabled={isLoadingMore}
                  className="px-6 py-3 text-sm font-medium tracking-wide uppercase bg-white text-ink-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-2"
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
      </div>

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
