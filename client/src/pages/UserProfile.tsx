import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getUserPosts,
  Post,
  PostComment,
  togglePostLike,
  togglePostCommentLike,
  followUser,
  unfollowUser,
  getFollowStatus,
  getComments,
  getCommentReplies,
  createPostComment,
  fetchUserTrades,
  Trade,
  createPost,
  fetchMarkets,
  buyKeys,
  sellKeys,
  getKeyPrice,
  getKeyOwnership,
} from "@/api/api";
import { Market, MarketOption } from "@/types/market";
import { formatDistanceToNow } from "@/utils/format";
import { toast } from "sonner";
import { useUserStore } from "@/stores/userStore";
import api from "@/config/axios";
import { ImageModal } from "@/components/ImageModal";
import { KeyPurchaseModal } from "@/components/KeyPurchaseModal";
import {
  ArrowLeft,
  Settings,
  TrendingUp,
  Award,
  BarChart3,
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  PlusCircle,
  Image as ImageIcon,
  Video,
  X,
  FileText,
  TrendingDown,
  Key,
  Lock,
} from "lucide-react";

// Animation variants matching Home page
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

interface UserProfileData {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
  is_following?: boolean;
  keys_supply?: number;
  required_keys_to_follow?: number;
}

type ProfileTab = "posts" | "markets" | "trades";

