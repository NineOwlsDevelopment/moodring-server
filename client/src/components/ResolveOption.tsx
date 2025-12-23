import { useState, useEffect } from "react";
import { Market, MarketOption } from "@/types/market";
import { submitResolution } from "@/api/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

interface ResolveOptionProps {
  market: Market;
  option: MarketOption;
  onResolved?: () => void;
}

export const ResolveOption = ({
  market,
  option,
  onResolved,
}: ResolveOptionProps) => {
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  const { user, isAdmin } = useUserStore();
  const [showModal, setShowModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [winningSide, setWinningSide] = useState<1 | 2>(1); // Default to YES (wins)

  // Check if market uses new resolution system
  const usesNewResolutionSystem = !!(market as any).resolution_mode;
  const resolutionMode = String(
    (market as any).resolution_mode || ""
  ).toUpperCase();
  const isCreator = !!(user && user.id === market.creator_id);

  // Check admin status from both store and user object for reliability
  const userIsAdmin = !!(isAdmin || user?.isAdmin);

  // Authorization logic for submitting resolutions:
  // - User must be logged in
  // - ORACLE: only platform admins can submit
  // - AUTHORITY: creator or admin can submit
  // - OPINION: creator or admin can submit (if market expiration has passed)
  // - Old system: creator or admin
  let hasAuthority = false;

  // First check: user must be logged in
  if (!user) {
    hasAuthority = false;
  } else if (usesNewResolutionSystem) {
    if (resolutionMode === "ORACLE") {
      // ORACLE: only platform admins can submit
      hasAuthority = !!userIsAdmin;
    } else if (resolutionMode === "AUTHORITY") {
      // AUTHORITY: creator or admin can submit
      hasAuthority = !!isCreator || userIsAdmin;
    } else if (resolutionMode === "OPINION") {
      // OPINION: creator or admin can submit
      hasAuthority = !!isCreator || userIsAdmin;
    }
    // If resolutionMode doesn't match any known mode, hasAuthority remains false
  } else {
    // Old system: creator or admin
    hasAuthority = !!(user.id === market.creator_id || userIsAdmin);
  }

  // Reset form when modal opens/closes
  useEffect(() => {
    if (showModal) {
      setNotes("");
      setError(null);
      setWinningSide(1); // Reset to YES
    }
  }, [showModal]);

  // NOW we can do early returns after all hooks have been called
  // Check if option is already resolved
  if (option.is_resolved) {
    return null;
  }

  if (!hasAuthority) {
    return null;
  }

  const handleSubmit = async () => {
    if (!user) return;

    setError(null);
    setIsResolving(true);

    try {
      // Build evidence object
      const evidenceObj: any = {};
      if (notes.trim()) {
        evidenceObj.notes = notes.trim();
      }

      const result = await submitResolution({
        marketId: market.id,
        optionId: option.id,
        outcome: option.option_label,
        winningSide: winningSide,
        evidence: Object.keys(evidenceObj).length > 0 ? evidenceObj : null,
      });

      if (result.resolved) {
        toast.success(
          `Option resolved as ${
            result.option?.winning_side === 1 ? "YES" : "NO"
          }`
        );
      } else {
        toast.success("Resolution submitted successfully");
      }
      setShowModal(false);
      setNotes("");
      setHasSubmitted(true);
      onResolved?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to submit resolution"
      );
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all whitespace-nowrap border border-amber-500/20"
        title="Resolve this option"
      >
        <svg
          className="w-3 h-3 inline mr-0.5"
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
        Resolve
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowModal(false);
            setError(null);
            setNotes("");
            setWinningSide(1);
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-graphite-deep rounded-2xl border border-white/10 p-6 max-w-lg w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient Accent Lines */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Resolve Option
                </h3>
                <p className="text-moon-grey text-sm">{option.option_label}</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                  setNotes("");
                  setWinningSide(1);
                }}
                className="w-8 h-8 flex items-center justify-center text-moon-grey hover:text-white transition-colors rounded-lg hover:bg-white/5"
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

            {/* Description */}
            <p className="text-moon-grey text-sm mb-5">
              Submit a resolution for this option.
            </p>

            {/* Submit Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-5"
            >
              <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-300/90">
                  {resolutionMode === "OPINION"
                    ? "Submit a resolution - include optional notes or data sources."
                    : "Submit a resolution for this option."}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-3 block">
                  Resolution <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setWinningSide(1)}
                    disabled={isResolving}
                    className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                      winningSide === 1
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>YES - This option wins</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWinningSide(2)}
                    disabled={isResolving}
                    className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                      winningSide === 2
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                        : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
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
                      <span>
                        NO - This option loses (e.g., team eliminated)
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-2 block"
                >
                  Notes
                  <span className="text-xs text-moon-grey-dark font-normal ml-1 normal-case">
                    (Optional)
                  </span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isResolving}
                  placeholder="Additional context or explanation..."
                  className="w-full px-3 py-2.5 bg-graphite-light border border-white/10 rounded-xl text-white text-sm placeholder-moon-grey-dark focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 resize-none transition-all"
                  rows={3}
                />
              </div>

              {hasSubmitted && (
                <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-xs text-amber-300">
                    You have already submitted a resolution for this option.
                  </p>
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setNotes("");
                  }}
                  disabled={isResolving}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-500/90 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResolving
                    ? "Submitting..."
                    : `Submit as ${winningSide === 1 ? "YES" : "NO"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
