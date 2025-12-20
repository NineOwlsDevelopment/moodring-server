import { useEffect, useState } from "react";
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
        return "text-red-400 bg-red-500/20 border-red-500/30";
      case "cleared":
        return "text-green-400 bg-green-500/20 border-green-500/30";
      case "reviewed":
        return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      default:
        return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Suspicious Trades</h1>
        <div className="text-sm text-gray-400">
          Total: {pagination.total} suspicious trades
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : trades.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No suspicious trades found</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Trade ID
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    User ID
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Risk Score
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Flags
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-dark-700 hover:bg-dark-800 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-gray-400">
                        {shortenAddress(trade.trade_id, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-gray-400">
                        {shortenAddress(trade.user_id, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.risk_score >= 8
                            ? "text-red-400 bg-red-500/20"
                            : trade.risk_score >= 5
                            ? "text-yellow-400 bg-yellow-500/20"
                            : "text-green-400 bg-green-500/20"
                        }`}
                      >
                        {trade.risk_score.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {trade.flags.map((flag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          trade.review_status
                        )}`}
                      >
                        {trade.review_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {new Date(
                        typeof trade.created_at === "string" &&
                        trade.created_at.includes(" ")
                          ? trade.created_at.replace(" ", "T")
                          : trade.created_at
                      ).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
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
                        className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.has_more && (
            <div className="flex justify-center mt-6 pt-6 border-t border-dark-700">
              <button
                onClick={() => {
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }));
                  loadTrades();
                }}
                className="btn btn-secondary"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewForm.tradeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">
              Review Suspicious Trade
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="input w-full"
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="cleared">Cleared</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="input w-full"
                  rows={4}
                />
              </div>
              <div className="flex items-center">
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
                  className="mr-2"
                />
                <label htmlFor="manualAction" className="text-sm text-gray-300">
                  Manual action required
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
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
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={reviewing === reviewForm.tradeId}
                className="btn btn-primary flex-1"
              >
                {reviewing === reviewForm.tradeId
                  ? "Reviewing..."
                  : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