// User avatar with professional styling
const ProfileAvatar = ({
  name,
  imageUrl,
  size = "xl",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "lg" | "xl" | "2xl";
}) => {
  const sizes = {
    lg: "w-20 h-20 text-2xl",
    xl: "w-24 h-24 text-3xl",
    "2xl": "w-32 h-32 text-4xl",
  };

  // Professional muted color palette
  const colors = [
    "bg-neon-iris/20 text-neon-iris border-neon-iris/30",
    "bg-aqua-pulse/20 text-aqua-pulse border-aqua-pulse/30",
    "bg-graphite-light text-moon-grey border-white/10",
    "bg-white/10 text-white border-white/20",
  ];

  const colorIndex = name.charCodeAt(0) % colors.length;

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      className={`${sizes[size]} rounded-full object-cover border-2 border-white/10`}
    />
  ) : (
    <div
      className={`${sizes[size]} rounded-full ${colors[colorIndex]} border-2 flex items-center justify-center font-semibold`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// Small user avatar for posts
const UserAvatar = ({
  name,
  size = "md",
  imageUrl,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  imageUrl?: string;
}) => {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const colors = [
    "bg-neon-iris/20 text-neon-iris border-neon-iris/30",
    "bg-aqua-pulse/20 text-aqua-pulse border-aqua-pulse/30",
    "bg-graphite-light text-moon-grey border-white/10",
  ];

  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div className="relative flex-shrink-0">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover border border-white/10`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full ${colors[colorIndex]} border flex items-center justify-center font-semibold`}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};

// Reaction bar for posts - refined minimal design
const ReactionBar = ({
  isLiked,
  likesCount,
  commentsCount,
  onLike,
  onComment,
  onShare,
}: {
  isLiked: boolean;
  likesCount: number;
  commentsCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}) => (
  <div className="flex items-center justify-between pt-4 border-t border-white/5">
    <div className="flex items-center gap-4">
      <button
        onClick={onLike}
        className={`flex items-center gap-2 py-2 transition-all duration-300 group ${
          isLiked
            ? "text-brand-danger"
            : "text-moon-grey/40 hover:text-brand-danger"
        }`}
      >
        <Heart
          className={`w-4 h-4 transition-all duration-300 ${
            isLiked ? "fill-current" : ""
          }`}
        />
        <span className="text-sm tabular-nums font-light">{likesCount}</span>
      </button>
      <button
        onClick={onComment}
        className="flex items-center gap-2 py-2 text-moon-grey/40 hover:text-neon-iris transition-all group"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm tabular-nums font-light">
          {commentsCount}
        </span>
      </button>
    </div>
    <button
      onClick={onShare}
      className="py-2 text-moon-grey/40 hover:text-aqua-pulse transition-all"
    >
      <Share2 className="w-4 h-4" />
    </button>
  </div>
);

// Reply Section Component
const ReplySection = ({
  postId,
  isOpen,
  onReplyCreated,
}: {
  postId: string;
  isOpen: boolean;
  onReplyCreated: () => void;
}) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [repliesMap, setRepliesMap] = useState<Map<string, PostComment[]>>(
    new Map()
  );
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, postId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const { comments: data } = await getComments(postId, { limit: 50 });
      setComments(data);
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReplies = async (commentId: string) => {
    if (repliesMap.has(commentId) || loadingReplies.has(commentId)) return;

    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const { replies } = await getCommentReplies(commentId, { limit: 50 });
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

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createPostComment({
        post_id: postId,
        content: replyContent.trim(),
        parent_comment_id: replyingTo?.id || undefined,
      });
      setReplyContent("");
      setReplyingTo(null);
      loadComments();
      // Reload replies if we were replying to a comment
      if (replyingTo?.id) {
        setRepliesMap((prev) => {
          const next = new Map(prev);
          next.delete(replyingTo.id);
          return next;
        });
        loadReplies(replyingTo.id);
      }
      onReplyCreated();
      toast.success("Reply posted!");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyToComment = (
    commentId: string,
    displayName: string | null,
    username: string
  ) => {
    const name = displayName || username;
    setReplyingTo({ id: commentId, name });
    setReplyContent(`@${name} `);
    inputRef.current?.focus();
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const result = await togglePostCommentLike(commentId);
      // Update the comment in the comments list
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                is_liked: result.liked,
                likes_count: result.likes_count,
              }
            : c
        )
      );
      // Update the comment in replies map if it exists
      setRepliesMap((prev) => {
        const next = new Map(prev);
        for (const [parentId, replies] of next.entries()) {
          const updatedReplies = replies.map((r) =>
            r.id === commentId
              ? {
                  ...r,
                  is_liked: result.liked,
                  likes_count: result.likes_count,
                }
              : r
          );
          next.set(parentId, updatedReplies);
        }
        return next;
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to like comment");
    }
  };

  // Build a flat list of all comments with their parent info
  const buildFlatCommentList = (
    comments: PostComment[],
    parentComment?: PostComment,
    result: Array<{
      comment: PostComment;
      parent?: PostComment;
      depth: number;
    }> = []
  ): Array<{ comment: PostComment; parent?: PostComment; depth: number }> => {
    for (const comment of comments) {
      result.push({
        comment,
        parent: parentComment,
        depth: parentComment ? 1 : 0,
      });

      const replies = repliesMap.get(comment.id);
      if (replies && expandedReplies.has(comment.id)) {
        // Recursively add replies with this comment as parent
        buildFlatCommentList(replies, comment, result);
      }
    }
    return result;
  };

  const renderComment = (item: {
    comment: PostComment;
    parent?: PostComment;
    depth: number;
  }) => {
    const { comment, parent, depth } = item;
    const replies = repliesMap.get(comment.id);
    const hasLoadedReplies = repliesMap.has(comment.id);
    const hasReplies = replies && replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const isReply = !!parent;

    return (
      <div
        key={comment.id}
        className={`relative pr-3 py-3 hover:bg-graphite-light transition-colors border-b border-white/5 last:border-b-0 ${
          isReply ? "pl-12 ml-8" : "pl-3"
        }`}
      >
        {/* YouTube-style threading branch for replies - vertical line on left */}
        {isReply && (
          <>
            {/* Vertical line connecting to parent - YouTube style grey/white */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />
            {/* Horizontal connector line from vertical to avatar */}
            <div className="absolute left-0 top-[18px] w-8 h-px bg-white/10" />
          </>
        )}

        <div className="flex gap-3 relative">
          <div className="flex-shrink-0 relative">
            <UserAvatar
              name={comment.display_name || comment.username}
              size="sm"
              imageUrl={comment.avatar_url || undefined}
            />
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
              <span className="font-semibold text-sm text-white">
                {comment.display_name || comment.username}
              </span>
              {depth === 0 && (
                <span className="text-xs text-moon-grey-dark">
                  @{comment.username}
                </span>
              )}
              <span className="text-xs text-moon-grey-dark">
                {comment.created_at
                  ? formatDistanceToNow(Number(comment.created_at))
                  : "now"}
              </span>
            </div>
            <p className="text-sm text-moon-grey-light mt-1 whitespace-pre-wrap leading-relaxed">
              {comment.content}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => handleLikeComment(comment.id)}
                className={`flex items-center gap-1.5 text-xs transition-colors font-medium ${
                  comment.is_liked
                    ? "text-brand-danger hover:text-brand-danger/80"
                    : "text-moon-grey-dark hover:text-brand-danger"
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    comment.is_liked ? "fill-current" : ""
                  }`}
                />
                {comment.likes_count !== undefined && comment.likes_count > 0
                  ? comment.likes_count
                  : ""}
              </button>
              <button
                onClick={() =>
                  handleReplyToComment(
                    comment.id,
                    comment.display_name,
                    comment.username
                  )
                }
                className="text-xs text-moon-grey-dark hover:text-neon-iris transition-colors font-medium"
              >
                Reply
              </button>
              <button
                onClick={() => toggleReplies(comment.id)}
                className="text-xs text-moon-grey-dark hover:text-neon-iris transition-colors font-medium"
              >
                {isExpanded
                  ? "Hide replies"
                  : hasLoadedReplies && hasReplies
                  ? `${replies.length} ${
                      replies.length === 1 ? "reply" : "replies"
                    }`
                  : hasLoadedReplies && !hasReplies
                  ? "No replies"
                  : "View replies"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="border-t border-white/5 bg-graphite-deep">
      {/* Reply input */}
      <div className="p-5 border-b border-white/5">
        {replyingTo && (
          <div className="mb-3 px-3 py-2 bg-graphite-light border border-white/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-moon-grey-dark">Replying to</span>
              <span className="text-neon-iris font-semibold">
                {replyingTo.name}
              </span>
            </div>
            <button
              onClick={() => {
                setReplyingTo(null);
                setReplyContent("");
              }}
              className="p-1 rounded-lg hover:bg-graphite-hover text-moon-grey hover:text-white transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="space-y-3">
          <textarea
            ref={inputRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitReply();
              }
            }}
            placeholder={
              replyingTo ? `Reply to ${replyingTo.name}...` : "Write a reply..."
            }
            rows={replyContent.split("\n").length + 1}
            className="w-full bg-graphite-light border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-moon-grey-dark focus:outline-none focus:ring-2 focus:ring-neon-iris/30 focus:border-neon-iris/50 focus:bg-graphite-hover transition-all resize-none min-h-[44px] max-h-32 leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Press Enter to reply, Shift+Enter for new line
            </div>
            <button
              onClick={handleSubmitReply}
              disabled={!replyContent.trim() || isSubmitting}
              className="px-5 py-2 rounded-lg bg-neon-iris text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neon-iris-light transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  <span>Reply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Comments list - flat continuous view */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-5 text-center text-moon-grey-dark text-sm">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-5 text-center text-moon-grey-dark text-sm">
            No replies yet
          </div>
        ) : (
          <div>
            {buildFlatCommentList(comments).map((item) => (
              <div key={item.comment.id}>{renderComment(item)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Post card for profile - refined minimal design
const ProfilePostCard = ({
  post,
  onLike,
  onToggleReplies,
  showReplies,
  onReplyCreated,
  profile,
  onImageClick,
}: {
  post: Post;
  onLike: () => void;
  onToggleReplies: () => void;
  showReplies: boolean;
  onReplyCreated: () => void;
  profile: UserProfileData;
  onImageClick?: (imageUrl: string) => void;
}) => {
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + `/post/${post.id}`
      );
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <article className="border border-white/5 transition-all duration-300 hover:border-white/10 group">
      {/* Header */}
      <div className="p-5 sm:p-6 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <UserAvatar
              name={profile.display_name || profile.username}
              size="md"
              imageUrl={profile.avatar_url || undefined}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm">
                {profile.display_name || profile.username}
              </span>
              {profile.total_pnl > 10000 && (
                <span className="text-[10px] tracking-wider uppercase text-neon-iris">
                  VIP
                </span>
              )}
              <span className="text-moon-grey/30">·</span>
              <span className="text-xs text-moon-grey/50 font-light">
                {post.created_at
                  ? formatDistanceToNow(Number(post.created_at))
                  : "now"}
              </span>
            </div>
            <p className="text-xs text-moon-grey/40 mt-0.5 font-light">
              @{profile.username.length > 12
                ? profile.username.substring(0, 12) + "..."
                : profile.username}
            </p>
          </div>
          <button className="p-2 text-moon-grey/30 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Market Link */}
      {post.market_question && (
        <Link
          to={`/market/${post.market_id}`}
          className="mx-5 sm:mx-6 mb-4 flex items-center gap-3 px-4 py-3 border border-white/5 transition-all hover:border-neon-iris/20 hover:bg-white/[0.02]"
        >
          <BarChart3 className="w-4 h-4 text-neon-iris/60 flex-shrink-0" />
          <span className="text-sm text-moon-grey/70 hover:text-white line-clamp-1 font-light flex-1">
            {post.market_question}
          </span>
          <svg
            className="w-4 h-4 text-moon-grey/30 ml-auto flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      )}

      {/* Content */}
      <div className="px-5 sm:px-6 pb-4 relative">
        <p className="text-white/90 leading-relaxed whitespace-pre-wrap text-sm font-light">
          {post.content}
        </p>
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="relative mx-5 sm:mx-6 mb-4 overflow-hidden border border-white/5">
          <img
            src={post.image_url}
            alt="Post attachment"
            loading="lazy"
            className="w-full max-h-[500px] object-cover max-w-full cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick?.(post.image_url!)}
          />
        </div>
      )}

      {/* Video */}
      {post.video_url && (
        <div
          className="relative mx-5 sm:mx-6 mb-4 overflow-hidden border border-white/5 bg-ink-black"
          onClick={(e) => e.stopPropagation()}
        >
          <video
            src={post.video_url}
            controls
            className="w-full max-h-[500px] object-contain max-w-full"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {/* Reactions */}
      <div className="px-5 sm:px-6 pb-4">
        <ReactionBar
          isLiked={post.is_liked || false}
          likesCount={post.likes_count}
          commentsCount={post.comments_count}
          onLike={onLike}
          onComment={onToggleReplies}
          onShare={handleShare}
        />
      </div>

      {/* Replies toggle */}
      <button
        onClick={onToggleReplies}
        className="w-full px-5 sm:px-6 py-4 border-t border-white/5 text-sm text-moon-grey/50 hover:text-white hover:bg-white/[0.02] transition-all flex items-center gap-2 font-light tracking-wide"
      >
        <MessageCircle className="w-4 h-4 text-neon-iris/60" />
        {showReplies
          ? "Hide replies"
          : post.comments_count > 0
          ? `View ${post.comments_count} ${
              post.comments_count === 1 ? "reply" : "replies"
            }`
          : "Reply"}
      </button>

      {/* Reply Section */}
      <ReplySection
        postId={post.id}
        isOpen={showReplies}
        onReplyCreated={onReplyCreated}
      />
    </article>
  );
};

// Profile tabs - refined minimal design
const ProfileTabs = ({
  activeTab,
  onTabChange,
  postsCount,
  showTradesTab,
  isLoggedIn,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  postsCount: number;
  showTradesTab: boolean;
  isLoggedIn: boolean;
}) => {
  // Only show trades tab if user is logged in AND has access (following or own profile)
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: postsCount },
    { id: "markets", label: "Markets" },
    ...(isLoggedIn && showTradesTab ? [{ id: "trades" as ProfileTab, label: "Trades" }] : []),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-5 sm:px-8 py-4 text-sm font-medium tracking-wide uppercase transition-all relative whitespace-nowrap flex items-center gap-2 ${
            activeTab === tab.id
              ? "text-white"
              : "text-moon-grey/60 hover:text-white"
          }`}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span
              className={`text-[10px] px-2 py-0.5 tracking-wider ${
                activeTab === tab.id
                  ? "text-neon-iris"
                  : "text-moon-grey/40"
              }`}
            >
              {tab.count}
            </span>
          )}
          {activeTab === tab.id && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris to-transparent"
            />
          )}
        </button>
      ))}
    </div>
  );
};

// Empty state for profile sections - refined minimal design
const EmptySection = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) => (
  <motion.div 
    className="flex flex-col items-center justify-center py-20 sm:py-28 px-4 text-center"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <div className="w-16 h-16 sm:w-20 sm:h-20 border border-white/10 flex items-center justify-center mb-6">
      <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-moon-grey/40" />
    </div>
    <h3 className="text-lg sm:text-xl font-light text-white mb-2">{title}</h3>
    <p className="text-moon-grey/50 text-sm font-light max-w-xs">{subtitle}</p>
  </motion.div>
);



// Market card component - refined minimal design
const MarketFeedCard = ({
  market,
  onImageClick,
}: {
  market: Market;
  onImageClick?: (imageUrl: string) => void;
}) => {
  const navigate = useNavigate();

  // For binary markets, show both Yes and No from the single option
  // For other markets, show first 2-3 options
  let displayItems: Array<{
    option: MarketOption;
    side: "yes" | "no" | "other";
    price: number;
  }> = [];

  if (market.is_binary && market.options && market.options.length > 0) {
    const option = market.options[0];
    const yesPrice = option.yes_price ?? 0.5;
    const noPrice = option.no_price ?? 1 - yesPrice;
    displayItems = [
      { option, side: "yes", price: yesPrice },
      { option, side: "no", price: noPrice },
    ];
  } else if (market.options && market.options.length > 0) {
    displayItems = market.options.slice(0, 2).map((option) => ({
      option,
      side: "other" as const,
      price: option.yes_price ?? 0.5,
    }));
  }

  return (
    <article
      className="p-5 sm:p-6 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/5 group"
      onClick={() => navigate(`/market/${market.id}`)}
    >
      <div className="flex gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 border border-white/10 flex items-center justify-center">
            <PlusCircle className="w-4 h-4 text-neon-iris/60" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] tracking-[0.2em] uppercase text-neon-iris/60">
              Created market
            </span>
            <span className="text-moon-grey/30">·</span>
            <span className="text-xs text-moon-grey/40 font-light">
              {market.created_at
                ? formatDistanceToNow(Number(market.created_at))
                : "now"}
            </span>
          </div>

          {/* Question */}
          <p className="text-base sm:text-lg text-white font-light leading-relaxed mb-4">
            {market.question}
          </p>

          {/* Media: Image + Options */}
          <div className="flex gap-4">
            {/* Image */}
            {market.image_url && (
              <div
                className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-white/5"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageClick?.(market.image_url!);
                }}
              >
                <img
                  src={market.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Options */}
            {displayItems.length > 0 && (
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {displayItems.map((item, idx) => {
                  const { option, side, price } = item;
                  const isYes = side === "yes";
                  const isNo = side === "no";
                  const label = isYes ? "Yes" : isNo ? "No" : option.option_label;

                  return (
                    <div
                      key={`${option.id}-${side}-${idx}`}
                      className={`flex items-center gap-3 px-3 py-2 transition-colors border ${
                        isYes
                          ? "border-aqua-pulse/20 bg-aqua-pulse/5"
                          : isNo
                          ? "border-brand-danger/20 bg-brand-danger/5"
                          : "border-white/5 bg-white/[0.02]"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/market/${market.id}`);
                      }}
                    >
                      <span
                        className={`text-sm font-light flex-1 truncate ${
                          isYes
                            ? "text-aqua-pulse"
                            : isNo
                            ? "text-brand-danger"
                            : "text-white"
                        }`}
                      >
                        {label}
                      </span>
                      <span className="text-sm text-moon-grey/50 font-light tabular-nums">
                        {(price * 100).toFixed(0)}¢
                      </span>
                    </div>
                  );
                })}
                {!market.is_binary && market.options && market.options.length > 2 && (
                  <div className="px-3 py-1">
                    <span className="text-xs text-moon-grey/40 font-light">
                      +{market.options.length - 2} more
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

// Trade card component - refined minimal design
const TradeCard = ({ trade }: { trade: Trade }) => {
  const navigate = useNavigate();
  const isBuy = trade.action === "buy";
  const isYes = trade.side === "yes";

  return (
    <article
      className="relative p-5 sm:p-6 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/5 group"
      onClick={() => trade.market_id && navigate(`/market/${trade.market_id}`)}
    >
      <div className="flex gap-4">
        {/* Action Icon */}
        <div className="flex-shrink-0">
          <div
            className={`w-10 h-10 border flex items-center justify-center ${
              isBuy
                ? "border-aqua-pulse/20 text-aqua-pulse"
                : "border-brand-danger/20 text-brand-danger"
            }`}
          >
            {isBuy ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Action + Time */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`text-[10px] tracking-[0.2em] uppercase ${
                isBuy ? "text-aqua-pulse" : "text-brand-danger"
              }`}
            >
              {isBuy ? "Bought" : "Sold"}
            </span>
            <span className="text-moon-grey/30">·</span>
            <span className="text-xs text-moon-grey/40 font-light">
              {trade.created_at
                ? formatDistanceToNow(Number(trade.created_at))
                : "now"}
            </span>
          </div>

          {/* Market Question */}
          {trade.market_question && (
            <p className="text-white/90 text-sm sm:text-base font-light mb-3 line-clamp-2 leading-relaxed">
              {trade.market_question}
            </p>
          )}

          {/* Trade Details */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Option Badge */}
            <span
              className={`inline-flex items-center px-3 py-1 text-xs font-light border ${
                isYes
                  ? "border-aqua-pulse/20 text-aqua-pulse bg-aqua-pulse/5"
                  : "border-brand-danger/20 text-brand-danger bg-brand-danger/5"
              }`}
            >
              {trade.option_label || (isYes ? "Yes" : "No")}
            </span>

            {/* Shares */}
            <span className="text-sm text-moon-grey/50 font-light tabular-nums">
              {(trade.shares / 1_000_000).toFixed(2)} shares
            </span>

            {/* Price */}
            {trade.pricePerShare !== undefined && (
              <span className="text-sm text-moon-grey/40 font-light">
                @ {(trade.pricePerShare * 100).toFixed(0)}¢
              </span>
            )}

            {/* Amount */}
            {trade.amount && (
              <span
                className={`text-sm font-light ml-auto tabular-nums ${
                  isBuy ? "text-aqua-pulse" : "text-brand-danger"
                }`}
              >
                {isBuy ? "+" : "-"}${(Math.abs(trade.amount) / 1_000_000).toFixed(2)}
              </span>
            )}
          </div>

          {/* Market Link */}
          {trade.market_id && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-moon-grey/30 group-hover:text-neon-iris/60 transition-colors">
              <span className="font-light">View market</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

// Main component
export const UserProfile = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [keyPrice, setKeyPrice] = useState<number | null>(null);
  const [keyOwnership, setKeyOwnership] = useState<number>(0);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [keyPurchaseQuantity, setKeyPurchaseQuantity] = useState(1);
  const [isBuyingKeys, setIsBuyingKeys] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Update purchase quantity when profile loads to match required keys
  useEffect(() => {
    if (profile?.required_keys_to_follow) {
      const required = profile.required_keys_to_follow;
      const needed = Math.max(1, required - keyOwnership);
      setKeyPurchaseQuantity(needed);
    }
  }, [profile?.required_keys_to_follow, keyOwnership]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );

  // Post creation state
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [newPostMediaPreview, setNewPostMediaPreview] = useState<string | null>(
    null
  );
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isOwnProfile =
    currentUser?.id === identifier || currentUser?.username === identifier;

  useEffect(() => {
    if (identifier) {
      loadProfile();
      checkFollowStatus();
    }
  }, [identifier]);

  useEffect(() => {
    if (profile?.id) {
      loadKeyInfo();
    }
  }, [profile?.id, profile?.keys_supply, isOwnProfile]);

  useEffect(() => {
    if (profile?.id) {
      loadPosts();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (identifier && activeTab === "trades") {
      // Check if user has access (own profile, has enough keys, or no key requirement)
      const hasAccess =
        isOwnProfile ||
        profile?.required_keys_to_follow === 0 ||
        (profile?.required_keys_to_follow &&
          keyOwnership >= profile.required_keys_to_follow);

      if (hasAccess) {
        loadTrades();
      }
    }
  }, [
    identifier,
    activeTab,
    isOwnProfile,
    profile?.required_keys_to_follow,
    keyOwnership,
  ]);

  useEffect(() => {
    if (identifier && activeTab === "markets" && profile?.id) {
      loadMarkets();
    }
  }, [identifier, activeTab, profile?.id]);

  const loadProfile = async () => {
    if (!identifier) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/user/profile/${identifier}`);
      setProfile(response.data.user);
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPosts = async () => {
    if (!profile?.id) return;
    setIsLoadingPosts(true);
    try {
      // Use the user ID from the profile
      const { posts: data } = await getUserPosts(profile.id);
      setPosts(data);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const loadKeyInfo = async () => {
    if (!profile?.id) return;
    setIsLoadingKeys(true);
    try {
      const [priceData, ownershipData] = await Promise.all([
        getKeyPrice(profile.id),
        isOwnProfile
          ? Promise.resolve({ quantity: profile.keys_supply || 0 })
          : getKeyOwnership(profile.id),
      ]);
      setKeyPrice(priceData.price_in_usdc);
      // Ensure quantity is a number
      const ownershipQuantity =
        typeof ownershipData.quantity === "number"
          ? ownershipData.quantity
          : parseFloat(String(ownershipData.quantity)) || 0;
      setKeyOwnership(ownershipQuantity);
    } catch (error) {
      console.error("Failed to load key info:", error);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const loadTrades = async () => {
    if (!identifier) return;
    setIsLoadingTrades(true);
    try {
      // Use the user ID from the profile if available, otherwise use identifier
      const userId = profile?.id || identifier;
      const { trades: data } = await fetchUserTrades(userId, {
        page: 1,
        limit: 50,
      });
      setTrades(data);
    } catch (error: any) {
      console.error("Failed to load trades:", error);
      if (error.response?.status === 403) {
        const errorData = error.response?.data;
        if (errorData?.required_keys !== undefined) {
          toast.error(
            `You need at least ${
              errorData.required_keys
            } key(s) to view trades. You have ${errorData.owned_keys || 0}.`
          );
        } else {
          toast.error("You must have access to view this user's trades");
        }
      } else {
        toast.error("Failed to load trades");
      }
    } finally {
      setIsLoadingTrades(false);
    }
  };

  const handleBuyKeys = async () => {
    if (!profile?.id || isBuyingKeys) return;
    setIsBuyingKeys(true);
    try {
      const result = await buyKeys({
        trader_id: profile.id,
        quantity: keyPurchaseQuantity,
      });
      toast.success(`Successfully purchased ${result.quantity} key(s)`);
      await loadKeyInfo();
      // Reload trades if we now have access
      if (
        profile.required_keys_to_follow &&
        result.quantity + keyOwnership >= profile.required_keys_to_follow
      ) {
        await loadTrades();
      }
      // Auto-follow if user just bought their first key
      if (keyOwnership === 0 && result.quantity >= 1 && !isFollowing) {
        try {
          await followUser(profile.id);
          setIsFollowing(true);
          await checkFollowStatus();
        } catch (error) {
          // Silently fail - user can manually follow if needed
          console.error("Auto-follow failed:", error);
        }
      }
    } catch (error: any) {
      console.error("Failed to buy keys:", error);
      toast.error(error.response?.data?.message || "Failed to buy keys");
    } finally {
      setIsBuyingKeys(false);
    }
  };

  const loadMarkets = async () => {
    if (!profile?.id) return;
    setIsLoadingMarkets(true);
    try {
      const { markets: data } = await fetchMarkets({
        creator: profile.id,
        page: 1,
        limit: 50,
      });
      setMarkets(data);
    } catch (error) {
      console.error("Failed to load markets:", error);
      toast.error("Failed to load markets");
    } finally {
      setIsLoadingMarkets(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!identifier || !currentUser || isOwnProfile) return;
    try {
      // Use the user ID from the profile if available, otherwise use identifier
      const userId = profile?.id || identifier;
      const { is_following } = await getFollowStatus(userId);
      setIsFollowing(is_following);
    } catch (error) {
      console.error("Failed to check follow status:", error);
    }
  };

  const handleFollow = async () => {
    if (!identifier || isFollowLoading) return;

    const requiredKeys = profile?.required_keys_to_follow || 1;

    // Check if user has keys before allowing follow
    if (!isFollowing && keyOwnership < requiredKeys) {
      toast.error(
        `You must purchase at least ${requiredKeys} key(s) to follow this user. You currently have ${keyOwnership}.`
      );
      // Switch to trades tab to show key purchase UI if not already there
      if (activeTab !== "trades") {
        setActiveTab("trades");
      }
      return;
    }

    setIsFollowLoading(true);
    try {
      // Use the user ID from the profile if available, otherwise use identifier
      const userId = profile?.id || identifier;
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        setProfile((prev) =>
          prev ? { ...prev, followers_count: prev.followers_count - 1 } : null
        );
        toast.success("Unfollowed");
      } else {
        await followUser(userId);
        setIsFollowing(true);
        setProfile((prev) =>
          prev ? { ...prev, followers_count: prev.followers_count + 1 } : null
        );
        toast.success("Following! 🎉");
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        const errorData = error.response?.data;
        if (errorData?.required_keys !== undefined) {
          toast.error(
            `You need to purchase at least ${
              errorData.required_keys
            } key(s) to follow this user. You currently have ${
              errorData.owned_keys || 0
            } key(s).`
          );
          // Switch to trades tab to show key purchase UI if not already there
          if (activeTab !== "trades") {
            setActiveTab("trades");
          }
        } else {
          toast.error(
            error.response?.data?.message ||
              "You must purchase keys to follow this user"
          );
        }
      } else {
        toast.error(error.response?.data?.error || "Action failed");
      }
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await togglePostLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: result.liked, likes_count: result.likes_count }
            : p
        )
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to like post");
    }
  };

  const toggleReplies = (postId: string) => {
    if (expandedReplies.has(postId)) {
      setExpandedReplies((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } else {
      setExpandedReplies((prev) => new Set(prev).add(postId));
    }
  };

  const handleReplyCreated = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
      )
    );
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Please select an image or video file");
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }

    setNewPostMedia(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewPostMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMedia = () => {
    setNewPostMedia(null);
    setNewPostMediaPreview(null);
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostMedia) {
      toast.error("Please add some content or media");
      return;
    }

    if (!currentUser) {
      toast.error("Please log in to create a post");
      return;
    }

    setIsCreatingPost(true);
    try {
      await createPost({
        content: newPostContent.trim() || "",
        media: newPostMedia || undefined,
      });

      // Reset form
      setNewPostContent("");
      setNewPostMedia(null);
      setNewPostMediaPreview(null);

      // Reload posts
      await loadPosts();
      toast.success("Post created!");
    } catch (error: any) {
      console.error("Failed to create post:", error);
      toast.error(error.response?.data?.error || "Failed to create post");
    } finally {
      setIsCreatingPost(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 bg-ink-black">
        <div className="relative h-48 sm:h-56 md:h-64">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.15),transparent_60%)]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20">
          <div className="animate-pulse flex gap-6 lg:gap-10">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-graphite-deep/50" />
            <div className="flex-1 space-y-4 pt-8">
              <div className="h-8 w-48 bg-graphite-deep/50 rounded" />
              <div className="h-4 w-32 bg-graphite-deep/30 rounded" />
              <div className="h-4 w-64 bg-graphite-deep/30 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-ink-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_60%)]" />
        <motion.div 
          className="relative text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-7xl sm:text-8xl font-extralight text-white/10 mb-6">404</div>
          <h1 className="text-2xl sm:text-3xl font-extralight text-white mb-3">User not found</h1>
          <p className="text-moon-grey/60 mb-8 font-light">
            This profile doesn't exist or has been removed
          </p>
          <button
            onClick={() => navigate(-1)}
            className="group px-6 py-3 text-sm font-medium tracking-wide uppercase text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go back</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-8 overflow-hidden bg-ink-black">
      {/* Hero cover area - refined atmospheric background matching Home */}
      <div className="relative h-48 sm:h-56 md:h-64">
        {/* Atmospheric gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.08),transparent_50%)]" />
          {/* Subtle grid - hidden on mobile for performance */}
          <div
            className="absolute inset-0 opacity-[0.03] hidden sm:block"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
              backgroundSize: "80px 80px",
            }}
          />
        </div>
        
        {/* Gradient line accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Back button - refined */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2.5 text-moon-grey/60 hover:text-white transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        {/* Settings button (own profile) */}
        {isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              to="/settings"
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 text-moon-grey/60 hover:text-white transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </motion.div>
        )}
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header - refined aesthetic */}
        <motion.div 
          className="flex flex-col sm:flex-row gap-6 lg:gap-10 -mt-16 sm:-mt-20 mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Avatar with border */}
          <div className="flex-shrink-0 self-start">
            <div className="p-1 bg-ink-black rounded-full">
              <ProfileAvatar
                name={profile.display_name || profile.username}
                imageUrl={profile.avatar_url}
                size="2xl"
              />
            </div>
          </div>

          {/* Profile info */}
          <div className="flex-1 min-w-0 space-y-5 pt-4 sm:pt-8">
            {/* Name and verification */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white break-words leading-[1.1]">
                  {profile.display_name || profile.username}
                </h1>
                {/* Verification badge */}
                {profile.total_trades > 100 && (
                  <span title="Verified trader" className="flex-shrink-0">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-neon-iris" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-moon-grey/60 text-sm font-light tracking-wide">
                  @{profile.username.length > 15
                    ? profile.username.substring(0, 15) + "..."
                    : profile.username}
                </p>
                {profile.created_at && (
                  <>
                    <span className="text-moon-grey/30">·</span>
                    <p className="text-moon-grey/40 text-sm font-light">
                      Joined{" "}
                      {(() => {
                        const timestamp = Number(profile.created_at);
                        const date = new Date(
                          timestamp > 100000000000 ? timestamp : timestamp * 1000
                        );
                        if (isNaN(date.getTime())) return "recently";
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        });
                      })()}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-moon-grey/70 text-base sm:text-lg leading-relaxed break-words max-w-2xl font-light">
                {profile.bio}
              </p>
            )}

            {/* Stats - refined minimal design */}
            <div className="flex items-center gap-8 sm:gap-12">
              <div className="text-center sm:text-left">
                <div className="text-xl sm:text-2xl font-light text-white tabular-nums">
                  {profile.followers_count.toLocaleString()}
                </div>
                <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50">
                  Followers
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center sm:text-left">
                <div className="text-xl sm:text-2xl font-light text-white tabular-nums">
                  {(profile.keys_supply || 0).toLocaleString()}
                </div>
                <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50">
                  Keys
                </div>
              </div>
              {currentUser && keyOwnership > 0 && (
                <>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center sm:text-left">
                    <div className="text-xl sm:text-2xl font-light text-white tabular-nums">
                      {keyOwnership.toFixed(2)}
                    </div>
                    <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50">
                      Owned
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons - refined minimal design */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              {!isOwnProfile && currentUser && (
                <>
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className="group px-5 sm:px-6 py-3 text-sm font-medium tracking-wide uppercase bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>{keyPrice !== null ? `$${keyPrice.toFixed(4)}` : "View Keys"}</span>
                  </button>
                  <button
                    onClick={handleFollow}
                    disabled={
                      isFollowLoading ||
                      (keyOwnership < (profile?.required_keys_to_follow || 1) &&
                        !isFollowing)
                    }
                    className={`group px-5 sm:px-6 py-3 text-sm font-medium tracking-wide uppercase transition-all duration-300 border inline-flex items-center gap-2 ${
                      isFollowing
                        ? "text-white border-white/20 hover:border-white/40 hover:bg-white/5"
                        : keyOwnership < (profile?.required_keys_to_follow || 1)
                        ? "text-moon-grey/40 border-white/10 cursor-not-allowed"
                        : "bg-white text-ink-black hover:bg-moon-grey-light border-transparent"
                    }`}
                    title={
                      keyOwnership < (profile?.required_keys_to_follow || 1) &&
                      !isFollowing
                        ? `Purchase at least ${
                            profile?.required_keys_to_follow || 1
                          } key(s) to follow`
                        : ""
                    }
                  >
                    {isFollowLoading ? (
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : isFollowing ? (
                      "Following"
                    ) : keyOwnership <
                      (profile?.required_keys_to_follow || 1) ? (
                      `${profile?.required_keys_to_follow || 1} Keys Required`
                    ) : (
                      "Follow"
                    )}
                  </button>
                  {!isFollowing &&
                    keyOwnership < (profile?.required_keys_to_follow || 1) && (
                      <div className="text-[10px] text-moon-grey/40 flex items-center gap-1.5 tracking-wider uppercase">
                        <Key className="w-3 h-3" />
                        <span>
                          {keyOwnership.toFixed(2)} / {profile?.required_keys_to_follow || 1}
                        </span>
                      </div>
                    )}
                </>
              )}

              {isOwnProfile && (
                <Link
                  to="/settings"
                  className="group px-5 sm:px-6 py-3 text-sm font-medium tracking-wide uppercase text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 inline-flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Edit Profile</span>
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* Trading stats - refined minimal design matching Home */}
        <motion.div 
          className="py-8 sm:py-12 border-t border-b border-white/5 mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-neon-iris/80 font-medium mb-6 sm:mb-8">
            Trading Performance
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            <div className="group">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extralight text-white tabular-nums mb-2">
                {profile.total_trades.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50 flex items-center gap-2">
                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-neon-iris/60" />
                Total Trades
              </div>
            </div>
            <div className="group">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extralight text-white tabular-nums mb-2">
                ${(profile.total_trades * 100).toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50 flex items-center gap-2">
                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-aqua-pulse/60" />
                Volume
              </div>
            </div>
            <div className="group">
              <div
                className={`text-3xl sm:text-4xl lg:text-5xl font-extralight tabular-nums mb-2 ${
                  profile.total_pnl >= 0
                    ? "text-aqua-pulse"
                    : "text-brand-danger"
                }`}
              >
                {profile.total_pnl >= 0 ? "+" : ""}${Math.abs(profile.total_pnl).toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/50 flex items-center gap-2">
                {profile.total_pnl >= 0 ? (
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-aqua-pulse/60" />
                ) : (
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-brand-danger/60" />
                )}
                Total P&L
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs - refined with divider line */}
        <div className="border-b border-white/5">
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            postsCount={profile.posts_count}
            showTradesTab={isFollowing || isOwnProfile}
            isLoggedIn={!!currentUser}
          />
        </div>

        {/* Tab content */}
        <motion.div 
          className="py-8 sm:py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {activeTab === "posts" && (
            <>
              {/* Create Post Form (only for own profile) - refined design */}
              {isOwnProfile && (
                <motion.div 
                  className="mb-8 border border-white/5 p-6 sm:p-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-4">
                    Share an Update
                  </div>
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share your trading insights..."
                    className="w-full bg-transparent border-0 border-b border-white/10 px-0 py-3 text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 resize-none transition-all text-base leading-relaxed min-h-[100px] font-light"
                    rows={4}
                    maxLength={5000}
                  />

                  {/* Character count */}
                  {newPostContent.length > 0 && (
                    <div className="mt-2 text-[10px] text-moon-grey/40 text-right tracking-wider">
                      {newPostContent.length}/5000
                    </div>
                  )}

                  {/* Media Preview */}
                  {newPostMediaPreview && (
                    <div className="relative mt-6 overflow-hidden border border-white/10">
                      {newPostMedia?.type.startsWith("image/") ? (
                        <img
                          src={newPostMediaPreview}
                          alt="Preview"
                          className="w-full max-h-80 object-cover"
                        />
                      ) : (
                        <video
                          src={newPostMediaPreview}
                          controls
                          className="w-full max-h-80 object-contain bg-ink-black"
                        />
                      )}
                      <button
                        onClick={handleRemoveMedia}
                        className="absolute top-3 right-3 p-2 bg-ink-black/80 text-white/60 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <label className="cursor-pointer group">
                        <div className="p-2.5 text-moon-grey/40 hover:text-neon-iris transition-colors">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleMediaChange}
                          className="hidden"
                        />
                      </label>
                      <label className="cursor-pointer group">
                        <div className="p-2.5 text-moon-grey/40 hover:text-aqua-pulse transition-colors">
                          <Video className="w-5 h-5" />
                        </div>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleMediaChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <button
                      onClick={handleCreatePost}
                      disabled={
                        isCreatingPost ||
                        (!newPostContent.trim() && !newPostMedia)
                      }
                      className="px-6 py-2.5 bg-white text-ink-black text-sm font-medium tracking-wide uppercase hover:bg-moon-grey-light transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isCreatingPost ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-ink-black/30 border-t-ink-black rounded-full animate-spin" />
                          Posting...
                        </span>
                      ) : (
                        "Post"
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {isLoadingPosts ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="border border-white/5 p-5 sm:p-6 animate-pulse">
                      <div className="flex gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-white/5" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-white/5" />
                          <div className="h-3 w-20 bg-white/5" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-white/5" />
                        <div className="h-4 w-3/4 bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <EmptySection
                  icon={FileText}
                  title="No posts yet"
                  subtitle={
                    isOwnProfile
                      ? "Share your first post"
                      : "This user hasn't posted yet"
                  }
                />
              ) : (
                <motion.div 
                  className="space-y-4"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      variants={fadeInUp}
                      custom={index}
                    >
                      <ProfilePostCard
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onToggleReplies={() => toggleReplies(post.id)}
                        showReplies={expandedReplies.has(post.id)}
                        onReplyCreated={() => handleReplyCreated(post.id)}
                        profile={profile}
                        onImageClick={(imageUrl) => setSelectedImage(imageUrl)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}

          {activeTab === "markets" && (
            <>
              {isLoadingMarkets ? (
                <div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-5 sm:p-6 border-b border-white/5 animate-pulse"
                    >
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white/5 flex-shrink-0" />
                        <div className="flex-1 space-y-3">
                          <div className="h-3 w-24 bg-white/5" />
                          <div className="h-5 w-full bg-white/5" />
                          <div className="h-4 w-40 bg-white/5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : markets.length === 0 ? (
                <EmptySection
                  icon={BarChart3}
                  title="No markets"
                  subtitle={
                    isOwnProfile
                      ? "Create your first prediction market"
                      : "This user hasn't created any markets"
                  }
                />
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {markets.map((market, index) => (
                    <motion.div
                      key={market.id}
                      variants={fadeInUp}
                      custom={index}
                    >
                      <MarketFeedCard
                        market={market}
                        onImageClick={(imageUrl) => setSelectedImage(imageUrl)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}

          {activeTab === "trades" && (
            <>
              {!isOwnProfile &&
              (profile?.required_keys_to_follow || 1) > 0 &&
              keyOwnership < (profile?.required_keys_to_follow || 1) ? (
                <motion.div 
                  className="py-20 sm:py-28"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 border border-neon-iris/20 flex items-center justify-center mb-8">
                      <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-neon-iris/60" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extralight text-white mb-4">
                      Keys Required
                    </h3>
                    <p className="text-moon-grey/60 mb-10 text-sm sm:text-base leading-relaxed font-light">
                      You need at least {profile?.required_keys_to_follow || 1}{" "}
                      key(s) to view this trader's trades. You currently have{" "}
                      <span className="text-white">
                        {keyOwnership.toFixed(2)}
                      </span>{" "}
                      key(s).
                    </p>
                    {keyPrice !== null && (
                      <div className="border border-white/10 w-full max-w-md relative overflow-hidden">
                        {/* Gradient line accent at top */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />
                        
                        {/* Header section */}
                        <div className="p-5 sm:p-8 border-b border-white/5">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 flex-shrink-0 border border-neon-iris/20 flex items-center justify-center">
                              <Key className="w-4 h-4 text-neon-iris/80" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] tracking-[0.2em] uppercase text-neon-iris/80 mb-1">
                                Purchase Keys
                              </div>
                              <p className="text-lg font-extralight text-white">
                                Unlock Access
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            <div className="min-w-0">
                              <p className="text-[10px] text-moon-grey/50 uppercase tracking-[0.2em] mb-2">
                                Price per Key
                              </p>
                              <p className="text-xl sm:text-3xl font-extralight text-white tabular-nums">
                                ${keyPrice.toFixed(4)}
                              </p>
                            </div>
                            <div className="text-right min-w-0">
                              <p className="text-[10px] text-moon-grey/50 uppercase tracking-[0.2em] mb-2">
                                Total Supply
                              </p>
                              <p className="text-xl sm:text-3xl font-extralight text-white tabular-nums">
                                {profile.keys_supply || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Quantity section */}
                        <div className="p-5 sm:p-8">
                          <label className="block text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-4">
                            Quantity
                          </label>
                          <div className="flex gap-2 mb-6 min-w-0">
                            <button
                              onClick={() =>
                                setKeyPurchaseQuantity(
                                  Math.max(1, keyPurchaseQuantity - 1)
                                )
                              }
                              className="w-11 sm:w-12 flex-shrink-0 py-3 border border-white/10 text-white hover:bg-white/5 transition-colors font-light flex items-center justify-center"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={keyPurchaseQuantity}
                              onChange={(e) =>
                                setKeyPurchaseQuantity(
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              className="flex-1 min-w-0 px-2 sm:px-4 py-3 bg-transparent border border-white/10 text-white text-center placeholder-moon-grey/30 focus:outline-none focus:border-neon-iris/50 text-xl font-extralight tabular-nums transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() =>
                                setKeyPurchaseQuantity(keyPurchaseQuantity + 1)
                              }
                              className="w-11 sm:w-12 flex-shrink-0 py-3 border border-white/10 text-white hover:bg-white/5 transition-colors font-light flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Estimated cost */}
                          <div className="border border-white/5 p-4 mb-6">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50">
                                Estimated Cost
                              </span>
                              <span className="text-xl font-extralight text-white tabular-nums">
                                ${(keyPrice * keyPurchaseQuantity).toFixed(4)}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={handleBuyKeys}
                            disabled={isBuyingKeys || isLoadingKeys}
                            className="w-full py-4 bg-white text-ink-black font-medium tracking-wide uppercase text-sm hover:bg-moon-grey-light transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                          >
                            {isBuyingKeys ? (
                              <>
                                <div className="w-4 h-4 border-2 border-ink-black/30 border-t-ink-black rounded-full animate-spin" />
                                Purchasing...
                              </>
                            ) : (
                              <>
                                <Key className="w-4 h-4" />
                                Buy {keyPurchaseQuantity} Key
                                {keyPurchaseQuantity !== 1 ? "s" : ""}
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Footer info */}
                        <div className="px-5 sm:px-8 pb-5 sm:pb-8 pt-0 text-center space-y-3">
                          {keyOwnership > 0 && (
                            <div className="flex items-center justify-center gap-2 text-sm text-moon-grey/50 font-light">
                              <span>You own</span>
                              <span className="text-white tabular-nums">
                                {keyOwnership.toFixed(2)}
                              </span>
                              <span>key{keyOwnership !== 1 ? "s" : ""}</span>
                            </div>
                          )}
                          <p className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/30">
                            {profile?.required_keys_to_follow || 1} key
                            {(profile?.required_keys_to_follow || 1) > 1 ? "s" : ""}{" "}
                            required to follow • Bonding curve pricing
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : isLoadingTrades ? (
                <div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-5 sm:p-6 border-b border-white/5 animate-pulse"
                    >
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white/5 flex-shrink-0" />
                        <div className="flex-1 space-y-3">
                          <div className="h-3 w-24 bg-white/5" />
                          <div className="h-4 w-full bg-white/5" />
                          <div className="h-3 w-40 bg-white/5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : trades.length === 0 ? (
                <EmptySection
                  icon={TrendingUp}
                  title="No trades yet"
                  subtitle={
                    isOwnProfile
                      ? "Start trading to see your activity here"
                      : "This user hasn't made any trades yet"
                  }
                />
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {trades.map((trade, index) => (
                    <motion.div
                      key={trade.id}
                      variants={fadeInUp}
                      custom={index}
                    >
                      <TradeCard trade={trade} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={selectedImage !== null}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage || ""}
        alt="Image"
      />

      {/* Key Purchase Modal */}
      {profile && (
        <KeyPurchaseModal
          isOpen={showKeyModal}
          onClose={() => setShowKeyModal(false)}
          traderName={profile.display_name || profile.username || "Trader"}
          currentSupply={profile.keys_supply || 1}
          currentPrice={keyPrice || 0}
          keyOwnership={keyOwnership}
          isTrader={isOwnProfile}
          requiredKeysToFollow={profile.required_keys_to_follow || 1}
          onBuy={async (quantity: number) => {
            const result = await buyKeys({
              trader_id: profile.id,
              quantity,
            });
            toast.success(`Successfully purchased ${result.quantity} key(s)`);
            await loadKeyInfo();
            // Auto-follow if user just bought their first key
            if (keyOwnership === 0 && result.quantity >= 1 && !isFollowing) {
              try {
                await followUser(profile.id);
                setIsFollowing(true);
                await checkFollowStatus();
              } catch (error) {
                console.error("Auto-follow failed:", error);
              }
            }
          }}
          onSell={async (quantity: number) => {
            const result = await sellKeys({
              trader_id: profile.id,
              quantity,
            });
            toast.success(`Successfully sold ${result.quantity} key(s)`);
            await loadKeyInfo();
          }}
        />
      )}
    </div>
  );
};
