import { useEffect, useState } from "react";
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Pending Withdrawals</h1>
        <button onClick={loadWithdrawals} className="btn btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No pending withdrawals</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    User
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Destination
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Requested
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal) => (
                  <tr
                    key={withdrawal.id}
                    className="border-b border-dark-700 hover:bg-dark-800 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="text-white font-medium">
                          {withdrawal.username || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {withdrawal.email}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white font-semibold">
                        {withdrawal.token_symbol === "USDC"
                          ? formatUSDC(withdrawal.amount)
                          : `${(withdrawal.amount / 1_000_000_000).toFixed(
                              4
                            )} SOL`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-gray-400">
                        {shortenAddress(withdrawal.destination_address, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {new Date(
                        typeof withdrawal.created_at === "string" &&
                        withdrawal.created_at.includes(" ")
                          ? withdrawal.created_at.replace(" ", "T")
                          : withdrawal.created_at
                      ).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() =>
                          setProcessForm({
                            withdrawalId: withdrawal.id,
                            status: "completed",
                            transactionSignature: "",
                            failureReason: "",
                          })
                        }
                        className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                      >
                        Process
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process Withdrawal Modal */}
      {processForm.withdrawalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">
              Process Withdrawal
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="input w-full"
                >
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              {processForm.status === "completed" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
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
                    className="input w-full"
                  />
                </div>
              )}
              {processForm.status === "failed" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
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
                    className="input w-full"
                    rows={3}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() =>
                  setProcessForm({
                    withdrawalId: null,
                    status: "completed",
                    transactionSignature: "",
                    failureReason: "",
                  })
                }
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={processing === processForm.withdrawalId}
                className="btn btn-primary flex-1"
              >
                {processing === processForm.withdrawalId
                  ? "Processing..."
                  : "Process"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
