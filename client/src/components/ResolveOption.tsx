import { useState, useEffect, useMemo } from "react";
import { Market, MarketOption } from "@/types/market";
import { submitResolution, finalizeOptionResolution } from "@/api/api";
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
  // For submission-based resolution
  const [notes, setNotes] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // For direct resolution
  const [winningSide, setWinningSide] = useState<1 | 2>(2); // Default to NO (eliminated)

  // Check if market uses new resolution system
  const usesNewResolutionSystem = !!(market as any).resolution_mode;
  const resolutionMode = String(
    (market as any).resolution_mode || ""
  ).toUpperCase();
  const isCreator = !!(user && user.id === market.creator_id);

  // Check admin status from both store and user object for reliability
  const userIsAdmin = !!(isAdmin || user?.isAdmin);

  // Authorization logic:
  // - ORACLE: only platform admins can resolve
  // - AUTHORITY: only authorized resolver (creator) can directly resolve
  // - OPINION: creator can submit resolution requests
  // - Old system: creator, admin, or designated resolver
  let hasAuthority = false;
  let canDirectResolve = false;
  let canSubmit = false;

  if (usesNewResolutionSystem) {
    if (resolutionMode === "ORACLE") {
      // ORACLE: only platform admins can resolve
      // Ensure user is logged in and is an admin
      hasAuthority = !!(user && userIsAdmin);
      canDirectResolve = !!(user && userIsAdmin);
      canSubmit = !!(user && userIsAdmin); // Admins can submit resolutions for ORACLE mode
    } else if (resolutionMode === "AUTHORITY") {
      // AUTHORITY: only creator can directly resolve
      hasAuthority = !!isCreator || userIsAdmin;
      canDirectResolve = !!isCreator || userIsAdmin;
      canSubmit = false; // No submissions for AUTHORITY
    } else if (resolutionMode === "OPINION") {
      // OPINION: creator can submit resolution requests
      hasAuthority = !!isCreator || userIsAdmin;
      canDirectResolve = false; // No direct resolution for OPINION
      canSubmit = !!isCreator || userIsAdmin; // Creator can submit resolution requests
    }
    // If resolutionMode doesn't match any known mode, hasAuthority remains false
  } else {
    // Old system: creator, admin, or designated resolver
    hasAuthority = !!(
      user &&
      (user.id === market.creator_id ||
        userIsAdmin ||
        (market as any).designated_resolver === user.id)
    );
    canDirectResolve = hasAuthority;
  }

  // Determine default tab based on available options
  const defaultTab = useMemo(() => {
    if (canDirectResolve) return "direct";
    if (canSubmit) return "submit";
    return "submit";
  }, [canDirectResolve, canSubmit]);

  const [activeTab, setActiveTab] = useState<"submit" | "direct">(defaultTab);

  // Update tab if current one is not available
  useEffect(() => {
    // Skip if neither option is available (component will return null anyway)
    if (!canDirectResolve && !canSubmit) {
      return;
    }

    // Only update if the current tab is not available and the other one is available
    // This prevents infinite loops by ensuring we only switch when the alternative exists
    if (activeTab === "direct" && !canDirectResolve && canSubmit) {
      setActiveTab("submit");
    } else if (activeTab === "submit" && !canSubmit && canDirectResolve) {
      setActiveTab("direct");
    }
    // Note: We don't update if the current tab is valid, preventing unnecessary re-renders
  }, [activeTab, canDirectResolve, canSubmit]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (showModal) {
      setNotes("");
      setError(null);
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

  const handleDirectResolve = async () => {
    if (!user) return;

    setError(null);
    setIsResolving(true);

    try {
      await finalizeOptionResolution({
        marketId: market.id,
        optionId: option.id,
        winningSide: winningSide,
      });

      toast.success(`Option resolved as ${winningSide === 1 ? "YES" : "NO"}`);
      setShowModal(false);
      onResolved?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Failed to resolve option"
      );
    } finally {
      setIsResolving(false);
    }
  };

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
              {resolutionMode === "AUTHORITY" ? (
                <>
                  Resolve this option independently of the market expiration.
                  This is useful when an option can be determined early (e.g., a
                  team gets eliminated).
                </>
              ) : (
                <>Submit a resolution for this option.</>
              )}
            </p>

            {/* Tabs */}
            {canDirectResolve && canSubmit && (
              <div className="flex gap-2 mb-5 border-b border-white/[0.04]">
                <button
                  onClick={() => setActiveTab("direct")}
                  className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                    activeTab === "direct"
                      ? "text-amber-400 border-amber-500"
                      : "text-moon-grey hover:text-white border-transparent"
                  }`}
                >
                  Direct Resolve
                </button>
                <button
                  onClick={() => setActiveTab("submit")}
                  className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                    activeTab === "submit"
                      ? "text-amber-400 border-amber-500"
                      : "text-moon-grey hover:text-white border-transparent"
                  }`}
                >
                  Submit Resolution
                </button>
              </div>
            )}

            {/* Direct Resolve Tab */}
            {activeTab === "direct" && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-medium text-moon-grey-dark uppercase tracking-wider mb-3 block">
                    Resolution
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
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
                    }}
                    disabled={isResolving}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDirectResolve}
                    disabled={isResolving}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-500/90 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResolving ? "Resolving..." : "Resolve Option"}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Tab */}
            {activeTab === "submit" && (
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
                    {isResolving ? "Submitting..." : "Submit Resolution"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
