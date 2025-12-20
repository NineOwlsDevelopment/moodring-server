import { useState } from "react";
import { Market } from "@/data/dummyData";
import { finalizeResolution, getResolution } from "@/api/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

interface FinalizeResolutionProps {
  market: Market;
  onFinalized?: () => void;
}

export const FinalizeResolution = ({
  market,
  onFinalized,
}: FinalizeResolutionProps) => {
  const { user, isAdmin } = useUserStore();
  const [showModal, setShowModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Check if user has authority (admin or authorized resolver)
  const hasAuthority = user && isAdmin;

  if (!hasAuthority) {
    return null;
  }

  const loadSubmissions = async () => {
    try {
      const data = await getResolution(market.id);
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  };

  const handleFinalize = async () => {
    if (!user) return;

    setError(null);
    setIsFinalizing(true);

    try {
      const result = await finalizeResolution({
        marketId: market.id,
      });

      toast.success("Market resolved successfully!");
      setShowModal(false);
      onFinalized?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to finalize resolution"
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const status = (market as any).status || "OPEN";
  if (status === "RESOLVED") {
    return null; // Already resolved
  }

  return (
    <>
      <button
        onClick={async () => {
          setShowModal(true);
          await loadSubmissions();
        }}
        className="px-4 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all border border-emerald-500/30"
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
            d="M5 13l4 4L19 7"
          />
        </svg>
        Finalize Resolution
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative overflow-hidden bg-graphite-deep rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Finalize Resolution
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
              This will finalize the market resolution using the resolution
              engine. The outcome will be determined based on the resolution
              mode and submitted resolutions.
            </p>

            {submissions.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">
                  Current Submissions ({submissions.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="px-4 py-2 bg-dark-900/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">
                          {submission.outcome}
                        </span>
                        <span className="text-xs text-moon-grey">
                          {new Date(
                            submission.submitted_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {submissions.length === 0 && (
              <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-sm text-amber-300">
                  No resolution submissions found. Submissions are required
                  before finalizing.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 px-4 py-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                disabled={isFinalizing}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-moon-grey rounded-xl font-medium text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={isFinalizing || submissions.length === 0}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-500/90 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFinalizing ? "Finalizing..." : "Finalize Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
