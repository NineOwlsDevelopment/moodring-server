import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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

// Reaction bar for posts
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
    <div className="flex items-center gap-0.5">
      <button
        onClick={onLike}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 min-h-[44px] group ${
          isLiked
            ? "bg-brand-danger/15 text-brand-danger hover:bg-brand-danger/20"
            : "hover:bg-white/5 text-moon-grey hover:text-brand-danger"
        }`}
      >
        <Heart
          className={`w-5 h-5 transition-all duration-300 ${
            isLiked ? "scale-110 fill-current" : "group-hover:scale-110"
          }`}
        />
        <span className="text-sm font-semibold tabular-nums">{likesCount}</span>
      </button>
      <button
        onClick={onComment}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-white/5 text-moon-grey hover:text-neon-iris transition-all min-h-[44px] group"
      >
        <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        <span className="text-sm font-semibold tabular-nums">
          {commentsCount}
        </span>
      </button>
    </div>
    <button
      onClick={onShare}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-white/5 text-moon-grey hover:text-aqua-pulse transition-all min-h-[44px] group"
    >
      <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
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

// Post card for profile (matches feed page design)
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
    <article className="bg-graphite-deep border border-white/5 rounded-lg transition-all duration-200 hover:border-white/10">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <UserAvatar
              name={profile.display_name || profile.username}
              size="md"
              imageUrl={profile.avatar_url || undefined}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-[15px]">
                {profile.display_name || profile.username}
              </span>
              {profile.total_pnl > 10000 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-neon-iris/20 text-neon-iris border border-neon-iris/30 rounded">
                  VIP
                </span>
              )}
              <span className="text-gray-500">·</span>
              <span className="text-xs text-gray-500">
                {post.created_at
                  ? formatDistanceToNow(Number(post.created_at))
                  : "now"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">@{profile.username}</p>
          </div>
          <button className="p-2 rounded-xl hover:bg-white/5 text-moon-grey-dark hover:text-white transition-all min-w-[40px] min-h-[40px] flex items-center justify-center">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Market Link */}
      {post.market_question && (
        <Link
          to={`/market/${post.market_id}`}
          className="mx-5 mb-4 flex items-center gap-2.5 px-3 py-2 bg-graphite-light border border-white/10 rounded-lg transition-all group hover:border-neon-iris/30"
        >
          <BarChart3 className="w-4 h-4 text-neon-iris flex-shrink-0" />
          <span className="text-sm text-moon-grey-light group-hover:text-white line-clamp-1 font-medium flex-1">
            {post.market_question}
          </span>
          <svg
            className="w-4 h-4 text-moon-grey ml-auto flex-shrink-0 group-hover:text-neon-iris group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      )}

      {/* Content */}
      <div className="px-5 pb-4 relative">
        <p className="text-white leading-relaxed whitespace-pre-wrap text-sm">
          {post.content}
        </p>
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="relative mx-5 mb-4 rounded-lg overflow-hidden border border-white/10">
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
          className="relative mx-5 mb-4 rounded-lg overflow-hidden border border-white/10 bg-graphite-light"
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
      <div className="px-5 pb-4">
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
        className="w-full px-5 py-3 bg-graphite-light border-t border-white/5 text-sm text-moon-grey hover:text-white hover:bg-graphite-hover transition-all flex items-center gap-2 font-medium"
      >
        <MessageCircle className="w-4 h-4 text-neon-iris" />
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

// Profile tabs
const ProfileTabs = ({
  activeTab,
  onTabChange,
  postsCount,
  showTradesTab,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  postsCount: number;
  showTradesTab: boolean;
}) => {
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: postsCount },
    { id: "markets", label: "Markets" },
    ...(showTradesTab ? [{ id: "trades" as ProfileTab, label: "Trades" }] : []),
  ];

  return (
    <div className="flex border-b border-white/10 gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-all relative ${
            activeTab === tab.id
              ? "text-white"
              : "text-moon-grey hover:text-white"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-moon-grey-dark">
              ({tab.count})
            </span>
          )}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-iris" />
          )}
        </button>
      ))}
    </div>
  );
};

// Empty state for profile sections
const EmptySection = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-16 h-16 rounded-full bg-graphite-deep border border-white/10 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-moon-grey" />
    </div>
    <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
    <p className="text-moon-grey-dark text-sm text-center">{subtitle}</p>
  </div>
);

// Loading skeleton
const ProfileSkeleton = () => (
  <div className="animate-pulse">
    {/* Cover */}
    <div className="h-32 bg-graphite-deep border-b border-white/5" />

    {/* Profile info */}
    <div className="px-4 -mt-12">
      <div className="w-24 h-24 rounded-full bg-graphite-light mb-4" />
      <div className="space-y-3">
        <div className="h-6 w-40 bg-graphite-light rounded" />
        <div className="h-4 w-24 bg-graphite-light rounded" />
        <div className="h-4 w-full bg-graphite-light rounded" />
      </div>
    </div>
  </div>
);

// Post loading skeleton
const PostSkeleton = () => (
  <div className="bg-graphite-deep border border-white/5 rounded-lg animate-pulse">
    <div className="p-4 space-y-3">
      <div className="h-3 w-32 bg-graphite-light rounded" />
      <div className="h-4 w-full bg-graphite-light rounded" />
      <div className="h-4 w-3/4 bg-graphite-light rounded" />
    </div>
    <div className="h-48 bg-graphite-light" />
  </div>
);

// Market card component - Twitter-style feed item (World-class UI/UX)
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
    // Binary markets have one option with both yes_price and no_price
    const option = market.options[0];
    const yesPrice = option.yes_price ?? 0.5;
    const noPrice = option.no_price ?? 1 - yesPrice;

    // Create Yes and No display items
    displayItems = [
      { option, side: "yes", price: yesPrice },
      { option, side: "no", price: noPrice },
    ];
  } else if (market.options && market.options.length > 0) {
    // Non-binary markets: show first 2 options
    displayItems = market.options.slice(0, 2).map((option) => ({
      option,
      side: "other" as const,
      price: option.yes_price ?? 0.5,
    }));
  }

  return (
    <article
      className="px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/5"
      onClick={() => navigate(`/market/${market.id}`)}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-graphite-light border border-white/10 flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-neon-iris" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[15px] font-semibold text-white">
              Created market
            </span>
            <span className="text-gray-500">·</span>
            <span className="text-[15px] text-gray-500">
              {market.created_at
                ? formatDistanceToNow(Number(market.created_at))
                : "now"}
            </span>
          </div>

          {/* Question */}
          <p className="text-[15px] text-white leading-5 mb-3">
            {market.question}
          </p>

          {/* Media: Image + Options */}
          <div className="flex gap-3 mb-2">
            {/* Image - Square, compact */}
            {market.image_url && (
              <div
                className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
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

            {/* Options - Vertical stack */}
            {displayItems.length > 0 && (
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                {displayItems.map((item, idx) => {
                  const { option, side, price } = item;
                  const isYes = side === "yes";
                  const isNo = side === "no";
                  const label = isYes
                    ? "Yes"
                    : isNo
                    ? "No"
                    : option.option_label;

                  return (
                    <div
                      key={`${option.id}-${side}-${idx}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-graphite-light transition-colors border ${
                        isYes
                          ? "bg-aqua-pulse/10 border-aqua-pulse/20"
                          : isNo
                          ? "bg-brand-danger/10 border-brand-danger/20"
                          : "bg-graphite-light border-white/10"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/market/${market.id}`);
                      }}
                    >
                      {option.option_image_url ? (
                        <img
                          src={option.option_image_url}
                          alt=""
                          className="w-4 h-4 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-4 h-4 rounded flex-shrink-0 ${
                            isYes
                              ? "bg-emerald-500/20"
                              : isNo
                              ? "bg-rose-500/20"
                              : "bg-white/10"
                          }`}
                        />
                      )}
                      <span
                        className={`text-[13px] flex-1 truncate font-medium ${
                          isYes
                            ? "text-aqua-pulse"
                            : isNo
                            ? "text-brand-danger"
                            : "text-white"
                        }`}
                      >
                        {label}
                      </span>
                      <span className="text-[13px] text-moon-grey-dark flex-shrink-0">
                        {(price * 100).toFixed(0)}¢
                      </span>
                    </div>
                  );
                })}
                {!market.is_binary &&
                  market.options &&
                  market.options.length > 2 && (
                    <div className="px-2 py-1">
                      <span className="text-[13px] text-gray-500">
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

// Trade card component - Twitter-style feed item
const TradeCard = ({ trade }: { trade: Trade }) => {
  const navigate = useNavigate();
  const isBuy = trade.action === "buy";
  const isYes = trade.side === "yes";

  return (
    <article
      className="relative px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/5"
      onClick={() => trade.market_id && navigate(`/market/${trade.market_id}`)}
    >
      <div className="flex gap-3">
        {/* Action Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isBuy
                ? "bg-aqua-pulse/20 text-aqua-pulse"
                : "bg-brand-danger/20 text-brand-danger"
            }`}
          >
            {isBuy ? (
              <ArrowUpRight className="w-5 h-5" />
            ) : (
              <ArrowDownRight className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Action + Time */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-sm font-semibold ${
                isBuy ? "text-aqua-pulse" : "text-brand-danger"
              }`}
            >
              {isBuy ? "Bought" : "Sold"}
            </span>
            <span className="text-gray-500">·</span>
            <span className="text-xs text-gray-500">
              {trade.created_at
                ? formatDistanceToNow(Number(trade.created_at))
                : "now"}
            </span>
          </div>

          {/* Market Question */}
          {trade.market_question && (
            <p className="text-white text-sm mb-2 line-clamp-2 leading-relaxed">
              {trade.market_question}
            </p>
          )}

          {/* Trade Details */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Option Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isYes
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {trade.option_label || (isYes ? "Yes" : "No")}
            </span>

            {/* Shares */}
            <span className="text-sm text-gray-400">
              {(trade.shares / 1_000_000).toFixed(2)} shares
            </span>

            {/* Price */}
            {trade.pricePerShare !== undefined && (
              <span className="text-sm text-gray-400">
                @ ${(trade.pricePerShare * 100).toFixed(2)}
              </span>
            )}

            {/* Amount */}
            {trade.amount && (
              <span
                className={`text-sm font-semibold ml-auto ${
                  isBuy ? "text-aqua-pulse" : "text-brand-danger"
                }`}
              >
                {isBuy ? "+" : "-"}$
                {(Math.abs(trade.amount) / 1_000_000).toFixed(2)}
              </span>
            )}
          </div>

          {/* Market Link */}
          {trade.market_id && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-neon-iris transition-colors">
              <span>View market</span>
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
  }, [profile?.id]);

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
          ? Promise.resolve({ quantity: 0 })
          : getKeyOwnership(profile.id),
      ]);
      setKeyPrice(priceData.price_in_usdc);
      setKeyOwnership(ownershipData.quantity);
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
      <div className="min-h-screen pb-20">
        <ProfileSkeleton />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <span className="text-6xl mb-4">👻</span>
        <h1 className="text-2xl font-bold text-white mb-2">User not found</h1>
        <p className="text-gray-400 mb-6">
          This profile doesn't exist or has been removed
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-8 bg-ink-black">
      {/* Cover area - minimal and professional */}
      <div className="h-32 md:h-40 bg-graphite-deep border-b border-white/5 relative">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-lg bg-graphite-deep/80 backdrop-blur-sm text-moon-grey hover:text-white hover:bg-graphite-light border border-white/10 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Settings button (own profile) */}
        {isOwnProfile && (
          <Link
            to="/settings"
            className="absolute top-4 right-4 p-2 rounded-lg bg-graphite-deep/80 backdrop-blur-sm text-moon-grey hover:text-white hover:bg-graphite-light border border-white/10 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </Link>
        )}
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row gap-6 -mt-12 mb-8">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <ProfileAvatar
              name={profile.display_name || profile.username}
              imageUrl={profile.avatar_url}
              size="xl"
            />
          </div>

          {/* Profile info */}
          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">
                  {profile.display_name || profile.username}
                </h1>
                {/* Verification badge */}
                {profile.total_trades > 100 && (
                  <span title="Verified trader" className="flex-shrink-0">
                    <Award className="w-5 h-5 text-neon-iris" />
                  </span>
                )}
              </div>
              <p className="text-moon-grey text-sm mb-1">@{profile.username}</p>
              {profile.created_at && (
                <p className="text-moon-grey text-sm mb-3">
                  Joined{" "}
                  {(() => {
                    const timestamp = Number(profile.created_at);
                    const date = new Date(
                      timestamp > 100000000000 ? timestamp : timestamp * 1000
                    );
                    if (isNaN(date.getTime())) return "recently";
                    return date.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });
                  })()}
                </p>
              )}
              {profile.bio && (
                <p className="text-moon-grey-light text-sm leading-relaxed mb-4 break-words">
                  {profile.bio}
                </p>
              )}
              {/* Stats */}
              <div className="flex items-center gap-6 text-sm mb-3">
                <button className="hover:text-white transition-colors">
                  <span className="font-semibold text-white tabular-nums">
                    {profile.following_count}
                  </span>
                  <span className="text-moon-grey ml-1.5">Following</span>
                </button>
                <button className="hover:text-white transition-colors">
                  <span className="font-semibold text-white tabular-nums">
                    {profile.followers_count}
                  </span>
                  <span className="text-moon-grey ml-1.5">Followers</span>
                </button>
              </div>
              {/* Action buttons */}
              <div className="flex gap-2 flex-col sm:flex-row">
                {!isOwnProfile && currentUser && (
                  <>
                    <button
                      onClick={() => setShowKeyModal(true)}
                      className="px-4 py-2 rounded-lg font-medium text-sm transition-all border bg-neon-iris text-white border-neon-iris hover:bg-neon-iris-light flex items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      {keyPrice !== null
                        ? `$${keyPrice.toFixed(4)}`
                        : "View Keys"}
                    </button>
                    <button
                      onClick={handleFollow}
                      disabled={
                        isFollowLoading ||
                        (keyOwnership <
                          (profile?.required_keys_to_follow || 1) &&
                          !isFollowing)
                      }
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${
                        isFollowing
                          ? "bg-graphite-deep text-white border-white/10 hover:bg-graphite-light"
                          : keyOwnership <
                            (profile?.required_keys_to_follow || 1)
                          ? "bg-white/10 text-gray-400 border-white/5 cursor-not-allowed"
                          : "bg-aqua-pulse text-white border-aqua-pulse hover:bg-aqua-pulse/90"
                      }`}
                      title={
                        keyOwnership <
                          (profile?.required_keys_to_follow || 1) &&
                        !isFollowing
                          ? `Purchase at least ${
                              profile?.required_keys_to_follow || 1
                            } key(s) to follow`
                          : ""
                      }
                    >
                      {isFollowLoading
                        ? "..."
                        : isFollowing
                        ? "Following"
                        : keyOwnership < (profile?.required_keys_to_follow || 1)
                        ? `Buy ${profile?.required_keys_to_follow || 1} Key${
                            (profile?.required_keys_to_follow || 1) > 1
                              ? "s"
                              : ""
                          } to Follow`
                        : "Follow"}
                    </button>
                    {!isFollowing &&
                      keyOwnership <
                        (profile?.required_keys_to_follow || 1) && (
                        <div className="text-xs text-gray-400 mt-1 sm:mt-0 sm:ml-2 flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          <span>
                            {keyOwnership} /{" "}
                            {profile?.required_keys_to_follow || 1} keys
                            required
                          </span>
                        </div>
                      )}
                  </>
                )}

                {isOwnProfile && (
                  <Link
                    to="/settings"
                    className="px-4 py-2 rounded-lg bg-graphite-deep text-white font-medium text-sm hover:bg-graphite-light border border-white/10 transition-all"
                  >
                    Edit Profile
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trading stats - Professional data display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-graphite-deep border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-neon-iris/10">
                <BarChart3 className="w-4 h-4 text-neon-iris" />
              </div>
              <div>
                <div className="text-xs text-moon-grey-dark uppercase tracking-wider">
                  Total Trades
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {profile.total_trades}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-graphite-deep border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-aqua-pulse/10">
                <BarChart3 className="w-4 h-4 text-aqua-pulse" />
              </div>
              <div>
                <div className="text-xs text-moon-grey-dark uppercase tracking-wider">
                  Total Volume
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  ${(profile.total_trades * 100).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-graphite-deep border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`p-2 rounded-lg ${
                  profile.total_pnl >= 0
                    ? "bg-aqua-pulse/10"
                    : "bg-brand-danger/10"
                }`}
              >
                {profile.total_pnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-aqua-pulse" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-brand-danger" />
                )}
              </div>
              <div>
                <div className="text-xs text-moon-grey-dark uppercase tracking-wider">
                  Total P&L
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    profile.total_pnl >= 0
                      ? "text-aqua-pulse"
                      : "text-brand-danger"
                  }`}
                >
                  {profile.total_pnl >= 0 ? "+" : ""}$
                  {Math.abs(profile.total_pnl).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <ProfileTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          postsCount={profile.posts_count}
          showTradesTab={isFollowing || isOwnProfile}
        />

        {/* Tab content */}
        <div className="py-4">
          {activeTab === "posts" && (
            <>
              {/* Create Post Form (only for own profile) */}
              {isOwnProfile && (
                <div className="mb-6 bg-graphite-deep border border-white/5 rounded-lg p-5">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share your trading insights..."
                    className="w-full bg-graphite-light border border-white/10 rounded-lg px-4 py-3 text-white placeholder-moon-grey-dark focus:outline-none focus:ring-2 focus:ring-neon-iris/30 focus:border-neon-iris/50 focus:bg-graphite-hover resize-none transition-all text-sm leading-relaxed min-h-[100px]"
                    rows={4}
                    maxLength={5000}
                  />

                  {/* Character count */}
                  {newPostContent.length > 0 && (
                    <div className="mt-2 text-xs text-moon-grey-dark text-right">
                      {newPostContent.length}/5000
                    </div>
                  )}

                  {/* Media Preview */}
                  {newPostMediaPreview && (
                    <div className="relative mt-4 rounded-lg overflow-hidden border border-white/10 bg-graphite-light">
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
                          className="w-full max-h-80 object-contain bg-graphite-light"
                        />
                      )}
                      <button
                        onClick={handleRemoveMedia}
                        className="absolute top-3 right-3 p-2 bg-graphite-deep/90 backdrop-blur-sm rounded-lg hover:bg-graphite-deep border border-white/10 transition-all"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer group relative">
                        <div className="p-2 rounded-lg hover:bg-graphite-light transition-all">
                          <ImageIcon className="w-4 h-4 text-moon-grey group-hover:text-neon-iris transition-colors" />
                        </div>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleMediaChange}
                          className="hidden"
                        />
                      </label>
                      <label className="cursor-pointer group relative">
                        <div className="p-2 rounded-lg hover:bg-graphite-light transition-all">
                          <Video className="w-4 h-4 text-moon-grey group-hover:text-aqua-pulse transition-colors" />
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
                      className="px-5 py-2 bg-neon-iris text-white rounded-lg font-medium text-sm min-w-[100px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-iris-light transition-all"
                    >
                      {isCreatingPost ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Posting...
                        </span>
                      ) : (
                        "Post"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {isLoadingPosts ? (
                <div className="space-y-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <PostSkeleton key={i} />
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
                <div className="space-y-5">
                  {posts.map((post, index) => (
                    <div
                      key={post.id}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      className="animate-fade-in-up"
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
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "markets" && (
            <>
              {isLoadingMarkets ? (
                <div className="border-t border-white/10">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 border-b border-white/5 animate-pulse"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-24 bg-white/10 rounded" />
                          <div className="h-4 w-full bg-white/10 rounded" />
                          <div className="h-3 w-32 bg-white/10 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : markets.length === 0 ? (
                <div className="border-t border-white/10 py-16">
                  <EmptySection
                    icon={BarChart3}
                    title="No markets"
                    subtitle={
                      isOwnProfile
                        ? "Create your first prediction market"
                        : "This user hasn't created any markets"
                    }
                  />
                </div>
              ) : (
                <div className="border-t border-white/10">
                  {markets.map((market, index) => (
                    <div
                      key={market.id}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      className="animate-fade-in-up"
                    >
                      <MarketFeedCard
                        market={market}
                        onImageClick={(imageUrl) => setSelectedImage(imageUrl)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "trades" && (
            <>
              {!isOwnProfile &&
              (profile?.required_keys_to_follow || 1) > 0 &&
              keyOwnership < (profile?.required_keys_to_follow || 1) ? (
                <div className="border-t border-white/10 py-16">
                  <div className="flex flex-col items-center justify-center text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-neon-iris/20 flex items-center justify-center mb-4">
                      <Lock className="w-8 h-8 text-neon-iris" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Keys Required
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-md">
                      You need at least {profile?.required_keys_to_follow || 1}{" "}
                      key(s) to view this trader's trades. You currently have{" "}
                      {keyOwnership} key(s).
                    </p>
                    {keyPrice !== null && (
                      <div className="bg-white/5 rounded-lg p-6 w-full max-w-md border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm text-gray-400">
                              Current Price
                            </p>
                            <p className="text-2xl font-bold text-white">
                              ${keyPrice.toFixed(4)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Supply</p>
                            <p className="text-lg font-semibold text-white">
                              {profile.keys_supply || 0}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() =>
                              setKeyPurchaseQuantity(
                                Math.max(1, keyPurchaseQuantity - 1)
                              )
                            }
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                          >
                            -
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
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-neon-iris"
                          />
                          <button
                            onClick={() =>
                              setKeyPurchaseQuantity(keyPurchaseQuantity + 1)
                            }
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={handleBuyKeys}
                          disabled={isBuyingKeys || isLoadingKeys}
                          className="w-full py-3 bg-neon-iris hover:bg-neon-iris/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isBuyingKeys ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                        <div className="mt-4 text-center space-y-1">
                          {keyOwnership > 0 && (
                            <p className="text-sm text-gray-400">
                              You own {keyOwnership} key
                              {keyOwnership !== 1 ? "s" : ""}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {profile?.required_keys_to_follow || 1} key
                            {(profile?.required_keys_to_follow || 1) > 1
                              ? "s"
                              : ""}{" "}
                            required to follow
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : isLoadingTrades ? (
                <div className="border-t border-white/10">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 border-b border-white/5 animate-pulse"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-24 bg-white/10 rounded" />
                          <div className="h-4 w-full bg-white/10 rounded" />
                          <div className="h-3 w-32 bg-white/10 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : trades.length === 0 ? (
                <div className="border-t border-white/10 py-16">
                  <EmptySection
                    icon={TrendingUp}
                    title="No trades yet"
                    subtitle={
                      isOwnProfile
                        ? "Start trading to see your activity here"
                        : "This user hasn't made any trades yet"
                    }
                  />
                </div>
              ) : (
                <div className="border-t border-white/10">
                  {trades.map((trade, index) => (
                    <div
                      key={trade.id}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      className="animate-fade-in-up"
                    >
                      <TradeCard trade={trade} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
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
