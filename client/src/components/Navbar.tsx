import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/stores/userStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { LoginModal } from "./LoginModal";
import { WalletModal } from "./WalletModal";
import { NotificationDropdown } from "./NotificationDropdown";
import { Tooltip } from "./Tooltip";
import logo from "../../public/icon.png";
import api from "@/config/axios";
import { formatUSDC } from "@/utils/format";
import { socketService } from "@/services/socket";
import {
  ChevronDown,
  BarChart3,
  Wallet,
  Clock,
  Settings,
  LogOut,
  Menu,
  X,
  Copy,
  Bookmark,
} from "lucide-react";

/**
 * Navbar Component
 *
 * Updated with Moodring brand identity:
 * - Glass effect with graphite background
 * - Neon iris accent on active states
 * - Gradient border on hover
 * - Smooth motion transitions
 */
export const Navbar = () => {
  const { user, isAdmin } = useUserStore();
  const { disconnect: disconnectWallet } = useWallet();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close user menu when clicking outside
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    // Use capture phase to catch events earlier
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isUserMenuOpen]);

  // Close mobile menu when clicking outside and prevent body scroll
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    // Prevent body scroll when drawer is open
    document.body.style.overflow = "hidden";

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isClickInMenu = mobileMenuRef.current?.contains(target);
      const isClickInButton = mobileMenuButtonRef.current?.contains(target);

      if (!isClickInMenu && !isClickInButton) {
        setIsMobileMenuOpen(false);
      }
    };
    // Use capture phase to catch events earlier
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Subscribe to balance updates when user is logged in
  useEffect(() => {
    if (!user?.id) return;

    // Ensure socket is connected
    socketService.connect();

    // Subscribe to balance updates
    socketService.subscribeToBalance(user.id);

    // Listen for balance updates
    const unsubscribe = socketService.onBalance((update) => {
      if (update.user_id === user.id) {
        useUserStore.getState().updateBalance(update.balance_usdc);
      }
    });

    return () => {
      socketService.unsubscribeFromBalance(user.id);
      unsubscribe();
    };
  }, [user?.id]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error(error);
    } finally {
      try {
        await disconnectWallet();
      } catch (e) {
        console.error("Error disconnecting wallet:", e);
      }
      useUserStore.getState().logout();
      navigate("/");
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { path: "/markets", label: "Markets" },
    { path: "/leaderboard", label: "Leaderboard" },
    ...(user
      ? [
          { path: "/pools", label: "Pools" },
          { path: "/create", label: "Create" },
        ]
      : []),
    ...(isAdmin ? [{ path: "/admin", label: "Admin" }] : []),
  ];

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const truncateUsername = (name: string, maxLength: number = 16) => {
    if (!name) return "";
    if (name.length <= maxLength) return name;
    return `${name.slice(0, maxLength)}...`;
  };

  // Handlers to close dropdowns immediately
  const closeUserMenu = useCallback(() => {
    flushSync(() => {
      setIsUserMenuOpen(false);
    });
  }, []);

  const closeMobileMenu = useCallback(() => {
    flushSync(() => {
      setIsMobileMenuOpen(false);
    });
  }, []);

  return (
    <nav className="relative bg-graphite-deep/95 backdrop-blur-xl sticky top-0 md:fixed md:top-0 md:left-0 md:right-0 z-50">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
      <div className="section-container">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-2.5 group flex-shrink-0"
          >
            <motion.div
              className="w-9 h-9 flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img src={logo} alt="Moodring" className="w-9 h-9" />
            </motion.div>
            <span className="text-xl font-bold text-white group-hover:text-gradient transition-all hidden sm:block">
              Moodring
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-iris bg-neon-iris/10 border border-neon-iris/30 rounded-md">
              Beta
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => {
                  closeMobileMenu();
                  closeUserMenu();
                }}
                className={`relative px-4 py-2 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive(link.path)
                    ? "text-white"
                    : "text-moon-grey hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
                {isActive(link.path) && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-neon-iris/15 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                {/* Balance */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-graphite-light rounded-xl">
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {formatUSDC(user?.wallet?.balance_usdc) || "0.00"}
                  </span>
                  <span className="text-xs text-moon-grey-dark font-medium">
                    USDC
                  </span>
                </div>

                {/* Wallet Icon */}
                <Tooltip content="Deposit & Withdraw" position="bottom">
                  <button
                    onClick={() => setIsWalletModalOpen(true)}
                    className="p-2 rounded-xl hover:bg-white/5 transition-colors text-moon-grey hover:text-white"
                  >
                    <Wallet className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User Menu Dropdown */}
                <div className="relative hidden md:block" ref={userMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsUserMenuOpen(!isUserMenuOpen);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-button-primary">
                      {user.display_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <motion.div
                      animate={{ rotate: isUserMenuOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-moon-grey" />
                    </motion.div>
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-72 bg-graphite-deep rounded-2xl shadow-card-elevated z-50 overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
                        {/* User Info Header */}
                        <div className="p-4 border-b border-white/[0.04] bg-graphite-light/50">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-lg font-bold shadow-button-primary flex-shrink-0">
                              {user.display_name?.charAt(0).toUpperCase() ||
                                "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white truncate">
                                {truncateUsername(user.display_name || "", 20)}
                              </p>
                              <p className="text-sm text-moon-grey truncate">
                                @{truncateUsername(user.username || "", 18)}
                              </p>
                            </div>
                          </div>
                          {user.wallet?.publicKey && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-graphite-deep rounded-xl">
                              <div className="w-2 h-2 rounded-full bg-aqua-pulse animate-pulse flex-shrink-0" />
                              <span className="text-xs text-moon-grey font-mono truncate">
                                {truncateAddress(
                                  user.wallet.publicKey.toString()
                                )}
                              </span>
                              <Tooltip
                                content="Copy wallet address to clipboard"
                                position="top"
                              >
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      user.wallet?.publicKey?.toString() || ""
                                    );
                                  }}
                                  className="ml-auto text-moon-grey-dark hover:text-white transition-colors flex-shrink-0"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </Tooltip>
                            </div>
                          )}
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          <MenuLink to="/my-markets" onClick={closeUserMenu}>
                            <BarChart3 className="w-5 h-5" /> My Markets
                          </MenuLink>
                          <MenuLink to="/watchlist" onClick={closeUserMenu}>
                            <Bookmark className="w-5 h-5" /> Watchlist
                          </MenuLink>
                          <MenuLink to="/portfolio" onClick={closeUserMenu}>
                            <Wallet className="w-5 h-5" /> Portfolio
                          </MenuLink>
                          <MenuLink to="/activity" onClick={closeUserMenu}>
                            <Clock className="w-5 h-5" /> Activity
                          </MenuLink>
                          <MenuLink to="/settings" onClick={closeUserMenu}>
                            <Settings className="w-5 h-5" /> Settings
                          </MenuLink>
                        </div>

                        {/* Logout */}
                        <div className="border-t border-white/[0.04] py-2">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-moon-grey hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
                          >
                            <LogOut className="w-5 h-5" />
                            <span>Log out</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="btn btn-primary text-sm sm:text-base"
              >
                Login
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              ref={mobileMenuButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="lg:hidden p-2 text-moon-grey hover:text-white transition-colors rounded-xl hover:bg-white/5"
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </motion.div>
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer - Rendered via Portal */}
        {typeof window !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {isMobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={closeMobileMenu}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
                  />

                  {/* Drawer */}
                  <motion.div
                    ref={mobileMenuRef}
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-graphite-deep z-[101] lg:hidden shadow-card-elevated overflow-y-auto"
                    style={{
                      paddingTop: "env(safe-area-inset-top, 0px)",
                      paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    }}
                  >
                    {/* Drawer Header with Close Button */}
                    <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2.5">
                        <img src={logo} alt="Moodring" className="w-8 h-8" />
                        <span className="text-lg font-bold text-white">
                          Moodring
                        </span>
                      </div>
                      <button
                        onClick={closeMobileMenu}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors text-moon-grey hover:text-white"
                        aria-label="Close menu"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="p-4">
                      {/* User Info (Mobile) */}
                      {user && (
                        <div className="pb-4 mb-4 border-b border-white/[0.04]">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold flex-shrink-0">
                              {user.display_name?.charAt(0).toUpperCase() ||
                                "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white truncate">
                                {truncateUsername(user.display_name || "", 20)}
                              </p>
                              <p className="text-sm text-moon-grey truncate">
                                @{truncateUsername(user.username || "", 18)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-4 py-3 bg-graphite-light rounded-xl">
                            <span className="text-sm text-moon-grey">
                              Balance
                            </span>
                            <span className="font-semibold text-white tabular-nums">
                              {formatUSDC(user?.wallet?.balance_usdc) || "0.00"}{" "}
                              USDC
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Nav Links */}
                      <div className="space-y-1">
                        {navLinks.map((link) => (
                          <Link
                            key={link.path}
                            to={link.path}
                            onClick={closeMobileMenu}
                            className={`block px-4 py-3 rounded-xl font-medium transition-all ${
                              isActive(link.path)
                                ? "bg-neon-iris/15 text-white"
                                : "text-moon-grey hover:text-white hover:bg-white/5"
                            }`}
                          >
                            {link.label}
                          </Link>
                        ))}

                        {user && (
                          <>
                            <Link
                              to="/settings"
                              onClick={closeMobileMenu}
                              className={`block px-4 py-3 rounded-xl font-medium transition-all ${
                                isActive("/settings")
                                  ? "bg-neon-iris/15 text-white"
                                  : "text-moon-grey hover:text-white hover:bg-white/5"
                              }`}
                            >
                              Settings
                            </Link>
                            <button
                              onClick={() => {
                                closeMobileMenu();
                                handleLogout();
                              }}
                              className="w-full text-left px-4 py-3 rounded-xl font-medium text-moon-grey hover:text-brand-danger hover:bg-brand-danger/10 transition-all"
                            >
                              Logout
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </nav>
  );
};

// ===== MENU LINK COMPONENT =====

const MenuLink = ({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    onClick={() => {
      // Close dropdown immediately, before navigation
      onClick();
    }}
    className="flex items-center gap-3 px-4 py-2.5 text-moon-grey hover:text-white hover:bg-white/5 transition-colors"
  >
    {children}
  </Link>
);
