import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getUserPosts,
  Post,
  PostComment,
  togglePostLike,
  followUser,
  unfollowUser,
  getFollowStatus,
  getComments,
  createPostComment,
} from "@/api/api";
import { formatDistanceToNow } from "@/utils/format";
import { toast } from "sonner";
import { useUserStore } from "@/stores/userStore";
import api from "@/config/axios";
import {
  ArrowLeft,
  Settings,
  Calendar,
  TrendingUp,
  Trophy,
  Award,
  BarChart3,
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
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
}

type ProfileTab = "posts" | "markets" | "about";

// User avatar with gradient background
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

  const gradients = [
    "from-rose-400 via-pink-500 to-fuchsia-500",
    "from-violet-400 via-purple-500 to-indigo-500",
    "from-sky-400 via-cyan-500 to-teal-500",
    "from-emerald-400 via-green-500 to-lime-500",
    "from-amber-400 via-orange-500 to-red-500",
  ];

  const gradientIndex = name.charCodeAt(0) % gradients.length;

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      className={`${sizes[size]} rounded-full object-cover ring-4 ring-white/10`}
    />
  ) : (
    <div
      className={`${sizes[size]} rounded-full bg-gradient-to-br ${gradients[gradientIndex]} flex items-center justify-center font-bold text-white ring-4 ring-white/10 shadow-2xl`}
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

  const gradients = [
    "from-rose-400 to-pink-500",
    "from-violet-400 to-purple-500",
    "from-sky-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-fuchsia-400 to-pink-500",
  ];

  const gradientIndex = name.charCodeAt(0) % gradients.length;

  return (
    <div className="relative flex-shrink-0">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/10`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-gradient-to-br ${gradients[gradientIndex]} flex items-center justify-center font-bold text-white ring-2 ring-white/10`}
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
  <div className="flex items-center justify-between pt-3 border-t border-white/5">
    <div className="flex items-center gap-1">
      <button
        onClick={onLike}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 min-h-[40px] ${
          isLiked
            ? "bg-brand-danger/15 text-brand-danger"
            : "hover:bg-white/5 text-moon-grey hover:text-brand-danger"
        }`}
      >
        <Heart
          className={`w-5 h-5 transition-transform duration-300 ${
            isLiked ? "scale-110 fill-current" : ""
          }`}
        />
        <span className="text-sm font-medium tabular-nums">{likesCount}</span>
      </button>
      <button
        onClick={onComment}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 text-moon-grey hover:text-neon-iris transition-all min-h-[40px]"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium tabular-nums">
          {commentsCount}
        </span>
      </button>
    </div>
    <button
      onClick={onShare}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 text-moon-grey hover:text-aqua-pulse transition-all min-h-[40px]"
    >
      <Share2 className="w-5 h-5" />
    </button>
  </div>
);

// Reply Section Component
const ReplySection = ({
  postId,
  isOpen,
  onReplyCreated,
  user,
}: {
  postId: string;
  isOpen: boolean;
  onReplyCreated: () => void;
  user: any;
}) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createPostComment({
        post_id: postId,
        content: replyContent.trim(),
        parent_comment_id: replyingTo || undefined,
      });
      setReplyContent("");
      setReplyingTo(null);
      loadComments();
      onReplyCreated();
      toast.success("Reply posted!");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyToComment = (commentId: string, username: string) => {
    setReplyingTo(commentId);
    setReplyContent(`@${username} `);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="border-t border-white/5 bg-white/[0.02]">
      {/* Reply input */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={user?.display_name || user?.username || "U"}
            size="sm"
          />
          <div className="flex-1 relative">
            {replyingTo && (
              <div className="absolute -top-6 left-0 text-xs text-gray-500 flex items-center gap-1">
                <span>Replying to a comment</span>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent("");
                  }}
                  className="text-rose-400 hover:text-rose-300"
                >
                  ✕
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitReply()}
              placeholder="Write a reply..."
              className="w-full bg-white/5 rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
          </div>
          <button
            onClick={handleSubmitReply}
            disabled={!replyContent.trim() || isSubmitting}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-pink-500/20 transition-all"
          >
            {isSubmitting ? "..." : "Reply"}
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No replies yet. Be the first!
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex gap-2">
                  <div className="flex-shrink-0">
                    <UserAvatar
                      name={comment.display_name || comment.username}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white">
                        {comment.display_name || comment.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {comment.created_at
                          ? formatDistanceToNow(comment.created_at)
                          : "now"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                    <button
                      onClick={() =>
                        handleReplyToComment(comment.id, comment.username)
                      }
                      className="text-xs text-gray-500 hover:text-pink-400 mt-1 transition-colors"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
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
  user,
  profile,
}: {
  post: Post;
  onLike: () => void;
  onToggleReplies: () => void;
  showReplies: boolean;
  onReplyCreated: () => void;
  user: any;
  profile: UserProfileData;
}) => {
  const [isDoubleTapLiked, setIsDoubleTapLiked] = useState(false);
  const lastTapRef = useRef(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.is_liked) {
        onLike();
      }
      setIsDoubleTapLiked(true);
      setTimeout(() => setIsDoubleTapLiked(false), 800);
    }
    lastTapRef.current = now;
  };

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
    <article className="relative overflow-hidden bg-gradient-to-b from-[#161620] to-[#12121a] rounded-2xl transition-all duration-300 animate-fade-in-up">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
      {/* Header */}
      <div className="p-4 pb-3">
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
              <span className="font-semibold text-white">
                {profile.display_name || profile.username}
              </span>
              {profile.total_pnl > 10000 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                  VIP
                </span>
              )}
              <span className="text-gray-500">·</span>
              <span className="text-xs text-gray-500">
                {post.created_at ? formatDistanceToNow(post.created_at) : "now"}
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
          className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-xl transition-all group"
        >
          <span className="text-lg">📊</span>
          <span className="text-sm text-violet-300 group-hover:text-violet-200 line-clamp-1">
            {post.market_question}
          </span>
          <svg
            className="w-4 h-4 text-violet-400 ml-auto flex-shrink-0"
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
      <div
        className="px-4 pb-3 relative cursor-pointer"
        onClick={handleDoubleTap}
      >
        <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Double tap heart animation */}
        {isDoubleTapLiked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-6xl animate-ping-once">❤️</span>
          </div>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="relative" onClick={handleDoubleTap}>
          <img
            src={post.image_url}
            alt="Post attachment"
            loading="lazy"
            className="w-full max-h-96 object-cover max-w-full"
          />
          {isDoubleTapLiked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
              <span className="text-8xl animate-ping-once">❤️</span>
            </div>
          )}
        </div>
      )}

      {/* Reactions */}
      <div className="px-4 pb-4">
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
        className="w-full px-4 py-3 bg-white/[0.02] border-t border-white/5 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-2"
      >
        <span className="text-pink-400">{showReplies ? "▼" : "▶"}</span>
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
        user={user}
      />
    </article>
  );
};

// Profile tabs
const ProfileTabs = ({
  activeTab,
  onTabChange,
  postsCount,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  postsCount: number;
}) => {
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: postsCount },
    { id: "markets", label: "Markets" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="flex border-b border-white/10">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-4 text-sm font-medium transition-all relative ${
            activeTab === tab.id
              ? "text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-gray-500">({tab.count})</span>
          )}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

// Empty state for profile sections
const EmptySection = ({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500/20 to-violet-500/20 flex items-center justify-center mb-4">
      <span className="text-3xl">{icon}</span>
    </div>
    <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
    <p className="text-gray-500 text-sm text-center">{subtitle}</p>
  </div>
);

// Loading skeleton
const ProfileSkeleton = () => (
  <div className="animate-pulse">
    {/* Cover */}
    <div className="h-40 bg-gradient-to-br from-pink-500/10 to-violet-500/10" />

    {/* Profile info */}
    <div className="px-4 -mt-16">
      <div className="w-24 h-24 rounded-full bg-white/10 mb-4" />
      <div className="space-y-3">
        <div className="h-6 w-40 bg-white/10 rounded" />
        <div className="h-4 w-24 bg-white/5 rounded" />
        <div className="h-4 w-full bg-white/5 rounded" />
      </div>
    </div>
  </div>
);

// Post loading skeleton
const PostSkeleton = () => (
  <div className="relative overflow-hidden bg-gradient-to-b from-[#161620] to-[#12121a] rounded-2xl animate-pulse">
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
    <div className="p-4 space-y-3">
      <div className="h-3 w-32 bg-white/10 rounded" />
      <div className="h-4 w-full bg-white/10 rounded" />
      <div className="h-4 w-3/4 bg-white/10 rounded" />
    </div>
    <div className="h-48 bg-white/5" />
  </div>
);

// Main component
export const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      loadPosts();
      checkFollowStatus();
    }
  }, [userId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/user/${userId}/profile`);
      setProfile(response.data.user);
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPosts = async () => {
    if (!userId) return;
    setIsLoadingPosts(true);
    try {
      const { posts: data } = await getUserPosts(userId);
      setPosts(data);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!userId || !currentUser || isOwnProfile) return;
    try {
      const { is_following } = await getFollowStatus(userId);
      setIsFollowing(is_following);
    } catch (error) {
      console.error("Failed to check follow status:", error);
    }
  };

  const handleFollow = async () => {
    if (!userId || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
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
      toast.error(error.response?.data?.error || "Action failed");
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
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-rose-500/5 via-transparent to-violet-500/5 pointer-events-none" />

      {/* Cover image */}
      <div className="h-40 md:h-52 bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-violet-500/20 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2.5 rounded-xl bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Settings button (own profile) */}
        {isOwnProfile && (
          <Link
            to="/settings"
            className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </Link>
        )}
      </div>

      <div className="relative max-w-xl mx-auto px-4">
        {/* Avatar */}
        <div className="-mt-16 mb-4 flex justify-between items-end">
          <ProfileAvatar
            name={profile.display_name || profile.username}
            imageUrl={profile.avatar_url}
            size="xl"
          />

          {/* Action buttons */}
          {!isOwnProfile && currentUser && (
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleFollow}
                disabled={isFollowLoading}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
                  isFollowing
                    ? "bg-white/10 text-white hover:bg-rose-500/20 hover:text-rose-400"
                    : "bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:shadow-lg hover:shadow-pink-500/30"
                }`}
              >
                {isFollowLoading ? "..." : isFollowing ? "Following" : "Follow"}
              </button>
              <button className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </button>
            </div>
          )}

          {isOwnProfile && (
            <Link
              to="/settings"
              className="px-5 py-2 mb-2 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all"
            >
              Edit Profile
            </Link>
          )}
        </div>

        {/* Profile info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white break-words max-w-full">
              {profile.display_name && profile.display_name.length > 20
                ? profile.display_name.slice(0, 20) + "..."
                : profile.display_name || profile.username}
            </h1>
            {/* Verification badge */}
            {profile.total_trades > 100 && (
              <span title="Verified trader">
                <Award className="w-5 h-5 text-neon-iris" />
              </span>
            )}
            {/* VIP badge */}
            {profile.total_pnl > 10000 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-brand text-white rounded flex-shrink-0">
                VIP
              </span>
            )}
          </div>
          <p className="text-moon-grey mb-3 truncate max-w-full">
            @
            {profile.username && profile.username.length > 20
              ? profile.username.slice(0, 20) + "..."
              : profile.username}
          </p>

          {profile.bio && (
            <p className="text-moon-grey-light mb-4 leading-relaxed break-words">
              {profile.bio}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 sm:gap-6 text-sm">
            <button className="hover:text-white transition-colors">
              <span className="font-bold text-white tabular-nums">
                {profile.following_count}
              </span>
              <span className="text-moon-grey ml-1">Following</span>
            </button>
            <button className="hover:text-white transition-colors">
              <span className="font-bold text-white tabular-nums">
                {profile.followers_count}
              </span>
              <span className="text-moon-grey ml-1">Followers</span>
            </button>
          </div>
        </div>

        {/* Trading stats */}
        <div className="relative overflow-hidden grid grid-cols-3 gap-2 mb-6 p-3 sm:p-4 bg-graphite-deep rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
          <div className="flex flex-col items-center p-2 sm:p-3">
            <BarChart3 className="w-5 h-5 text-neon-iris mb-1" />
            <span className="text-lg sm:text-xl font-bold text-white tabular-nums">
              {profile.total_trades}
            </span>
            <span className="text-[10px] sm:text-xs text-moon-grey-dark">
              Trades
            </span>
          </div>
          <div className="flex flex-col items-center p-2 sm:p-3">
            <Trophy className="w-5 h-5 text-brand-warning mb-1" />
            <span
              className={`text-lg sm:text-xl font-bold tabular-nums ${
                profile.win_rate >= 0.5 ? "text-aqua-pulse" : "text-white"
              }`}
            >
              {(profile.win_rate * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] sm:text-xs text-moon-grey-dark">
              Win Rate
            </span>
          </div>
          <div className="flex flex-col items-center p-2 sm:p-3">
            <TrendingUp
              className={`w-5 h-5 mb-1 ${
                profile.total_pnl >= 0 ? "text-aqua-pulse" : "text-brand-danger"
              }`}
            />
            <span
              className={`text-lg sm:text-xl font-bold tabular-nums ${
                profile.total_pnl >= 0 ? "text-aqua-pulse" : "text-brand-danger"
              }`}
            >
              {profile.total_pnl >= 0 ? "+" : ""}$
              {Math.abs(profile.total_pnl).toFixed(0)}
            </span>
            <span className="text-[10px] sm:text-xs text-moon-grey-dark">
              P&L
            </span>
          </div>
        </div>

        {/* Tabs */}
        <ProfileTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          postsCount={profile.posts_count}
        />

        {/* Tab content */}
        <div className="py-4">
          {activeTab === "posts" && (
            <>
              {isLoadingPosts ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <PostSkeleton key={i} />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <EmptySection
                  icon="📝"
                  title="No posts yet"
                  subtitle={
                    isOwnProfile
                      ? "Share your first post!"
                      : "This user hasn't posted yet"
                  }
                />
              ) : (
                <div className="space-y-4">
                  {posts.map((post, index) => (
                    <div
                      key={post.id}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <ProfilePostCard
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onToggleReplies={() => toggleReplies(post.id)}
                        showReplies={expandedReplies.has(post.id)}
                        onReplyCreated={() => handleReplyCreated(post.id)}
                        user={currentUser}
                        profile={profile}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "markets" && (
            <EmptySection
              icon="📊"
              title="No markets"
              subtitle={
                isOwnProfile
                  ? "Create your first prediction market!"
                  : "This user hasn't created any markets"
              }
            />
          )}

          {activeTab === "about" && (
            <div className="space-y-4">
              <div className="relative overflow-hidden p-4 bg-graphite-deep rounded-2xl">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
                <h3 className="text-sm font-semibold text-moon-grey mb-3 uppercase tracking-wider">
                  Info
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-moon-grey-light">
                    <Calendar className="w-5 h-5 text-neon-iris flex-shrink-0" />
                    <span className="text-sm sm:text-base">
                      Joined{" "}
                      {profile.created_at
                        ? new Date(
                            typeof profile.created_at === "string" &&
                            profile.created_at.includes(" ")
                              ? profile.created_at.replace(" ", "T")
                              : profile.created_at
                          ).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })
                        : "recently"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-moon-grey-light">
                    <TrendingUp className="w-5 h-5 text-aqua-pulse flex-shrink-0" />
                    <span className="text-sm sm:text-base">
                      {profile.total_trades} trades completed
                    </span>
                  </div>
                  {profile.win_rate > 0.6 && (
                    <div className="flex items-center gap-3 text-aqua-pulse">
                      <Trophy className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm sm:text-base">Top Trader</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Achievement badges */}
              <div className="relative overflow-hidden p-4 bg-gradient-to-br from-[#161620] to-[#12121a] rounded-2xl">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                  Achievements
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.total_trades >= 1 && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 text-sm">
                      🌱 First Trade
                    </span>
                  )}
                  {profile.total_trades >= 10 && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-400 text-sm">
                      📊 Active Trader
                    </span>
                  )}
                  {profile.total_trades >= 100 && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 text-sm">
                      💎 Diamond Hands
                    </span>
                  )}
                  {profile.win_rate >= 0.6 && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 text-sm">
                      🎯 Sharp Eye
                    </span>
                  )}
                  {profile.followers_count >= 10 && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-rose-400 text-sm">
                      ⭐ Rising Star
                    </span>
                  )}
                  {profile.posts_count >= 5 && (
                    <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-pink-500/20 text-fuchsia-400 text-sm">
                      ✍️ Content Creator
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
