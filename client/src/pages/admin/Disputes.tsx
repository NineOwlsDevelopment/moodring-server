import { useEffect, useState } from "react";
import { shortenAddress } from "@/utils/format";
import { fetchDisputes, resolveDispute, Dispute } from "@/api/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export const AdminDisputes = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    offset: 0,
    has_more: false,
  });
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "reviewed" | "resolved" | "dismissed" | "all"
  >("all");
  const [reviewForm, setReviewForm] = useState<{
    disputeId: string | null;
    status: "resolved" | "dismissed";
    reviewNotes: string;
  }>({
    disputeId: null,
    status: "resolved",
    reviewNotes: "",
  });

  useEffect(() => {
    loadDisputes();
  }, [statusFilter]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const data = await fetchDisputes({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setDisputes(data.disputes);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error("Failed to load disputes:", error);
      toast.error(error.response?.data?.error || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!reviewForm.disputeId) return;

    try {
      setResolving(reviewForm.disputeId);
      await resolveDispute(reviewForm.disputeId, {
        status: reviewForm.status,
        review_notes: reviewForm.reviewNotes || undefined,
      });
      toast.success("Dispute resolved successfully");
      setReviewForm({
        disputeId: null,
        status: "resolved",
        reviewNotes: "",
      });
      loadDisputes();
    } catch (error: any) {
      console.error("Failed to resolve dispute:", error);
      toast.error(error.response?.data?.error || "Failed to resolve dispute");
    } finally {
      setResolving(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "text-green-400 bg-green-500/20 border-green-500/30";
      case "dismissed":
        return "text-gray-400 bg-gray-500/20 border-gray-500/30";
      case "reviewed":
        return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      default:
        return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatUSDC = (microUsdc: number) => {
    return (microUsdc / 1_000_000).toFixed(2);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Disputes</h1>
        <div className="text-sm text-gray-400">
          Total: {pagination.total} disputes
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-300">
            Filter by Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as
                  | "pending"
                  | "reviewed"
                  | "resolved"
                  | "dismissed"
                  | "all"
              )
            }
            className="input"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : disputes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No disputes found</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Market
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Option
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    User
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Reason
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Fee Paid
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
                {disputes.map((dispute) => (
                  <tr
                    key={dispute.id}
                    className="border-b border-dark-700 hover:bg-dark-800 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        to={`/market/${dispute.market_id}`}
                        className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                      >
                        {dispute.market_question ||
                          shortenAddress(dispute.market_id, 8)}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-300 text-sm">
                        {dispute.option_label || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-300 text-sm">
                        {dispute.user_display_name ||
                          dispute.user_username ||
                          shortenAddress(dispute.user_id, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-400 text-sm line-clamp-1 max-w-xs">
                        {dispute.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-300 text-sm">
                        ${formatUSDC(dispute.resolution_fee_paid)} USDC
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          dispute.status
                        )}`}
                      >
                        {dispute.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {formatDate(dispute.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      {dispute.status === "pending" ? (
                        <button
                          onClick={() =>
                            setReviewForm({
                              disputeId: dispute.id,
                              status: "resolved",
                              reviewNotes: "",
                            })
                          }
                          className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-gray-500 text-sm">
                          {dispute.reviewer_username ||
                          dispute.reviewer_display_name
                            ? `Reviewed by ${
                                dispute.reviewer_display_name ||
                                dispute.reviewer_username
                              }`
                            : "N/A"}
                        </span>
                      )}
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
                    page: prev.page + 1,
                    offset: prev.offset + prev.limit,
                  }));
                  loadDisputes();
                }}
                className="btn btn-secondary"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resolve Modal */}
      {reviewForm.disputeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">
              Resolve Dispute
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolution Status
                </label>
                <select
                  value={reviewForm.status}
                  onChange={(e) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      status: e.target.value as "resolved" | "dismissed",
                    }))
                  }
                  className="input w-full"
                >
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
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
                  placeholder="Add review notes (optional)..."
                  className="input w-full"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() =>
                  setReviewForm({
                    disputeId: null,
                    status: "resolved",
                    reviewNotes: "",
                  })
                }
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving === reviewForm.disputeId}
                className="btn btn-primary flex-1"
              >
                {resolving === reviewForm.disputeId
                  ? "Resolving..."
                  : "Submit Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
