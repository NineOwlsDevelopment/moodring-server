import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserStore } from "@/stores/userStore";
import api from "@/config/axios";
import logo from "../../public/icon.png";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletExpanded, setWalletExpanded] = useState(false);
  const { connected } = useWallet();
  const { user } = useUserStore();
  const navigate = useNavigate();

  // Close modal when user successfully logs in
  useEffect(() => {
    if (user && isOpen) {
      onClose();
    }
  }, [user, isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/magic-link/request", {
        email,
      });

      if (response.status === 200) {
        onClose();
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

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-ink-black/90 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative overflow-hidden bg-graphite-deep w-full max-w-md border border-white/5"
        >
          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />

          {/* Header */}
          <div className="relative px-8 pt-10 pb-8 border-b border-white/5">
            {/* Subtle radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.1),transparent_60%)]" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 text-moon-grey/40 hover:text-white border border-transparent hover:border-white/10 transition-all duration-300"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <img src={logo} alt="Moodring" className="w-9 h-9" />
                <span className="text-lg font-light tracking-tight text-white">
                  Moodring
                </span>
              </div>

              <h2 className="text-3xl font-extralight tracking-tight text-white mb-2">
                Get Started
              </h2>
              <p className="text-sm text-moon-grey/60 font-light">
                Sign in or create an account with one simple step
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* Email Magic Link */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-neon-iris/30 to-transparent" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium">
                  Email
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-neon-iris/30 to-transparent" />
              </div>

              <p className="text-xs text-moon-grey/50 mb-4 font-light leading-relaxed">
                Don't have an account? No problem! Enter your email and we'll
                create one for you automatically.
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3.5 bg-ink-black border border-white/10 text-white text-sm font-light placeholder:text-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                  required
                  disabled={loading}
                  autoFocus
                />

                {error && (
                  <div className="text-sm text-brand-danger bg-brand-danger/10 border border-brand-danger/20 px-4 py-3 font-light">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="group w-full px-6 py-3.5 text-sm font-medium tracking-wide uppercase bg-white text-ink-black hover:bg-moon-grey-light disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 inline-flex items-center justify-center gap-3"
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
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/40">
                or continue with
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {/* Wallet Login */}
            <div className="relative overflow-hidden border border-white/5 bg-white/[0.02]">
              <button
                onClick={() => setWalletExpanded(!walletExpanded)}
                className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/10 flex items-center justify-center">
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
                    <div className="text-sm font-light text-white">Solana Wallet</div>
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
                        Connect your wallet to sign in or create an account. If you
                        don't have an account yet, we'll create one for you
                        automatically.
                      </p>
                      <div className="flex justify-center [&>button]:!bg-neon-iris [&>button]:!rounded-none [&>button]:!h-11 [&>button]:!font-medium [&>button]:!text-sm [&>button]:!tracking-wide">
                        <WalletMultiButton />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 bg-ink-black/50 border-t border-white/5">
            <p className="text-[11px] text-moon-grey/40 text-center font-light">
              By signing in, you agree to our{" "}
              <a href="#" className="text-moon-grey/60 hover:text-white transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-moon-grey/60 hover:text-white transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>

          {/* Bottom gradient accent */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/20 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
