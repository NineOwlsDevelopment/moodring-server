import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatUSDC } from "@/utils/format";
import { shortenAddress } from "@/utils/format";
import {
  fetchPendingWithdrawals,
  processWithdrawal,
  PendingWithdrawal,
} from "@/api/api";
import { toast } from "sonner";

export const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processForm, setProcessForm] = useState<{
    withdrawalId: string | null;
    status: "completed" | "failed";
    transactionSignature: string;
    failureReason: string;
  }>({
    withdrawalId: null,
    status: "completed",
    transactionSignature: "",
    failureReason: "",
  });

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const data = await fetchPendingWithdrawals();
      setWithdrawals(data.withdrawals);
    } catch (error: any) {
      console.error("Failed to load withdrawals:", error);
      toast.error(error.response?.data?.error || "Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!processForm.withdrawalId) return;

    if (
      processForm.status === "completed" &&
      !processForm.transactionSignature
    ) {
      toast.error(
        "Transaction signature is required for completed withdrawals"
      );
      return;
    }

    if (processForm.status === "failed" && !processForm.failureReason) {
      toast.error("Failure reason is required for failed withdrawals");
      return;
    }

    try {
      setProcessing(processForm.withdrawalId);
      await processWithdrawal(processForm.withdrawalId, {
        status: processForm.status,
        transaction_signature: processForm.transactionSignature || undefined,
        failure_reason: processForm.failureReason || undefined,
      });
      toast.success(`Withdrawal ${processForm.status} successfully`);
      setProcessForm({
        withdrawalId: null,
        status: "completed",
        transactionSignature: "",
        failureReason: "",
      });
      loadWithdrawals();
    } catch (error: any) {
      console.error("Failed to process withdrawal:", error);
      toast.error(
        error.response?.data?.error || "Failed to process withdrawal"
      );
    } finally {
      setProcessing(null);
    }
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
              Pending Withdrawals
            </h1>
          </div>
          <button
            onClick={loadWithdrawals}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </motion.div>

        {loading ? (
          <div className="bg-graphite-deep/30 border border-white/5 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
          </div>
        ) : withdrawals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 text-center py-20"
          >
            <p className="text-moon-grey/40 text-sm font-light">
              No pending withdrawals
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
                      User
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Amount
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Destination
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Requested
                    </th>
                    <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal) => (
                    <tr
                      key={withdrawal.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div>
                          <div className="text-white font-light text-sm">
                            {withdrawal.username || "Unknown"}
                          </div>
                          <div className="text-[10px] text-moon-grey/40">
                            {withdrawal.email}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-white font-light tabular-nums">
                          {withdrawal.token_symbol === "USDC"
                            ? formatUSDC(withdrawal.amount)
                            : `${(withdrawal.amount / 1_000_000_000).toFixed(
                                4
                              )} SOL`}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <code className="font-mono text-[10px] text-moon-grey/40">
                          {shortenAddress(withdrawal.destination_address, 8)}
                        </code>
                      </td>
                      <td className="py-4 px-5 text-moon-grey/40 text-sm font-light">
                        {new Date(
                          typeof withdrawal.created_at === "string" &&
                          withdrawal.created_at.includes(" ")
                            ? withdrawal.created_at.replace(" ", "T")
                            : withdrawal.created_at
                        ).toLocaleString()}
                      </td>
                      <td className="py-4 px-5">
                        <button
                          onClick={() =>
                            setProcessForm({
                              withdrawalId: withdrawal.id,
                              status: "completed",
                              transactionSignature: "",
                              failureReason: "",
                            })
                          }
                          className="text-[10px] tracking-[0.1em] uppercase text-neon-iris hover:text-neon-iris/80 font-medium transition-colors"
                        >
                          Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-white/5">
              {withdrawals.map((withdrawal) => {
                const isExpanded = expandedId === withdrawal.id;
                return (
                  <div key={withdrawal.id} className="p-4">
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : withdrawal.id)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-light text-sm">
                          {withdrawal.username || "Unknown"}
                        </div>
                        <div className="text-[10px] text-moon-grey/40 mt-0.5 truncate">
                          {withdrawal.email}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white font-light tabular-nums">
                          {withdrawal.token_symbol === "USDC"
                            ? formatUSDC(withdrawal.amount)
                            : `${(withdrawal.amount / 1_000_000_000).toFixed(4)} SOL`}
                        </div>
                        <span
                          className={`text-moon-grey/40 transition-transform duration-200 inline-block text-xs ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          ▼
                        </span>
                      </div>
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
                            <div className="grid grid-cols-1 gap-3 text-xs">
                              <div>
                                <span className="text-moon-grey/40">
                                  Destination
                                </span>
                                <div className="text-moon-grey/60 font-mono text-[10px] break-all mt-1">
                                  {withdrawal.destination_address}
                                </div>
                              </div>
                              <div>
                                <span className="text-moon-grey/40">
                                  Requested
                                </span>
                                <div className="text-white font-light mt-1">
                                  {new Date(
                                    typeof withdrawal.created_at === "string" &&
                                    withdrawal.created_at.includes(" ")
                                      ? withdrawal.created_at.replace(" ", "T")
                                      : withdrawal.created_at
                                  ).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setProcessForm({
                                  withdrawalId: withdrawal.id,
                                  status: "completed",
                                  transactionSignature: "",
                                  failureReason: "",
                                });
                              }}
                              className="w-full py-2.5 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300"
                            >
                              Process Withdrawal
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Process Withdrawal Modal */}
        {processForm.withdrawalId && (
          <div
            className="fixed inset-0 bg-ink-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() =>
              setProcessForm({
                withdrawalId: null,
                status: "completed",
                transactionSignature: "",
                failureReason: "",
              })
            }
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-graphite-deep border border-white/5 max-w-md w-full p-5 sm:p-6"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />

              <h2 className="text-lg sm:text-xl font-light text-white mb-5 sm:mb-6">
                Process Withdrawal
              </h2>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                    Status
                  </label>
                  <select
                    value={processForm.status}
                    onChange={(e) =>
                      setProcessForm((prev) => ({
                        ...prev,
                        status: e.target.value as "completed" | "failed",
                      }))
                    }
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-neon-iris/50 transition-colors"
                  >
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                {processForm.status === "completed" && (
                  <div>
                    <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                      Transaction Signature *
                    </label>
                    <input
                      type="text"
                      value={processForm.transactionSignature}
                      onChange={(e) =>
                        setProcessForm((prev) => ({
                          ...prev,
                          transactionSignature: e.target.value,
                        }))
                      }
                      placeholder="Transaction signature"
                      className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors font-mono"
                    />
                  </div>
                )}
                {processForm.status === "failed" && (
                  <div>
                    <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                      Failure Reason *
                    </label>
                    <textarea
                      value={processForm.failureReason}
                      onChange={(e) =>
                        setProcessForm((prev) => ({
                          ...prev,
                          failureReason: e.target.value,
                        }))
                      }
                      placeholder="Reason for failure"
                      className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors resize-none"
                      rows={3}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5 sm:mt-6">
                <button
                  onClick={() =>
                    setProcessForm({
                      withdrawalId: null,
                      status: "completed",
                      transactionSignature: "",
                      failureReason: "",
                    })
                  }
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcess}
                  disabled={processing === processForm.withdrawalId}
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                >
                  {processing === processForm.withdrawalId
                    ? "Processing..."
                    : "Process"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
