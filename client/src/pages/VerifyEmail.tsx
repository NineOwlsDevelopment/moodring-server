import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useUserStore } from "@/stores/userStore";
import api, { setTokenExpiry } from "@/config/axios";
import { PublicKey } from "@solana/web3.js";

export const VerifyEmail = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useUserStore();

  useEffect(() => {
    // Check if email is in URL params
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/magic-link/verify", {
        otp: code.trim(),
        email: email || undefined,
      });

      if (response.status === 200) {
        localStorage.setItem("hasPreviousSession", "true");

        // Convert public_key string to PublicKey object
        const publicKeyString =
          response.data.user.wallet.publicKey ||
          response.data.user.wallet.public_key;
        const publicKey = publicKeyString
          ? typeof publicKeyString === "string"
            ? new PublicKey(publicKeyString)
            : publicKeyString
          : null;

        if (!publicKey) {
          throw new Error("No public key found in wallet data");
        }

        setUser({
          id: response.data.user.id,
          username: response.data.user.username,
          display_name: response.data.user.display_name,
          email: response.data.user.email,
          isAdmin: response.data.user.isAdmin || false,
          wallet: {
            id: response.data.user.wallet.id,
            publicKey,
            balance_sol: response.data.user.wallet.balance_sol,
            balance_usdc: response.data.user.wallet.balance_usdc,
          },
        });

        // Set token expiry for proactive refresh
        setTokenExpiry();

        // Redirect to home
        navigate("/");
      } else {
        setError(response.data.error || "Invalid verification code");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Invalid verification code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Email is required to resend code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/email/send-magic-link", {
        email,
      });

      if (response.data.success) {
        setError(""); // Clear any previous errors
        toast.success("Verification code resent! Please check your email.");
      } else {
        setError(response.data.error || "Failed to resend code");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to resend code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="w-full max-w-md">
        <div className="card">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-400 text-sm">
              {email
                ? `Enter the verification code sent to ${email}`
                : "Enter the verification code from your email"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            {/* Email input (if not in URL) */}
            {!email && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input"
                  required
                />
              </div>
            )}

            {/* Code input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                className="input text-center text-2xl tracking-widest font-mono"
                maxLength={6}
                required
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Check your email for the verification code
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="text-sm text-danger-400 bg-danger-400/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !code || code.length !== 6}
              className="btn btn-primary w-full"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            {/* Resend code */}
            {email && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50"
                >
                  Didn't receive the code? Resend
                </button>
              </div>
            )}
          </form>

          {/* Back to login */}
          <div className="mt-6 pt-6 border-t border-dark-800 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
