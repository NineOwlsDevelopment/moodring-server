import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserStore } from "@/stores/userStore";
import api from "@/config/axios";
import logo from "../../public/icon.png";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletExpanded, setWalletExpanded] = useState(true); // Expanded by default on login page
  const { connected } = useWallet();
  const { user, isInitializing } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (!isInitializing && user) {
      // Redirect to the page they were trying to access, or markets page
      const from = (location.state as any)?.from?.pathname || "/markets";
      navigate(from, { replace: true });
    }
  }, [user, isInitializing, navigate, location]);

  // Show loading state while checking auth
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // If user is logged in, don't render (redirect will happen)
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a14]">
      <div className="relative overflow-hidden bg-graphite-deep rounded-2xl shadow-2xl w-full max-w-md">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />

        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-neon-iris/10 to-graphite-deep px-6 py-8 border-b border-white/[0.04]">
          <div className="flex items-center gap-3 mb-3">
            <img src={logo} alt="MoodRing" className="w-10 h-10" />
            <span className="text-xl font-bold text-white">MoodRing</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Get Started</h2>
          <p className="text-gray-400 text-sm">
            Sign in or create an account with one simple step
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Email Magic Link */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">
              Sign in with email
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Don't have an account? No problem! Enter your email and we'll
              create one for you automatically.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input"
                required
                disabled={loading}
                autoFocus
              />

              {error && (
                <div className="text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="btn btn-primary w-full py-3"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Send One-Time Password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-graphite-deep text-sm text-gray-500">
                or continue with
              </span>
            </div>
          </div>

          {/* Wallet Login */}
          <div className="relative overflow-hidden rounded-xl bg-white/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />
            <button
              onClick={() => setWalletExpanded(!walletExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-pink-500/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-primary-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white">Solana Wallet</div>
                  <div className="text-xs text-gray-500">
                    Phantom, Solflare, etc.
                  </div>
                </div>
                {connected && (
                  <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                    Connected
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  walletExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {walletExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-white/[0.04] animate-fade-in">
                <p className="text-sm text-gray-400 my-3">
                  Connect your wallet to sign in or create an account. If you
                  don't have an account yet, we'll create one for you
                  automatically.
                </p>
                <div className="flex justify-center [&>button]:!bg-primary-600 [&>button]:!rounded-lg [&>button]:!h-11 [&>button]:!font-medium">
                  <WalletMultiButton />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-graphite-light/30 border-t border-white/[0.04]">
          <p className="text-xs text-gray-500 text-center">
            By signing in, you agree to our{" "}
            <a href="#" className="text-primary-400 hover:text-primary-300">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-primary-400 hover:text-primary-300">
              Privacy Policy
            </a>
          </p>
          <div className="mt-3 text-center">
            <Link
              to="/"
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
