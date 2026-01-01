import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { shortenAddress } from "@/utils/format";
import {
  fetchSuspiciousTrades,
  reviewSuspiciousTrade,
  SuspiciousTrade,
} from "@/api/api";
import { toast } from "sonner";

export const AdminSuspiciousTrades = () => {
  const [trades, setTrades] = useState<SuspiciousTrade[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false,
  });
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<{
    tradeId: string | null;
    reviewStatus: "pending" | "reviewed" | "cleared" | "flagged";
    reviewNotes: string;
    riskScore: string;
    manualActionRequired: boolean;
  }>({
    tradeId: null,
    reviewStatus: "reviewed",
    reviewNotes: "",
    riskScore: "",
    manualActionRequired: false,
  });

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      setLoading(true);
      const data = await fetchSuspiciousTrades({
        limit: pagination.limit,
        page: Math.floor(pagination.offset / pagination.limit) + 1,
      });
      setTrades(data.suspicious_trades);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error("Failed to load suspicious trades:", error);
      toast.error(
        error.response?.data?.error || "Failed to load suspicious trades"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewForm.tradeId) return;

    try {
      setReviewing(reviewForm.tradeId);
      await reviewSuspiciousTrade(reviewForm.tradeId, {
        review_status: reviewForm.reviewStatus,
        review_notes: reviewForm.reviewNotes || undefined,
        risk_score: reviewForm.riskScore
          ? Number(reviewForm.riskScore)
          : undefined,
        manual_action_required: reviewForm.manualActionRequired,
      });
      toast.success("Trade reviewed successfully");
      setReviewForm({
        tradeId: null,
        reviewStatus: "reviewed",
        reviewNotes: "",
        riskScore: "",
        manualActionRequired: false,
      });
      loadTrades();
    } catch (error: any) {
      console.error("Failed to review trade:", error);
      toast.error(error.response?.data?.error || "Failed to review trade");
    } finally {
      setReviewing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "flagged":
        return "text-rose-400 border-rose-400/30 bg-rose-400/10";
      case "cleared":
        return "text-aqua-pulse border-aqua-pulse/30 bg-aqua-pulse/10";
      case "reviewed":
        return "text-neon-iris border-neon-iris/30 bg-neon-iris/10";
      default:
        return "text-amber-400 border-amber-400/30 bg-amber-400/10";
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "text-rose-400 bg-rose-500/10";
    if (score >= 5) return "text-amber-400 bg-amber-500/10";
    return "text-aqua-pulse bg-aqua-pulse/10";
  };

  return (
    <div className="min-h-screen bg-ink-black">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.08),transparent_60%)]" />
      </div>

      <div className="relative px-4 py-6 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-10"
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-2 sm:mb-3">
              Administration
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extralight tracking-tight text-white">
              Suspicious Trades
            </h1>
          </div>
          <div className="text-xs sm:text-sm text-moon-grey/50">
            {pagination.total} flagged trades
          </div>
        </motion.div>

        {loading ? (
          <div className="bg-graphite-deep/30 border border-white/5 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
          </div>
        ) : trades.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 text-center py-20"
          >
            <p className="text-moon-grey/40 text-sm font-light">
              No suspicious trades found
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-graphite-deep/30 border border-white/5"
          >
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Trade ID
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      User ID
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Risk Score
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Flags
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Status
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Created
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-5">
                        <code className="font-mono text-[10px] text-moon-grey/40">
                          {shortenAddress(trade.trade_id, 8)}
                        </code>
                      </td>
                      <td className="py-4 px-5">
                        <code className="font-mono text-[10px] text-moon-grey/40">
                          {shortenAddress(trade.user_id, 8)}
                        </code>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium ${getRiskColor(
                            trade.risk_score
                          )}`}
                        >
                          {trade.risk_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5">
                          {trade.flags.slice(0, 3).map((flag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-[10px] bg-white/5 text-moon-grey/60 border border-white/10"
                            >
                              {flag}
                            </span>
                          ))}
                          {trade.flags.length > 3 && (
                            <span className="px-2 py-0.5 text-[10px] text-moon-grey/40">
                              +{trade.flags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase font-medium border ${getStatusColor(
                            trade.review_status
                          )}`}
                        >
                          {trade.review_status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-moon-grey/40 text-sm font-light">
                        {new Date(
                          typeof trade.created_at === "string" &&
                          trade.created_at.includes(" ")
                            ? trade.created_at.replace(" ", "T")
                            : trade.created_at
                        ).toLocaleString()}
                      </td>
                      <td className="py-4 px-5">
                        <button
                          onClick={() =>
                            setReviewForm({
                              tradeId: trade.id,
                              reviewStatus: trade.review_status,
                              reviewNotes: trade.review_notes || "",
                              riskScore: trade.risk_score.toString(),
                              manualActionRequired:
                                trade.manual_action_required || false,
                            })
                          }
                          className="text-[10px] tracking-[0.1em] uppercase text-neon-iris hover:text-neon-iris/80 font-medium transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-white/5">
              {trades.map((trade) => {
                const isExpanded = expandedId === trade.id;
                return (
                  <div key={trade.id} className="p-4">
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : trade.id)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium ${getRiskColor(
                              trade.risk_score
                            )}`}
                          >
                            Risk: {trade.risk_score.toFixed(1)}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] tracking-[0.1em] uppercase font-medium border ${getStatusColor(
                              trade.review_status
                            )}`}
                          >
                            {trade.review_status}
                          </span>
                        </div>
                        <div className="text-[10px] text-moon-grey/40 mt-2 font-mono">
                          Trade: {shortenAddress(trade.trade_id, 8)}
                        </div>
                      </div>
                      <span
                        className={`text-moon-grey/40 transition-transform duration-200 inline-block text-xs ml-2 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        ▼
                      </span>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-moon-grey/40">User ID</span>
                                <div className="text-moon-grey/60 font-mono text-[10px] mt-1">
                                  {shortenAddress(trade.user_id, 8)}
                                </div>
                              </div>
                              <div>
                                <span className="text-moon-grey/40">Created</span>
                                <div className="text-white font-light mt-1">
                                  {new Date(
                                    typeof trade.created_at === "string" &&
                                    trade.created_at.includes(" ")
                                      ? trade.created_at.replace(" ", "T")
                                      : trade.created_at
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div>
                              <span className="text-moon-grey/40 text-xs">
                                Flags
                              </span>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {trade.flags.map((flag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 text-[10px] bg-white/5 text-moon-grey/60 border border-white/10"
                                  >
                                    {flag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewForm({
                                  tradeId: trade.id,
                                  reviewStatus: trade.review_status,
                                  reviewNotes: trade.review_notes || "",
                                  riskScore: trade.risk_score.toString(),
                                  manualActionRequired:
                                    trade.manual_action_required || false,
                                });
                              }}
                              className="w-full py-2.5 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300"
                            >
                              Review Trade
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.has_more && (
              <div className="flex justify-center py-6 border-t border-white/5">
                <button
                  onClick={() => {
                    setPagination((prev) => ({
                      ...prev,
                      offset: prev.offset + prev.limit,
                    }));
                    loadTrades();
                  }}
                  className="px-6 py-2.5 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Load More
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Review Modal */}
        {reviewForm.tradeId && (
          <div
            className="fixed inset-0 bg-ink-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() =>
              setReviewForm({
                tradeId: null,
                reviewStatus: "reviewed",
                reviewNotes: "",
                riskScore: "",
                manualActionRequired: false,
              })
            }
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-graphite-deep border border-white/5 max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />

              <h2 className="text-lg sm:text-xl font-light text-white mb-5 sm:mb-6">
                Review Suspicious Trade
              </h2>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                    Review Status
                  </label>
                  <select
                    value={reviewForm.reviewStatus}
                    onChange={(e) =>
                      setReviewForm((prev) => ({
                        ...prev,
                        reviewStatus: e.target.value as any,
                      }))
                    }
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-neon-iris/50 transition-colors"
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="cleared">Cleared</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                    Risk Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={reviewForm.riskScore}
                    onChange={(e) =>
                      setReviewForm((prev) => ({
                        ...prev,
                        riskScore: e.target.value,
                      }))
                    }
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                    Review Notes
                  </label>
                  <textarea
                    value={reviewForm.reviewNotes}
                    onChange={(e) =>
                      setReviewForm((prev) => ({
                        ...prev,
                        reviewNotes: e.target.value,
                      }))
                    }
                    placeholder="Add review notes..."
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors resize-none"
                    rows={4}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="manualAction"
                    checked={reviewForm.manualActionRequired}
                    onChange={(e) =>
                      setReviewForm((prev) => ({
                        ...prev,
                        manualActionRequired: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-neon-iris"
                  />
                  <label
                    htmlFor="manualAction"
                    className="text-sm text-moon-grey/60"
                  >
                    Manual action required
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-5 sm:mt-6">
                <button
                  onClick={() =>
                    setReviewForm({
                      tradeId: null,
                      reviewStatus: "reviewed",
                      reviewNotes: "",
                      riskScore: "",
                      manualActionRequired: false,
                    })
                  }
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={reviewing === reviewForm.tradeId}
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                >
                  {reviewing === reviewForm.tradeId
                    ? "Reviewing..."
                    : "Submit Review"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
