import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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
          className="relative overflow-hidden bg-graphite-deep w-full max-w-lg border border-white/5"
        >
          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
          
          {/* Subtle atmospheric background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-iris/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-aqua-pulse/5 rounded-full blur-3xl" />
          </div>

          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 border-b border-white/5">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-moon-grey/60 hover:text-white transition-colors duration-300"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 border border-neon-iris/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-neon-iris" />
              </div>
              <div>
                <h2 className="text-2xl font-extralight tracking-tight text-white">Wallet</h2>
                <p className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mt-1">Manage your funds</p>
              </div>
            </div>

            {/* Balance Card */}
            <div className="relative bg-ink-black border border-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 mb-2">
                    Total Balance
                  </p>
                  <p className="text-3xl font-extralight text-white tabular-nums tracking-tight">
                    {displayBalance}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50">USDC</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-aqua-pulse" />
                    <span className="text-[10px] text-aqua-pulse/80 tracking-wider">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setActiveTab("deposit")}
              className={`flex-1 px-6 py-4 text-xs tracking-[0.15em] uppercase font-medium transition-all duration-300 relative ${
                activeTab === "deposit"
                  ? "text-white"
                  : "text-moon-grey/50 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-center gap-2.5">
                <ArrowDownToLine
                  className={`w-4 h-4 ${
                    activeTab === "deposit" ? "text-neon-iris" : ""
                  }`}
                />
                <span>Deposit</span>
              </div>
              {activeTab === "deposit" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris to-transparent"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("withdraw")}
              className={`flex-1 px-6 py-4 text-xs tracking-[0.15em] uppercase font-medium transition-all duration-300 relative ${
                activeTab === "withdraw"
                  ? "text-white"
                  : "text-moon-grey/50 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-center gap-2.5">
                <ArrowUpToLine
                  className={`w-4 h-4 ${
                    activeTab === "withdraw" ? "text-neon-iris" : ""
                  }`}
                />
                <span>Withdraw</span>
              </div>
              {activeTab === "withdraw" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris to-transparent"
                />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 relative">
            {activeTab === "deposit" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="text-sm text-moon-grey/70 font-light leading-relaxed">
                    <span className="text-white font-medium">
                      Only send Solana-native USDC to this address.
                    </span>
                  </p>
                </div>

                {depositAddress ? (
                  <div className="space-y-6">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="relative">
                        {/* Corner accents */}
                        <div className="absolute -top-2 -left-2 w-6 h-6 border-t border-l border-neon-iris/30" />
                        <div className="absolute -top-2 -right-2 w-6 h-6 border-t border-r border-aqua-pulse/30" />
                        <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b border-l border-aqua-pulse/30" />
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b border-r border-neon-iris/30" />
                        
                        {/* QR Container */}
                        <div className="bg-white p-5">
                          <QRCodeSVG
                            value={depositAddress}
                            size={200}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Address Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium">
                          Deposit Address
                        </span>
                        <button
                          onClick={handleCopyAddress}
                          className={`flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-medium transition-all duration-300 border ${
                            copied
                              ? "bg-aqua-pulse/10 text-aqua-pulse border-aqua-pulse/30"
                              : "bg-transparent text-moon-grey/60 border-white/10 hover:border-white/20 hover:text-white"
                          }`}
                          title="Copy address"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="bg-ink-black border border-white/5 p-4">
                        <code className="text-xs font-mono text-white/80 break-all select-all leading-relaxed">
                          {depositAddress}
                        </code>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex w-16 h-16 border border-white/10 items-center justify-center mb-6">
                      <Wallet className="w-7 h-7 text-moon-grey/40" />
                    </div>
                    <p className="text-sm text-moon-grey/60 font-light">
                      Please connect your wallet to see your deposit address.
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleWithdraw}
                className="space-y-5"
              >
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium mb-3">
                    Destination Address
                  </label>
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Enter Solana wallet address"
                    className="w-full bg-ink-black border border-white/10 px-4 py-3.5 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors duration-300"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-moon-grey/50 font-medium mb-3">
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
                      className="w-full bg-ink-black border border-white/10 px-4 py-3.5 pr-28 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors duration-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      required
                      disabled={isSubmitting}
                    />
                    <div className="absolute right-20 top-1/2 -translate-y-1/2 flex flex-col border border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseFloat(withdrawAmount) || 0;
                          const newValue = Math.max(0, current + 1.0);
                          setWithdrawAmount(newValue.toFixed(2));
                        }}
                        disabled={isSubmitting}
                        className="w-7 h-6 flex items-center justify-center bg-ink-black hover:bg-white/5 text-moon-grey/50 hover:text-white transition-all duration-200 border-b border-white/10 disabled:opacity-40"
                        aria-label="Increment"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
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
                        className="w-7 h-6 flex items-center justify-center bg-ink-black hover:bg-white/5 text-moon-grey/50 hover:text-white transition-all duration-200 disabled:opacity-40"
                        aria-label="Decrement"
                      >
                        <svg
                          className="w-3 h-3"
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
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const maxAmount = balance / 1_000_000;
                        setWithdrawAmount(maxAmount.toFixed(2));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-medium text-neon-iris hover:text-white border border-neon-iris/30 hover:border-neon-iris/50 hover:bg-neon-iris/10 transition-all duration-300"
                      disabled={isSubmitting}
                    >
                      Max
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
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
                  className="w-full py-4 text-sm font-medium tracking-wide uppercase bg-white text-ink-black hover:bg-moon-grey-light disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-ink-black/30 border-t-ink-black rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Withdraw USDC</span>
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
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </div>
          
          {/* Bottom gradient accent */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/30 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
