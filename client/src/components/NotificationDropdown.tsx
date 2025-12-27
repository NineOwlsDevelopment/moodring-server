import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  Notification,
} from "@/api/api";
import { formatDistanceToNow } from "@/utils/format";
import { useNotificationSocket } from "@/hooks/useSocket";
import { useUserStore } from "@/stores/userStore";
import {
  Bell,
  BarChart2,
  TrendingUp,
  CheckCircle,
  Gift,
  BellRing,
  X,
} from "lucide-react";

const notificationIcons: Record<string, React.ReactNode> = {
  trade: <BarChart2 className="w-5 h-5 text-neon-iris" />,
  market: <TrendingUp className="w-5 h-5 text-aqua-pulse" />,
  resolution: <CheckCircle className="w-5 h-5 text-brand-success" />,
  referral: <Gift className="w-5 h-5 text-brand-warning" />,
  system: <BellRing className="w-5 h-5 text-moon-grey" />,
};

export const NotificationDropdown = () => {
  const { user } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load unread count on mount
  useEffect(() => {
    if (user) {
      loadUnreadCount();
    }
  }, [user]);

  // Handle real-time notification updates
  const handleNotification = useCallback((notification: Notification) => {
    // Add new notification to the list
    setNotifications((prev) => [notification, ...prev].slice(0, 10));
    // Increment unread count
    setUnreadCount((prev) => prev + 1);
  }, []);

  // Subscribe to real-time notification updates via WebSocket
  useNotificationSocket(user?.id, handleNotification);

  // Handle click/touch outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    // Use capture phase to catch events earlier
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    // Prevent body scroll on mobile when dropdown is open
    if (window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const loadUnreadCount = async () => {
    try {
      const { count } = await fetchUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      // Silently fail for polling
    }
  };

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const { notifications: data } = await fetchNotifications({ limit: 10 });
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      loadNotifications();
    }
  };

  // Handler to close dropdown immediately
  const closeDropdown = useCallback(() => {
    flushSync(() => {
      setIsOpen(false);
    });
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getNotificationLink = (notification: Notification): string => {
    if (notification.data?.market_id) {
      return `/market/${notification.data.market_id}`;
    }
    return "#";
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          className="relative p-2 text-moon-grey hover:text-white transition-colors rounded-xl hover:bg-white/5"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-bold text-white bg-neon-iris rounded-full animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Desktop dropdown - positioned relative to button */}
        {isOpen && (
          <div className="hidden md:block absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] max-h-[480px] bg-graphite-deep rounded-2xl shadow-2xl z-50 animate-fade-in overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-graphite-light/50">
              <h3 className="font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-neon-iris hover:text-neon-iris-light font-medium transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[380px] overflow-y-auto overscroll-contain">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-neon-iris border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-graphite-light flex items-center justify-center">
                    <Bell className="w-8 h-8 text-moon-grey-dark" />
                  </div>
                  <p className="text-moon-grey font-medium">
                    No notifications yet
                  </p>
                  <p className="text-moon-grey-dark text-sm mt-1">
                    We'll let you know when something happens
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      to={getNotificationLink(notification)}
                      onClick={() => {
                        // Close dropdown immediately, before navigation
                        closeDropdown();
                        if (!notification.is_read) {
                          handleMarkAsRead(notification.id);
                        }
                      }}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${
                        !notification.is_read ? "bg-neon-iris/5" : ""
                      }`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-graphite-light flex items-center justify-center">
                        {notificationIcons[notification.type] || (
                          <BellRing className="w-5 h-5 text-moon-grey" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium line-clamp-1 ${
                              notification.is_read
                                ? "text-moon-grey"
                                : "text-white"
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-neon-iris rounded-full" />
                          )}
                        </div>
                        <p className="text-xs text-moon-grey-dark line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-moon-grey-dark mt-1">
                          {formatDistanceToNow(
                            new Date(notification.created_at).getTime() / 1000
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 px-4 py-3 bg-graphite-light/50">
              <Link
                to="/settings"
                onClick={closeDropdown}
                className="text-sm text-moon-grey hover:text-neon-iris transition-colors flex items-center gap-1"
              >
                Notification settings
                <span className="text-moon-grey-dark">→</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Mobile dropdown - rendered in portal to escape positioning contexts */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Mobile backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-[55] md:hidden touch-none"
              onClick={() => setIsOpen(false)}
            />

            <div className="fixed inset-x-0 bottom-0 md:hidden w-full max-h-[85vh] bg-graphite-deep rounded-t-2xl shadow-2xl z-[60] animate-slide-up overflow-hidden notification-dropdown-mobile">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-graphite-light/50">
                {/* Mobile handle */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20 md:hidden" />

                <h3 className="font-semibold text-white pt-2 md:pt-0">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-neon-iris hover:text-neon-iris-light font-medium transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-moon-grey hover:text-white rounded-lg hover:bg-white/5 md:hidden"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-[calc(85vh-140px)] md:max-h-[380px] overflow-y-auto overscroll-contain">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-neon-iris border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-graphite-light flex items-center justify-center">
                      <Bell className="w-8 h-8 text-moon-grey-dark" />
                    </div>
                    <p className="text-moon-grey font-medium">
                      No notifications yet
                    </p>
                    <p className="text-moon-grey-dark text-sm mt-1">
                      We'll let you know when something happens
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => (
                      <Link
                        key={notification.id}
                        to={getNotificationLink(notification)}
                        onClick={() => {
                          // Close dropdown immediately, before navigation
                          closeDropdown();
                          if (!notification.is_read) {
                            handleMarkAsRead(notification.id);
                          }
                        }}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${
                          !notification.is_read ? "bg-neon-iris/5" : ""
                        }`}
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-graphite-light flex items-center justify-center">
                          {notificationIcons[notification.type] || (
                            <BellRing className="w-5 h-5 text-moon-grey" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm font-medium line-clamp-1 ${
                                notification.is_read
                                  ? "text-moon-grey"
                                  : "text-white"
                              }`}
                            >
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-neon-iris rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-moon-grey-dark line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-moon-grey-dark mt-1">
                            {formatDistanceToNow(
                              new Date(notification.created_at).getTime() / 1000
                            )}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-white/5 px-4 py-3 bg-graphite-light/50">
                <Link
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className="text-sm text-moon-grey hover:text-neon-iris transition-colors flex items-center gap-1"
                >
                  Notification settings
                  <span className="text-moon-grey-dark">→</span>
                </Link>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};
