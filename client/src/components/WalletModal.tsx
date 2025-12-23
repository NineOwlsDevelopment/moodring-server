import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Copy,
  ArrowDownToLine,
  ArrowUpToLine,
  Wallet,
  Check,
} from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { requestWithdrawal } from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { toast } from "sonner";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal = ({ isOpen, onClose }: WalletModalProps) => {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Convert PublicKey to string if it exists
  const depositAddress = user?.wallet?.publicKey
    ? typeof user.wallet.publicKey === "string"
      ? user.wallet.publicKey
      : user.wallet.publicKey.toString()
    : "";
  const balance = user?.wallet?.balance_usdc || 0;
  const displayBalance = formatUSDC(balance);

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

  const handleCopyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!destinationAddress.trim()) {
      toast.error("Please enter a destination address");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Convert to micro-USDC (6 decimals)
    const amountMicroUsdc = Math.floor(amount * 1_000_000);

    if (amountMicroUsdc > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setIsSubmitting(true);

    try {
      await requestWithdrawal({
        destination_address: destinationAddress.trim(),
        amount: amountMicroUsdc,
      });

      toast.success("Withdrawal request submitted successfully");
      setWithdrawAmount("");
      setDestinationAddress("");
      onClose();
    } catch (error: any) {
      console.log(error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to process withdrawal. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative overflow-hidden bg-graphite-deep rounded-3xl shadow-2xl w-full max-w-lg animate-scale-in border border-white/5">
        {/* Animated gradient borders */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/40 to-transparent" />

        {/* Subtle mesh background */}
        <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none" />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-moon-grey hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 group"
            aria-label="Close"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-neon-iris/20 to-aqua-pulse/20 rounded-xl border border-neon-iris/30">
              <Wallet className="w-5 h-5 text-neon-iris" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Wallet</h2>
              <p className="text-xs text-moon-grey mt-0.5">Manage your funds</p>
            </div>
          </div>

          {/* Balance Card */}
          <div className="relative bg-gradient-to-br from-graphite-light to-graphite-deep rounded-xl p-4 border border-white/5 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-iris/5 rounded-full blur-3xl" />
            <div className="relative">
              <p className="text-xs text-moon-grey mb-1.5 uppercase tracking-wider font-medium">
                Total Balance
              </p>
              <p className="text-3xl font-bold text-white tabular-nums">
                {displayBalance}
              </p>
              <p className="text-xs text-moon-grey mt-1.5">USDC</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] bg-graphite-deep/50">
          <button
            onClick={() => setActiveTab("deposit")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 relative group ${
              activeTab === "deposit"
                ? "text-white"
                : "text-moon-grey hover:text-white"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowDownToLine
                className={`w-4 h-4 transition-transform duration-200 ${
                  activeTab === "deposit" ? "text-neon-iris" : ""
                }`}
              />
              <span>Deposit</span>
            </div>
            {activeTab === "deposit" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neon-iris via-aqua-pulse to-neon-iris" />
            )}
            {activeTab !== "deposit" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-neon-iris group-hover:w-full transition-all duration-200" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 relative group ${
              activeTab === "withdraw"
                ? "text-white"
                : "text-moon-grey hover:text-white"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowUpToLine
                className={`w-4 h-4 transition-transform duration-200 ${
                  activeTab === "withdraw" ? "text-neon-iris" : ""
                }`}
              />
              <span>Withdraw</span>
            </div>
            {activeTab === "withdraw" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neon-iris via-aqua-pulse to-neon-iris" />
            )}
            {activeTab !== "withdraw" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-neon-iris group-hover:w-full transition-all duration-200" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 relative">
          {activeTab === "deposit" ? (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-moon-grey leading-relaxed">
                  <span className="font-bold">
                    ONLY SEND SOLANA-NATIVE USDC TO THIS ADDRESS.
                  </span>
                  <br />
                </p>
              </div>

              {depositAddress ? (
                <div className="space-y-5">
                  {/* QR Code - Enhanced Design */}
                  <div className="flex justify-center">
                    <div className="relative group">
                      {/* Outer glow ring */}
                      <div className="absolute -inset-1 bg-gradient-to-r from-neon-iris via-aqua-pulse to-neon-iris rounded-2xl opacity-20 group-hover:opacity-40 blur-sm transition-opacity duration-300" />

                      {/* Gradient border container */}
                      <div className="relative p-1 bg-gradient-to-br from-neon-iris/30 via-aqua-pulse/20 to-neon-iris/30 rounded-2xl">
                        {/* Inner white container */}
                        <div className="bg-white rounded-xl p-5 shadow-2xl">
                          <QRCodeSVG
                            value={depositAddress}
                            size={220}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                      </div>

                      {/* Decorative corner accents */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-neon-iris/50 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-aqua-pulse/50 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-aqua-pulse/50 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-neon-iris/50 rounded-br-lg" />
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-moon-grey font-semibold uppercase tracking-wider">
                        Deposit Address
                      </span>
                      <button
                        onClick={handleCopyAddress}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                          copied
                            ? "bg-aqua-pulse/20 text-aqua-pulse border border-aqua-pulse/30"
                            : "bg-white/5 text-moon-grey hover:text-white hover:bg-white/10 border border-white/10 hover:border-neon-iris/30"
                        }`}
                        title="Copy address"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative bg-graphite-light rounded-xl p-4 border border-white/5 overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-neon-iris/5 rounded-full blur-2xl" />
                      <code className="relative text-xs font-mono text-white break-all select-all leading-relaxed">
                        {depositAddress}
                      </code>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex p-4 bg-graphite-light rounded-2xl mb-4 border border-white/5">
                    <Wallet className="w-8 h-8 text-moon-grey" />
                  </div>
                  <p className="text-sm text-moon-grey">
                    Please connect your wallet to see your deposit address.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-moon-grey mb-2.5">
                  Destination Address
                </label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="Enter Solana wallet address"
                  className="input w-full"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-moon-grey mb-2.5">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="input w-full pr-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                    disabled={isSubmitting}
                  />
                  <div className="absolute right-20 top-1/2 -translate-y-1/2 flex flex-col border border-white/10 rounded-md overflow-hidden bg-graphite-deep/80 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(withdrawAmount) || 0;
                        const newValue = Math.max(0, current + 1.0);
                        setWithdrawAmount(newValue.toFixed(2));
                      }}
                      disabled={isSubmitting}
                      className="w-7 h-6 flex items-center justify-center bg-graphite-deep hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 border-b border-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-graphite-deep disabled:hover:text-moon-grey group"
                      aria-label="Increment"
                    >
                      <svg
                        className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(withdrawAmount) || 0;
                        const newValue = Math.max(0, current - 1.0);
                        setWithdrawAmount(newValue.toFixed(2));
                      }}
                      disabled={isSubmitting}
                      className="w-7 h-6 flex items-center justify-center bg-graphite-deep hover:bg-neon-iris/20 hover:border-neon-iris/50 text-moon-grey hover:text-neon-iris-light active:bg-neon-iris/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-graphite-deep disabled:hover:text-moon-grey group"
                      aria-label="Decrement"
                    >
                      <svg
                        className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = balance / 1_000_000;
                      setWithdrawAmount(maxAmount.toFixed(2));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold text-neon-iris hover:text-neon-iris-light bg-neon-iris/10 hover:bg-neon-iris/20 rounded-lg transition-all duration-200 border border-neon-iris/20 hover:border-neon-iris/40"
                    disabled={isSubmitting}
                  >
                    Max
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-moon-grey">
                    Available:{" "}
                    <span className="text-white font-medium">
                      {displayBalance}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting || !withdrawAmount || !destinationAddress
                }
                className="btn btn-primary w-full py-3.5 text-base font-semibold shadow-lg shadow-neon-iris/20 hover:shadow-neon-iris/30 transition-all duration-200"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Withdraw USDC"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
