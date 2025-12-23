import { useState, useEffect } from "react";
import { Market } from "@/types/market";
import { submitResolution, getResolution } from "@/api/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

interface SubmitResolutionProps {
  market: Market;
  onSubmitted?: () => void;
}

export const SubmitResolution = ({
  market,
  onSubmitted,
}: SubmitResolutionProps) => {
  const { user, isAdmin } = useUserStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Get market options for outcomes
  const outcomes = market.options?.map((opt) => opt.option_label) || [];

  // Check resolution mode and authorization
  const resolutionMode = (market as any).resolution_mode;
  const isCreator = !!(user && user.id === market.creator_id);

  // Authorization rules:
  // - ORACLE: only platform admins can submit (at any time)
  // - AUTHORITY: creator or admin can submit
  // - OPINION: anyone can submit if market expiration has passed
  let hasAuthority = false;
  if (resolutionMode === "ORACLE") {
    // ORACLE mode: only admins, and they can submit at any time
    hasAuthority = !!isAdmin;
  } else if (resolutionMode === "AUTHORITY") {
    hasAuthority = !!isCreator || !!isAdmin;
  } else if (resolutionMode === "OPINION") {
    // For OPINION, check if market expiration has passed
    const now = new Date();
    const expirationDate = market.expiration_timestamp
      ? new Date(market.expiration_timestamp * 1000)
      : null;
    hasAuthority = expirationDate ? now >= expirationDate : false;
  } else {
    // Legacy markets or no resolution mode - allow creator/admin
    hasAuthority = !!isCreator || !!isAdmin;
  }

  useEffect(() => {
    if (showModal && market.id) {
      loadResolutionData();
    }
  }, [showModal, market.id]);

  const loadResolutionData = async () => {
    try {
      const data = await getResolution(market.id);
      // Check if user has already submitted
      if (data.submissions.length > 0 && user) {
        const userSubmission = data.submissions.find(
          (s) => s.resolver_id === user.id
        );
        if (userSubmission) {
          setHasSubmitted(true);
          setSelectedOutcome(userSubmission.outcome);
          // Load existing evidence data
          if (userSubmission.evidence) {
            if (userSubmission.evidence.notes) {
              setNotes(userSubmission.evidence.notes);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load resolution data:", err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) {
      setError("Please select an outcome");
      return;
    }

    if (!user) {
      setError("You must be logged in to submit a resolution");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Build evidence object
      const evidenceObj: any = {};
      if (notes.trim()) {
        evidenceObj.notes = notes.trim();
      }

      await submitResolution({
        marketId: market.id,
        optionId: market.options?.[0]?.id,
        outcome: selectedOutcome,
        // Note: optionId can be added here if needed for option-level submissions
        evidence: Object.keys(evidenceObj).length > 0 ? evidenceObj : null,
      });

      toast.success("Resolution submitted successfully");
      setShowModal(false);
      setNotes("");
      setSelectedOutcome("");
      setHasSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to submit resolution"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const status = (market as any).status || "OPEN";

  // Don't show if user doesn't have authority
  if (!hasAuthority) {
    return null;
  }

  // Allow submission when status is OPEN or RESOLVING
  if (status === "RESOLVED") {
    return null; // Don't show if already resolved
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 text-sm font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all border border-amber-500/30"
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
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {hasSubmitted ? "Update Submission" : "Submit Resolution"}
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
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Submit Resolution
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

            <p className="text-moon-grey-dark text-xs mb-5">
              Resolution Mode:{" "}
              <span className="text-moon-grey">
                {(market as any).resolution_mode || "Not Set"}
              </span>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-5"
            >
              <div className="space-y-2.5">
                <label className="text-sm font-medium text-moon-grey block">
                  Select Outcome <span className="text-rose-400">*</span>
                </label>
                <div className="space-y-2">
                  {outcomes.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => setSelectedOutcome(outcome)}
                      disabled={isSubmitting}
                      className={`w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        selectedOutcome === outcome
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                          : "bg-dark-900/30 text-gray-400 border border-dark-700/50 hover:border-amber-500/30 hover:text-white hover:bg-dark-900/50"
                      }`}
                    >
                      {outcome}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="notes"
                  className="text-sm font-medium text-moon-grey block"
                >
                  Notes
                  <span className="text-xs text-moon-grey-dark font-normal ml-1">
                    (Optional)
                  </span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Additional context or explanation..."
                  className="w-full px-3 py-2.5 bg-dark-900/30 border border-dark-700/50 rounded-lg text-white text-sm placeholder-gray-500 focus:border-amber-500/50 focus:bg-dark-900/50 focus:ring-0 resize-none transition-all"
                  rows={3}
                />
              </div>

              {hasSubmitted && (
                <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-xs text-amber-300">
                    You have already submitted a resolution. This will update
                    your submission.
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
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedOutcome}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-500/90 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
