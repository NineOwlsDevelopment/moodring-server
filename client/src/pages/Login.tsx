import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserStore } from "@/stores/userStore";
import api from "@/config/axios";
import logo from "../../public/icon.png";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletExpanded, setWalletExpanded] = useState(true);
  const { connected } = useWallet();
  const { user, isInitializing } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (!isInitializing && user) {
      const from = (location.state as any)?.from?.pathname || "/markets";
      navigate(from, { replace: true });
    }
  }, [user, isInitializing, navigate, location]);

  // Show loading state while checking auth
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border border-neon-iris/30 border-t-neon-iris animate-spin" />
          <span className="text-xs tracking-[0.2em] uppercase text-moon-grey/50">
            Loading
          </span>
        </div>
      </div>
    );
  }

  // If user is logged in, don't render
  if (user) {
    return null;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/magic-link/request", {
        email,
      });

      if (response.status === 200) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        setError(response.data.error || "Failed to send magic link");
        setLoading(false);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to send magic link. Please try again."
      );
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-black overflow-hidden">
      {/* Background atmospheric effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative overflow-hidden bg-graphite-deep w-full max-w-md border border-white/5"
      >
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />

        {/* Header */}
        <div className="relative px-8 pt-12 pb-10 border-b border-white/5">
          {/* Subtle radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_60%)]" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <motion.img
                src={logo}
                alt="Moodring"
                className="w-10 h-10"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              />
              <span className="text-xl font-light tracking-tight text-white">
                Moodring
              </span>
              <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-neon-iris border border-neon-iris/30">
                Beta
              </span>
            </div>

            <motion.h1
              className="text-4xl sm:text-5xl font-extralight tracking-[-0.02em] text-white mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Get Started
            </motion.h1>
            <motion.p
              className="text-sm text-moon-grey/60 font-light"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Sign in or create an account with one simple step
            </motion.p>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Email Magic Link */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-neon-iris/30 to-transparent" />
              <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium">
                Email
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-neon-iris/30 to-transparent" />
            </div>

            <p className="text-xs text-moon-grey/50 mb-5 font-light leading-relaxed">
              Don't have an account? No problem! Enter your email and we'll
              create one for you automatically.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-4 bg-ink-black border border-white/10 text-white text-sm font-light placeholder:text-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                required
                disabled={loading}
                autoFocus
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-brand-danger bg-brand-danger/10 border border-brand-danger/20 px-4 py-3 font-light"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="group w-full px-6 py-4 text-sm font-medium tracking-wide uppercase bg-white text-ink-black hover:bg-moon-grey-light disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 inline-flex items-center justify-center gap-3"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-ink-black border-t-transparent animate-spin" />
                    <span>Sending...</span>
                  </span>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Send One-Time Password</span>
                    <svg
                      className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
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
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Divider */}
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/40">
              or continue with
            </span>
            <div className="flex-1 h-px bg-white/5" />
          </motion.div>

          {/* Wallet Login */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="relative overflow-hidden border border-white/5 bg-white/[0.02]"
          >
            <button
              onClick={() => setWalletExpanded(!walletExpanded)}
              className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-neon-iris"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-light text-white">
                    Solana Wallet
                  </div>
                  <div className="text-xs text-moon-grey/50">
                    Phantom, Solflare, etc.
                  </div>
                </div>
                {connected && (
                  <span className="text-[10px] tracking-[0.1em] uppercase text-aqua-pulse border border-aqua-pulse/30 px-2 py-1">
                    Connected
                  </span>
                )}
              </div>
              <motion.svg
                animate={{ rotate: walletExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="w-4 h-4 text-moon-grey/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 9l-7 7-7-7"
                />
              </motion.svg>
            </button>

            <AnimatePresence>
              {walletExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-0 border-t border-white/5">
                    <p className="text-xs text-moon-grey/50 my-4 font-light leading-relaxed">
                      Connect your wallet to sign in or create an account. If
                      you don't have an account yet, we'll create one for you
                      automatically.
                    </p>
                    <div className="flex justify-center [&>button]:!bg-neon-iris [&>button]:!rounded-none [&>button]:!h-12 [&>button]:!font-medium [&>button]:!text-sm [&>button]:!tracking-wide">
                      <WalletMultiButton />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-ink-black/50 border-t border-white/5">
          <p className="text-[11px] text-moon-grey/40 text-center font-light mb-4">
            By signing in, you agree to our{" "}
            <a
              href="#"
              className="text-moon-grey/60 hover:text-white transition-colors"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-moon-grey/60 hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
          </p>
          <div className="text-center">
            <Link
              to="/"
              className="group inline-flex items-center gap-2 text-xs tracking-wide text-moon-grey/50 hover:text-white transition-colors"
            >
              <svg
                className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16l-4-4m0 0l4-4m-4 4h18"
                />
              </svg>
              <span>Back to home</span>
            </Link>
          </div>
        </div>

        {/* Bottom gradient accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/20 to-transparent" />

        {/* Corner decorative elements */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-neon-iris/10 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-neon-iris/10 pointer-events-none" />
      </motion.div>
    </div>
  );
};
