import { useEffect, useState } from "react";
import { shortenAddress } from "@/utils/format";
import { formatUSDC } from "@/utils/format";
import {
  fetchAdminUsers,
  adjustUserBalance,
  toggleUserAdmin,
  AdminUser,
  AdminUsersResponse,
} from "@/api/api";
import { toast } from "sonner";

// Micro-USDC conversion constant (1 USDC = 1,000,000 micro-USDC)
const MICRO_USDC_PER_USDC = 1_000_000;

export const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjustingBalance, setAdjustingBalance] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState<{
    userId: string | null;
    amount: string;
    token: "SOL" | "USDC";
    reason: string;
  }>({
    userId: null,
    amount: "",
    token: "USDC",
    reason: "",
  });
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [pagination.page, search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      toast.error(error.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadUsers();
  };

  const handleAdjustBalance = async () => {
    if (!adjustForm.userId || !adjustForm.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setAdjustingBalance(adjustForm.userId);
      // Convert USDC to micro-USDC if needed
      let amount = Number(adjustForm.amount);
      if (adjustForm.token === "USDC") {
        amount = Math.round(amount * MICRO_USDC_PER_USDC);
      }

      await adjustUserBalance(adjustForm.userId, {
        amount,
        token_symbol: adjustForm.token,
        reason: adjustForm.reason || "Manual adjustment",
      });
      toast.success("Balance adjusted successfully");
      setAdjustForm({
        userId: null,
        amount: "",
        token: "USDC",
        reason: "",
      });
      loadUsers();
    } catch (error: any) {
      console.error("Failed to adjust balance:", error);
      toast.error(error.response?.data?.error || "Failed to adjust balance");
    } finally {
      setAdjustingBalance(null);
    }
  };

  const handleToggleAdmin = async (
    userId: string,
    currentAdminStatus: boolean
  ) => {
    try {
      setTogglingAdmin(userId);
      await toggleUserAdmin(userId, !currentAdminStatus);
      toast.success(
        !currentAdminStatus
          ? "User granted admin privileges"
          : "Admin privileges removed"
      );
      loadUsers();
    } catch (error: any) {
      console.error("Failed to toggle admin:", error);
      toast.error(
        error.response?.data?.error || "Failed to update admin status"
      );
    } finally {
      setTogglingAdmin(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Manage Users</h1>
        <div className="text-sm text-gray-400">
          Total: {pagination.total.toLocaleString()} users
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="btn btn-secondary"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No users found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      User
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      Wallet
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      USDC Balance
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      SOL Balance
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      Created
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      Admin
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-dark-700 hover:bg-dark-800 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-white font-medium">
                            {user.display_name || user.username}
                          </div>
                          <div className="text-xs text-gray-400">
                            @{user.username}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300 text-sm">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        {user.wallet_public_key ? (
                          <span className="font-mono text-xs text-gray-400">
                            {shortenAddress(user.wallet_public_key, 6)}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">
                            No wallet
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {formatUSDC(user.balance_usdc)}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {(user.balance_sol / 1_000_000_000).toFixed(4)} SOL
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(
                          typeof user.created_at === "string" &&
                          user.created_at.includes(" ")
                            ? user.created_at.replace(" ", "T")
                            : user.created_at
                        ).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {user.is_admin ? (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-medium">
                            Admin
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">User</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-3">
                          <button
                            onClick={() =>
                              handleToggleAdmin(user.id, user.is_admin || false)
                            }
                            disabled={togglingAdmin === user.id}
                            className={`text-sm font-medium ${
                              user.is_admin
                                ? "text-yellow-400 hover:text-yellow-300"
                                : "text-purple-400 hover:text-purple-300"
                            } disabled:opacity-50`}
                          >
                            {togglingAdmin === user.id
                              ? "Updating..."
                              : user.is_admin
                              ? "Remove Admin"
                              : "Make Admin"}
                          </button>
                          <button
                            onClick={() =>
                              setAdjustForm({
                                userId: user.id,
                                amount: "",
                                token: "USDC",
                                reason: "",
                              })
                            }
                            className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                          >
                            Adjust Balance
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-dark-700">
                <div className="text-sm text-gray-400">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(prev.totalPages, prev.page + 1),
                      }))
                    }
                    disabled={!pagination.hasMore}
                    className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Adjust Balance Modal */}
      {adjustForm.userId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">
              Adjust User Balance
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Token
                </label>
                <select
                  value={adjustForm.token}
                  onChange={(e) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      token: e.target.value as "SOL" | "USDC",
                    }))
                  }
                  className="input w-full"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (use negative for deduction)
                </label>
                <input
                  type="number"
                  step={adjustForm.token === "USDC" ? "0.01" : "0.000001"}
                  value={adjustForm.amount}
                  onChange={(e) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  placeholder={
                    adjustForm.token === "USDC"
                      ? "Amount in USDC (e.g., 1000)"
                      : "Amount in SOL"
                  }
                  className="input w-full"
                />
                {adjustForm.token === "USDC" && (
                  <p className="text-xs text-gray-500 mt-1">
                    Enter amount in regular USDC (will be converted to
                    micro-USDC)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Reason for adjustment"
                  className="input w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() =>
                  setAdjustForm({
                    userId: null,
                    amount: "",
                    token: "USDC",
                    reason: "",
                  })
                }
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={adjustingBalance === adjustForm.userId}
                className="btn btn-primary flex-1"
              >
                {adjustingBalance === adjustForm.userId
                  ? "Processing..."
                  : "Adjust"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
