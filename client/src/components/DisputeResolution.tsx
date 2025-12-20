import { useState } from "react";
import { Market, MarketOption } from "@/data/dummyData";
import { disputeResolution } from "@/api/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

interface DisputeResolutionProps {
  market: Market;
  option: MarketOption;
  onDisputed?: () => void;
}

export const DisputeResolution = ({
  market,
  option,
  onDisputed,
}: DisputeResolutionProps) => {
  const { user } = useUserStore();
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [isDisputing, setIsDisputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fixed dispute resolution fee: $100 USDC
  const DISPUTE_RESOLUTION_FEE_USDC = 100;
  const DISPUTE_RESOLUTION_FEE_MICROUSDC =
    DISPUTE_RESOLUTION_FEE_USDC * 1_000_000;

  // Check per-option dispute deadline
  // Dispute window is always exactly 2 hours from when resolution began for this option
  const disputeDeadline = (option as any).dispute_deadline
    ? new Date((option as any).dispute_deadline)
    : null;

  // Only show if option is resolved and has a dispute deadline (OPINION mode options don't have dispute deadlines)
  if (!(option as any).is_resolved) {
    return null;
  }

  if (!disputeDeadline) {
    return null; // OPINION mode options cannot be disputed
  }

  if (new Date() > disputeDeadline) {
    return null; // Dispute window has passed for this option
  }

  const handleDispute = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for disputing");
      return;
    }

    if (!user) {
      setError("You must be logged in to dispute a resolution");
      return;
    }

    // Check user balance for fixed $100 resolution fee
    const userBalance = user.wallet?.balance_usdc || 0;
    if (userBalance < DISPUTE_RESOLUTION_FEE_MICROUSDC) {
      setError(
        `Insufficient balance. You have ${(userBalance / 1_000_000).toFixed(
          2
        )} USDC, but need ${DISPUTE_RESOLUTION_FEE_USDC} USDC for the resolution fee.`
      );
      return;
    }

    setError(null);
    setIsDisputing(true);

    try {
      let evidenceObj = null;
      if (evidence.trim()) {
        try {
          evidenceObj = JSON.parse(evidence);
        } catch {
          evidenceObj = { note: evidence };
        }
      }

      await disputeResolution({
        marketId: market.id,
        optionId: option.id,
        reason: reason.trim(),
        evidence: evidenceObj,
      });

      toast.success("Dispute submitted successfully");
      setShowModal(false);
      setReason("");
      setEvidence("");
      onDisputed?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Failed to submit dispute"
      );
    } finally {
      setIsDisputing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all border border-rose-500/30"
      >
        <svg
          className="w-4 h-4 inline mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Dispute Resolution
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative overflow-hidden bg-graphite-deep rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Dispute Resolution
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-moon-grey hover:text-white transition-colors"
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
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-moon-grey text-sm mb-6">
              Disputing this option's resolution will mark the market as
              DISPUTED and may trigger escalation procedures. Dispute window is
              2 hours from when resolution began. A $100 USDC resolution fee is
              required to submit a dispute.
            </p>

            {disputeDeadline && (
              <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs text-amber-300">
                  <strong>Option:</strong> {option.option_label}
                  <br />
                  <strong>Dispute window closes:</strong>{" "}
                  {disputeDeadline.toLocaleString()}
                </p>
              </div>
            )}

            {user && (
              <div className="mb-4 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-xs text-blue-300">
                  <strong>Your Balance:</strong>{" "}
                  {((user.wallet?.balance_usdc || 0) / 1_000_000).toFixed(2)}{" "}
                  USDC
                </p>
              </div>
            )}

            <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-xs text-amber-300">
                <strong>Resolution Fee:</strong> ${DISPUTE_RESOLUTION_FEE_USDC}{" "}
                USDC
                <br />
                <span className="text-amber-300/70">
                  This fee will be deducted from your wallet and kept by the
                  platform as a resolution processing fee.
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2 block">
                  Reason for Dispute *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isDisputing}
                  placeholder="Explain why you believe this resolution is incorrect..."
                  className="w-full px-4 py-3 bg-dark-900/50 border-2 border-dark-700 rounded-xl text-white text-sm placeholder-gray-600 focus:border-rose-500 focus:ring-0 resize-none transition-all"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2 block">
                  Evidence (Optional)
                </label>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  disabled={isDisputing}
                  placeholder='JSON object or plain text. Example: {"source": "https://example.com", "note": "On-chain data shows different outcome"}'
                  className="w-full px-4 py-3 bg-dark-900/50 border-2 border-dark-700 rounded-xl text-white text-sm placeholder-gray-600 focus:border-rose-500 focus:ring-0 resize-none transition-all font-mono"
                  rows={3}
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setReason("");
                    setEvidence("");
                  }}
                  disabled={isDisputing}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispute}
                  disabled={
                    isDisputing ||
                    !reason.trim() ||
                    (user?.wallet?.balance_usdc || 0) <
                      DISPUTE_RESOLUTION_FEE_MICROUSDC
                  }
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-500/90 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDisputing ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
