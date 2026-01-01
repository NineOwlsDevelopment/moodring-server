import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
        return "text-aqua-pulse border-aqua-pulse/30 bg-aqua-pulse/10";
      case "dismissed":
        return "text-moon-grey/50 border-white/10 bg-white/5";
      case "reviewed":
        return "text-neon-iris border-neon-iris/30 bg-neon-iris/10";
      default:
        return "text-amber-400 border-amber-400/30 bg-amber-400/10";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatUSDC = (microUsdc: number) => {
    return (microUsdc / 1_000_000).toFixed(2);
  };

  const statusFilters = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "reviewed", label: "Reviewed" },
    { key: "resolved", label: "Resolved" },
    { key: "dismissed", label: "Dismissed" },
  ] as const;

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
              Disputes
            </h1>
          </div>
          <div className="text-xs sm:text-sm text-moon-grey/50">
            {pagination.total} disputes
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs tracking-wide uppercase font-medium border transition-all duration-300 ${
                  statusFilter === filter.key
                    ? "bg-gradient-to-r from-neon-iris to-aqua-pulse text-white border-transparent"
                    : "bg-white/5 text-moon-grey/70 border-white/10 hover:border-white/20 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </motion.div>

        {loading ? (
          <div className="bg-graphite-deep/30 border border-white/5 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
          </div>
        ) : disputes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 text-center py-20"
          >
            <p className="text-moon-grey/40 text-sm font-light">
              No disputes found
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
                      Market
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Option
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      User
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Reason
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Fee Paid
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
                  {disputes.map((dispute) => (
                    <tr
                      key={dispute.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-5">
                        <Link
                          to={`/market/${dispute.market_id}`}
                          className="text-sm text-neon-iris hover:text-neon-iris/80 font-light transition-colors line-clamp-1"
                        >
                          {dispute.market_question ||
                            shortenAddress(dispute.market_id, 8)}
                        </Link>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-moon-grey/60 text-sm font-light">
                          {dispute.option_label || "N/A"}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-moon-grey/60 text-sm font-light">
                          {dispute.user_display_name ||
                            dispute.user_username ||
                            shortenAddress(dispute.user_id, 8)}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-moon-grey/40 text-sm font-light line-clamp-1 max-w-xs">
                          {dispute.reason}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-moon-grey/60 text-sm font-light tabular-nums">
                          ${formatUSDC(dispute.resolution_fee_paid)} USDC
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase font-medium border ${getStatusColor(
                            dispute.status
                          )}`}
                        >
                          {dispute.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-moon-grey/40 text-sm font-light">
                        {formatDate(dispute.created_at)}
                      </td>
                      <td className="py-4 px-5">
                        {dispute.status === "pending" ? (
                          <button
                            onClick={() =>
                              setReviewForm({
                                disputeId: dispute.id,
                                status: "resolved",
                                reviewNotes: "",
                              })
                            }
                            className="text-[10px] tracking-[0.1em] uppercase text-neon-iris hover:text-neon-iris/80 font-medium transition-colors"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-moon-grey/30 text-[10px]">
                            {dispute.reviewer_username ||
                            dispute.reviewer_display_name
                              ? `By ${
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

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-white/5">
              {disputes.map((dispute) => {
                const isExpanded = expandedId === dispute.id;
                return (
                  <div key={dispute.id} className="p-4">
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : dispute.id)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/market/${dispute.market_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-neon-iris font-light line-clamp-2"
                        >
                          {dispute.market_question ||
                            shortenAddress(dispute.market_id, 8)}
                        </Link>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`px-2 py-0.5 text-[9px] tracking-[0.1em] uppercase font-medium border ${getStatusColor(
                              dispute.status
                            )}`}
                          >
                            {dispute.status}
                          </span>
                          <span className="text-[10px] text-moon-grey/40">
                            ${formatUSDC(dispute.resolution_fee_paid)}
                          </span>
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
                                <span className="text-moon-grey/40">User</span>
                                <div className="text-white font-light mt-1">
                                  {dispute.user_display_name ||
                                    dispute.user_username ||
                                    shortenAddress(dispute.user_id, 8)}
                                </div>
                              </div>
                              <div>
                                <span className="text-moon-grey/40">Option</span>
                                <div className="text-white font-light mt-1">
                                  {dispute.option_label || "N/A"}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-moon-grey/40">Reason</span>
                                <div className="text-white font-light mt-1">
                                  {dispute.reason}
                                </div>
                              </div>
                              <div>
                                <span className="text-moon-grey/40">Created</span>
                                <div className="text-white font-light mt-1">
                                  {formatDate(dispute.created_at)}
                                </div>
                              </div>
                            </div>
                            {dispute.status === "pending" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewForm({
                                    disputeId: dispute.id,
                                    status: "resolved",
                                    reviewNotes: "",
                                  });
                                }}
                                className="w-full py-2.5 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300"
                              >
                                Resolve Dispute
                              </button>
                            )}
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
                      page: prev.page + 1,
                      offset: prev.offset + prev.limit,
                    }));
                    loadDisputes();
                  }}
                  className="px-6 py-2.5 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Load More
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Resolve Modal */}
        {reviewForm.disputeId && (
          <div
            className="fixed inset-0 bg-ink-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() =>
              setReviewForm({
                disputeId: null,
                status: "resolved",
                reviewNotes: "",
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
                Resolve Dispute
              </h2>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
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
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-neon-iris/50 transition-colors"
                  >
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
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
                    placeholder="Add review notes (optional)..."
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors resize-none"
                    rows={4}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5 sm:mt-6">
                <button
                  onClick={() =>
                    setReviewForm({
                      disputeId: null,
                      status: "resolved",
                      reviewNotes: "",
                    })
                  }
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={resolving === reviewForm.disputeId}
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                >
                  {resolving === reviewForm.disputeId
                    ? "Resolving..."
                    : "Submit Resolution"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
