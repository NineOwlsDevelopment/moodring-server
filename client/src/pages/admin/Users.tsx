import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { shortenAddress } from "@/utils/format";
import { formatUSDC } from "@/utils/format";
import {
  fetchAdminUsers,
  adjustUserBalance,
  toggleUserAdmin,
  AdminUser,
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
              Manage Users
            </h1>
          </div>
          <div className="text-xs sm:text-sm text-moon-grey/50">
            {pagination.total.toLocaleString()} users
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-5 mb-4 sm:mb-6"
        >
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300"
              >
                Search
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </motion.div>

        {/* Users List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-graphite-deep/30 border border-white/5"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 text-moon-grey/40 text-sm">
              No users found
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        User
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        Email
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        Wallet
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        USDC
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        SOL
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        Created
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        Role
                      </th>
                      <th className="text-left py-4 px-5 text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-4 px-5">
                          <div>
                            <div className="text-white font-light text-sm">
                              {user.display_name || user.username}
                            </div>
                            <div className="text-[10px] text-moon-grey/40">
                              @{user.username}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-moon-grey/60 text-sm font-light">
                          {user.email}
                        </td>
                        <td className="py-4 px-5">
                          {user.wallet_public_key ? (
                            <code className="font-mono text-[10px] text-moon-grey/40">
                              {shortenAddress(user.wallet_public_key, 6)}
                            </code>
                          ) : (
                            <span className="text-moon-grey/30 text-[10px]">
                              No wallet
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-moon-grey/60 text-sm font-light tabular-nums">
                          {formatUSDC(user.balance_usdc)}
                        </td>
                        <td className="py-4 px-5 text-moon-grey/60 text-sm font-light tabular-nums">
                          {(user.balance_sol / 1_000_000_000).toFixed(4)} SOL
                        </td>
                        <td className="py-4 px-5 text-moon-grey/40 text-sm font-light">
                          {new Date(
                            typeof user.created_at === "string" &&
                            user.created_at.includes(" ")
                              ? user.created_at.replace(" ", "T")
                              : user.created_at
                          ).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-5">
                          {user.is_admin ? (
                            <span className="px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase text-neon-iris border border-neon-iris/30">
                              Admin
                            </span>
                          ) : (
                            <span className="text-moon-grey/40 text-[10px] tracking-[0.1em] uppercase">
                              User
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex gap-4">
                            <button
                              onClick={() =>
                                handleToggleAdmin(user.id, user.is_admin || false)
                              }
                              disabled={togglingAdmin === user.id}
                              className={`text-[10px] tracking-[0.1em] uppercase font-medium transition-colors disabled:opacity-50 ${
                                user.is_admin
                                  ? "text-amber-400 hover:text-amber-300"
                                  : "text-neon-iris hover:text-neon-iris/80"
                              }`}
                            >
                              {togglingAdmin === user.id
                                ? "..."
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
                              className="text-[10px] tracking-[0.1em] uppercase text-neon-iris hover:text-neon-iris/80 font-medium transition-colors"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-white/5">
                {users.map((user) => {
                  const isExpanded = expandedUserId === user.id;
                  return (
                    <div key={user.id} className="p-4">
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() =>
                          setExpandedUserId(isExpanded ? null : user.id)
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-light text-sm truncate">
                              {user.display_name || user.username}
                            </span>
                            {user.is_admin && (
                              <span className="px-1.5 py-0.5 text-[9px] tracking-[0.1em] uppercase text-neon-iris border border-neon-iris/30">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-moon-grey/40 mt-0.5">
                            @{user.username}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white font-light tabular-nums">
                            {formatUSDC(user.balance_usdc)}
                          </div>
                          <span
                            className={`text-moon-grey/40 transition-transform duration-200 inline-block ${
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
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="text-moon-grey/40">Email</span>
                                  <div className="text-white font-light truncate">
                                    {user.email}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-moon-grey/40">SOL</span>
                                  <div className="text-white font-light tabular-nums">
                                    {(user.balance_sol / 1_000_000_000).toFixed(4)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-moon-grey/40">Wallet</span>
                                  <div className="text-moon-grey/60 font-mono text-[10px]">
                                    {user.wallet_public_key
                                      ? shortenAddress(user.wallet_public_key, 6)
                                      : "No wallet"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-moon-grey/40">Created</span>
                                  <div className="text-white font-light">
                                    {new Date(
                                      typeof user.created_at === "string" &&
                                      user.created_at.includes(" ")
                                        ? user.created_at.replace(" ", "T")
                                        : user.created_at
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAdmin(user.id, user.is_admin || false);
                                  }}
                                  disabled={togglingAdmin === user.id}
                                  className={`flex-1 py-2 text-[10px] tracking-wide uppercase font-medium border transition-all disabled:opacity-50 ${
                                    user.is_admin
                                      ? "text-amber-400 border-amber-400/30"
                                      : "text-neon-iris border-neon-iris/30"
                                  }`}
                                >
                                  {togglingAdmin === user.id
                                    ? "..."
                                    : user.is_admin
                                    ? "Remove Admin"
                                    : "Make Admin"}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAdjustForm({
                                      userId: user.id,
                                      amount: "",
                                      token: "USDC",
                                      reason: "",
                                    });
                                  }}
                                  className="flex-1 py-2 text-[10px] tracking-wide uppercase font-medium text-white border border-white/20"
                                >
                                  Adjust Balance
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-5 py-4 border-t border-white/5">
                  <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
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
                      className="px-3 sm:px-4 py-2 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 disabled:opacity-30"
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
                      className="px-3 sm:px-4 py-2 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Adjust Balance Modal */}
        {adjustForm.userId && (
          <div
            className="fixed inset-0 bg-ink-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() =>
              setAdjustForm({
                userId: null,
                amount: "",
                token: "USDC",
                reason: "",
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
                Adjust User Balance
              </h2>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
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
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-neon-iris/50 transition-colors"
                  >
                    <option value="USDC">USDC</option>
                    <option value="SOL">SOL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                    Amount (negative for deduction)
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
                        ? "Amount in USDC"
                        : "Amount in SOL"
                    }
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
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
                    className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5 sm:mt-6">
                <button
                  onClick={() =>
                    setAdjustForm({
                      userId: null,
                      amount: "",
                      token: "USDC",
                      reason: "",
                    })
                  }
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustBalance}
                  disabled={adjustingBalance === adjustForm.userId}
                  className="flex-1 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                >
                  {adjustingBalance === adjustForm.userId
                    ? "Processing..."
                    : "Adjust"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
