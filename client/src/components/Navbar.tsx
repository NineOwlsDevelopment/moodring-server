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
  TrendingUp,
  Droplets,
} from "lucide-react";

/**
 * Navbar Component
 *
 * Refined design matching the Moodring brand aesthetic:
 * - Sharp edges, no rounded corners
 * - Subtle gradient accents
 * - Extralight typography with refined tracking
 * - Premium dark aesthetic
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

    document.body.style.overflow = "hidden";

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isClickInMenu = mobileMenuRef.current?.contains(target);
      const isClickInButton = mobileMenuButtonRef.current?.contains(target);

      if (!isClickInMenu && !isClickInButton) {
        setIsMobileMenuOpen(false);
      }
    };
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

    socketService.connect();
    socketService.subscribeToBalance(user.id);

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
    { path: "/markets", label: "Markets", icon: TrendingUp },
    { path: "/pools", label: "Pools", icon: Droplets },
    ...(isAdmin ? [{ path: "/admin", label: "Admin", icon: Settings }] : []),
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
    <nav className="relative bg-ink-black/95 backdrop-blur-xl sticky top-0 md:fixed md:top-0 md:left-0 md:right-0 z-50">
      {/* Top gradient line accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/20 to-transparent" />
      {/* Bottom gradient line accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="section-container">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-3 group flex-shrink-0"
          >
            <motion.div
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img src={logo} alt="Moodring" className="w-8 h-8 sm:w-9 sm:h-9" />
            </motion.div>
            <span className="text-lg sm:text-xl font-light tracking-tight text-white group-hover:text-moon-grey-light transition-colors hidden sm:block">
              Moodring
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-neon-iris border border-neon-iris/30">
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
                className={`relative px-5 py-2.5 text-xs font-medium tracking-[0.1em] uppercase transition-all duration-300 ${
                  isActive(link.path)
                    ? "text-white"
                    : "text-moon-grey/60 hover:text-white"
                }`}
              >
                {link.label}
                {isActive(link.path) && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris to-transparent"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {user ? (
              <>
                {/* Balance */}
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.03] border border-white/5">
                  <span className="text-xs sm:text-sm font-light text-white tabular-nums tracking-wide">
                    {formatUSDC(user?.wallet?.balance_usdc) || "0.00"}
                  </span>
                  <span className="text-[10px] sm:text-xs text-moon-grey/50 font-medium tracking-[0.1em] uppercase">
                    USDC
                  </span>
                </div>

                {/* Wallet Icon */}
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="p-2 sm:p-2.5 border border-white/5 hover:border-neon-iris/30 transition-all duration-300 text-moon-grey/60 hover:text-white"
                >
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User Menu Dropdown */}
                <div className="relative hidden md:block" ref={userMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsUserMenuOpen(!isUserMenuOpen);
                    }}
                    className="flex items-center gap-2 p-1.5 border border-transparent hover:border-white/10 transition-all duration-300"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-neon-iris/80 to-aqua-pulse/60 flex items-center justify-center text-white text-xs sm:text-sm font-medium">
                      {user.display_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <motion.div
                      animate={{ rotate: isUserMenuOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-moon-grey/50" />
                    </motion.div>
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-3 w-72 bg-graphite-deep border border-white/5 z-50 overflow-hidden"
                      >
                        {/* Top gradient line */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/40 to-transparent" />

                        {/* User Info Header */}
                        <div className="p-5 border-b border-white/5">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-gradient-to-br from-neon-iris/80 to-aqua-pulse/60 flex items-center justify-center text-white text-base font-medium flex-shrink-0">
                              {user.display_name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-light text-white truncate">
                                {truncateUsername(user.display_name || "", 20)}
                              </p>
                              <p className="text-xs text-moon-grey/50 truncate">
                                @{truncateUsername(user.username || "", 18)}
                              </p>
                            </div>
                          </div>
                          {user.wallet?.publicKey && (
                            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-ink-black border border-white/5">
                              <div className="w-1.5 h-1.5 bg-aqua-pulse animate-pulse flex-shrink-0" />
                              <span className="text-[11px] text-moon-grey/60 font-mono truncate">
                                {truncateAddress(user.wallet.publicKey.toString())}
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
                                  className="ml-auto text-moon-grey/40 hover:text-white transition-colors flex-shrink-0"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            </div>
                          )}
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          <MenuLink to="/my-markets" onClick={closeUserMenu}>
                            <BarChart3 className="w-4 h-4" />
                            <span>My Markets</span>
                          </MenuLink>
                          <MenuLink to="/watchlist" onClick={closeUserMenu}>
                            <Bookmark className="w-4 h-4" />
                            <span>Watchlist</span>
                          </MenuLink>
                          <MenuLink to="/portfolio" onClick={closeUserMenu}>
                            <Wallet className="w-4 h-4" />
                            <span>Portfolio</span>
                          </MenuLink>
                          <MenuLink to="/activity" onClick={closeUserMenu}>
                            <Clock className="w-4 h-4" />
                            <span>Activity</span>
                          </MenuLink>
                          <MenuLink to="/settings" onClick={closeUserMenu}>
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                          </MenuLink>
                        </div>

                        {/* Logout */}
                        <div className="border-t border-white/5 py-2">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-5 py-3 text-moon-grey/60 hover:text-brand-danger hover:bg-brand-danger/5 transition-all duration-300 text-sm font-light"
                          >
                            <LogOut className="w-4 h-4" />
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
                className="group relative px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-medium tracking-wide uppercase bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 inline-flex items-center justify-center gap-2"
              >
                <span>Login</span>
                <svg
                  className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              ref={mobileMenuButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="lg:hidden p-2 text-moon-grey/60 hover:text-white transition-colors border border-white/5 hover:border-white/10"
            >
              <motion.div
                animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
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
                    transition={{ duration: 0.3 }}
                    onClick={closeMobileMenu}
                    className="fixed inset-0 bg-ink-black/80 backdrop-blur-sm z-[100] lg:hidden"
                  />

                  {/* Drawer */}
                  <motion.div
                    ref={mobileMenuRef}
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-graphite-deep z-[101] lg:hidden overflow-y-auto border-l border-white/5"
                    style={{
                      paddingTop: "env(safe-area-inset-top, 0px)",
                      paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    }}
                  >
                    {/* Top gradient line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-iris/30 via-aqua-pulse/20 to-transparent" />

                    {/* Drawer Header with Close Button */}
                    <div className="flex items-center justify-between p-5 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <img src={logo} alt="Moodring" className="w-7 h-7" />
                        <span className="text-base font-light tracking-tight text-white">
                          Moodring
                        </span>
                      </div>
                      <button
                        onClick={closeMobileMenu}
                        className="p-2 border border-white/5 hover:border-white/10 transition-all duration-300 text-moon-grey/60 hover:text-white"
                        aria-label="Close menu"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="p-5">
                      {/* User Info (Mobile) */}
                      {user && (
                        <div className="pb-5 mb-5 border-b border-white/5">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-neon-iris/80 to-aqua-pulse/60 flex items-center justify-center text-white font-medium flex-shrink-0">
                              {user.display_name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-light text-white truncate">
                                {truncateUsername(user.display_name || "", 20)}
                              </p>
                              <p className="text-xs text-moon-grey/50 truncate">
                                @{truncateUsername(user.username || "", 18)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-4 py-3 bg-ink-black border border-white/5">
                            <span className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50">
                              Balance
                            </span>
                            <span className="text-sm font-light text-white tabular-nums">
                              {formatUSDC(user?.wallet?.balance_usdc) || "0.00"}{" "}
                              <span className="text-moon-grey/50 text-xs">USDC</span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Nav Links */}
                      <div className="space-y-1">
                        {navLinks.map((link) => {
                          const Icon = link.icon;
                          return (
                            <Link
                              key={link.path}
                              to={link.path}
                              onClick={closeMobileMenu}
                              className={`flex items-center gap-4 px-4 py-3.5 font-light transition-all duration-300 ${
                                isActive(link.path)
                                  ? "bg-neon-iris/10 text-white border-l-2 border-neon-iris"
                                  : "text-moon-grey/60 hover:text-white hover:bg-white/[0.02]"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="text-sm tracking-wide">{link.label}</span>
                            </Link>
                          );
                        })}

                        {user && (
                          <>
                            {/* Divider */}
                            <div className="my-3 h-px bg-gradient-to-r from-white/5 via-white/10 to-white/5" />

                            <MobileMenuLink
                              to="/my-markets"
                              icon={BarChart3}
                              isActive={isActive("/my-markets")}
                              onClick={closeMobileMenu}
                            >
                              My Markets
                            </MobileMenuLink>
                            <MobileMenuLink
                              to="/portfolio"
                              icon={Wallet}
                              isActive={isActive("/portfolio")}
                              onClick={closeMobileMenu}
                            >
                              Portfolio
                            </MobileMenuLink>
                            <MobileMenuLink
                              to="/watchlist"
                              icon={Bookmark}
                              isActive={isActive("/watchlist")}
                              onClick={closeMobileMenu}
                            >
                              Watchlist
                            </MobileMenuLink>
                            <MobileMenuLink
                              to="/activity"
                              icon={Clock}
                              isActive={isActive("/activity")}
                              onClick={closeMobileMenu}
                            >
                              Activity
                            </MobileMenuLink>
                            <MobileMenuLink
                              to="/settings"
                              icon={Settings}
                              isActive={isActive("/settings")}
                              onClick={closeMobileMenu}
                            >
                              Settings
                            </MobileMenuLink>

                            {/* Divider before logout */}
                            <div className="my-3 h-px bg-gradient-to-r from-white/5 via-white/10 to-white/5" />

                            <button
                              onClick={() => {
                                closeMobileMenu();
                                handleLogout();
                              }}
                              className="w-full flex items-center gap-4 text-left px-4 py-3.5 font-light text-moon-grey/60 hover:text-brand-danger hover:bg-brand-danger/5 transition-all duration-300"
                            >
                              <LogOut className="w-4 h-4" />
                              <span className="text-sm tracking-wide">Logout</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Footer - subtle branding */}
                      <div className="mt-8 pt-5 border-t border-white/5">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-px w-6 bg-gradient-to-r from-transparent to-neon-iris/40" />
                          <span className="text-[9px] tracking-[0.2em] uppercase text-moon-grey/30">
                            Built on Solana
                          </span>
                          <div className="h-px w-6 bg-gradient-to-l from-transparent to-neon-iris/40" />
                        </div>
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
      onClick();
    }}
    className="flex items-center gap-3 px-5 py-3 text-moon-grey/60 hover:text-white hover:bg-white/[0.02] transition-all duration-300 text-sm font-light"
  >
    {children}
  </Link>
);

// ===== MOBILE MENU LINK COMPONENT =====

const MobileMenuLink = ({
  to,
  icon: Icon,
  isActive,
  onClick,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-4 px-4 py-3.5 font-light transition-all duration-300 ${
      isActive
        ? "bg-neon-iris/10 text-white border-l-2 border-neon-iris"
        : "text-moon-grey/60 hover:text-white hover:bg-white/[0.02]"
    }`}
  >
    <Icon className="w-4 h-4" />
    <span className="text-sm tracking-wide">{children}</span>
  </Link>
);
