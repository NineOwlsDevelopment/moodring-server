import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatUSDC } from "@/utils/format";
import { Link } from "react-router-dom";
import {
  fetchAdminStats,
  fetchProtocolFees,
  fetchHotWalletStatus,
  fetchPendingWithdrawals,
  withdrawProtocolFees,
  withdrawToColdStorage,
  fetchPauseFlags,
  updatePauseFlags,
  AdminStats,
  ProtocolFees,
  HotWalletStatus,
} from "@/api/api";
import { toast } from "sonner";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fees, setFees] = useState<ProtocolFees | null>(null);
  const [hotWallet, setHotWallet] = useState<HotWalletStatus | null>(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pauseTrading, setPauseTrading] = useState(false);
  const [updatingPause, setUpdatingPause] = useState(false);
  const [coldStoragePasscode, setColdStoragePasscode] = useState("");
  const [coldStorageAmount, setColdStorageAmount] = useState("");
  const [coldStorageAddress, setColdStorageAddress] = useState("");
  const [withdrawingToColdStorage, setWithdrawingToColdStorage] =
    useState(false);
  const [showColdStorage, setShowColdStorage] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, feesData, walletData, withdrawalsData, pauseData] =
        await Promise.all([
          fetchAdminStats(),
          fetchProtocolFees(),
          fetchHotWalletStatus(),
          fetchPendingWithdrawals(),
          fetchPauseFlags(),
        ]);

      setStats(statsData);
      setFees(feesData);
      setHotWallet(walletData);
      setPendingWithdrawals(withdrawalsData.withdrawals.length);
      setPauseTrading(pauseData.flags.pause_trading);
    } catch (error: any) {
      console.error("Failed to load dashboard data:", error);
      toast.error(
        error.response?.data?.error || "Failed to load dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePauseTrading = async () => {
    try {
      setUpdatingPause(true);
      await updatePauseFlags({ pause_trading: !pauseTrading });
      setPauseTrading(!pauseTrading);
      toast.success(
        pauseTrading ? "Trading has been enabled" : "Trading has been paused"
      );
    } catch (error: any) {
      console.error("Failed to update pause flags:", error);
      toast.error(
        error.response?.data?.error || "Failed to update pause flags"
      );
    } finally {
      setUpdatingPause(false);
    }
  };

  const handleWithdrawFees = async () => {
    if (!fees) return;

    try {
      setWithdrawing(true);
      const amount = withdrawAmount ? Number(withdrawAmount) : undefined;
      await withdrawProtocolFees(amount ? { amount } : undefined);
      toast.success("Protocol fees withdrawn successfully");
      setWithdrawAmount("");
      loadDashboardData();
    } catch (error: any) {
      console.error("Failed to withdraw fees:", error);
      toast.error(error.response?.data?.error || "Failed to withdraw fees");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleWithdrawToColdStorage = async () => {
    if (!coldStoragePasscode || !coldStorageAmount || !coldStorageAddress) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setWithdrawingToColdStorage(true);
      const result = await withdrawToColdStorage({
        passcode: coldStoragePasscode,
        amount: Number(coldStorageAmount),
        destination_address: coldStorageAddress,
      });
      toast.success(
        `Successfully withdrew ${formatUSDC(result.amount)} to cold storage`
      );
      setColdStoragePasscode("");
      setColdStorageAmount("");
      setColdStorageAddress("");
      loadDashboardData();
    } catch (error: any) {
      console.error("Failed to withdraw to cold storage:", error);
      toast.error(
        error.response?.data?.error || "Failed to withdraw to cold storage"
      );
    } finally {
      setWithdrawingToColdStorage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
      </div>
    );
  }

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
          className="mb-6 sm:mb-10"
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-2 sm:mb-3">
                Administration
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extralight tracking-tight text-white">
                Dashboard
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={handleTogglePauseTrading}
                disabled={updatingPause}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs tracking-wide uppercase font-medium transition-all duration-300 ${
                  pauseTrading
                    ? "bg-rose-500/10 text-rose-400 border border-rose-400/30 hover:border-rose-400/50"
                    : "bg-transparent text-moon-grey/70 border border-white/10 hover:border-white/20 hover:text-white"
                }`}
              >
                {updatingPause
                  ? "..."
                  : pauseTrading
                  ? "Resume Trading"
                  : "Pause Trading"}
              </button>
              <button
                onClick={loadDashboardData}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs tracking-wide uppercase font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300"
              >
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-10"
        >
          {[
            {
              to: "/admin/markets",
              label: "Markets",
              sub: "Manage",
              color: "neon-iris",
            },
            {
              to: "/admin/users",
              label: "Users",
              sub: "Manage",
              color: "aqua-pulse",
            },
            {
              to: "/admin/withdrawals",
              label: "Withdrawals",
              sub: `${pendingWithdrawals} Pending`,
              color: "amber",
              highlight: pendingWithdrawals > 0,
            },
            {
              to: "/admin/settings",
              label: "Settings",
              sub: "Configure",
              color: "neon-iris",
            },
          ].map((item) => (
            <motion.div key={item.to} variants={fadeInUp}>
              <Link
                to={item.to}
                className="block bg-graphite-deep/30 border border-white/5 hover:border-white/10 p-3 sm:p-5 transition-all duration-300 group"
              >
                <div className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1 sm:mb-2 truncate">
                  {item.label}
                </div>
                <div
                  className={`text-sm sm:text-lg font-light ${
                    item.highlight ? "text-amber-400" : "text-white"
                  } group-hover:text-neon-iris transition-colors truncate`}
                >
                  {item.sub}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-10"
        >
          {[
            {
              label: "Total Volume",
              value: stats ? formatUSDC(stats.trades.total_volume) : "$0",
              sub: `24h: ${stats ? formatUSDC(stats.trades.volume_24h) : "$0"}`,
            },
            {
              label: "Active Markets",
              value: stats?.markets.active ?? 0,
              sub: `${stats?.markets.total ?? 0} total`,
            },
            {
              label: "Users",
              value: stats?.users.total.toLocaleString() ?? 0,
              sub: `+${stats?.users.new_24h ?? 0} today`,
            },
            {
              label: "Pending",
              value: pendingWithdrawals,
              sub: "Withdrawals",
              highlight: pendingWithdrawals > 0,
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeInUp}
              className="bg-ink-black border border-white/5 p-3 sm:p-5"
            >
              <div className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3 truncate">
                {stat.label}
              </div>
              <div
                className={`text-xl sm:text-2xl font-extralight ${
                  stat.highlight ? "text-amber-400" : "text-white"
                } tabular-nums mb-0.5 sm:mb-1`}
              >
                {stat.value}
              </div>
              <div className="text-[9px] sm:text-[10px] tracking-[0.1em] text-moon-grey/40 truncate">
                {stat.sub}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trading Stats & Protocol Fees */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <h2 className="text-xs sm:text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-4 sm:mb-6">
              Trading Activity
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {[
                {
                  label: "Total Trades",
                  value: stats?.trades.total.toLocaleString() ?? 0,
                },
                {
                  label: "Trades (24h)",
                  value: stats?.trades.trades_24h.toLocaleString() ?? 0,
                },
                {
                  label: "Total Volume",
                  value: stats ? formatUSDC(stats.trades.total_volume) : "$0",
                },
                {
                  label: "Volume (24h)",
                  value: stats ? formatUSDC(stats.trades.volume_24h) : "$0",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between items-center py-2 border-b border-white/5"
                >
                  <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
                    {item.label}
                  </span>
                  <span className="text-xs sm:text-sm text-white font-light tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <h2 className="text-xs sm:text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-4 sm:mb-6">
              Protocol Fees
            </h2>
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {[
                {
                  label: "Balance",
                  value: fees
                    ? formatUSDC(fees.protocol_fees.current_balance)
                    : "$0",
                },
                {
                  label: "Lifetime",
                  value: fees
                    ? formatUSDC(fees.protocol_fees.lifetime_earned)
                    : "$0",
                },
                {
                  label: "Withdrawn",
                  value: fees
                    ? formatUSDC(fees.protocol_fees.total_withdrawn)
                    : "$0",
                },
                {
                  label: "Creator Fees",
                  value: fees
                    ? formatUSDC(fees.other_fees.creator_fees)
                    : "$0",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between items-center py-2 border-b border-white/5"
                >
                  <span className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/50">
                    {item.label}
                  </span>
                  <span className="text-xs sm:text-sm text-white font-light tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            {fees && fees.protocol_fees.current_balance > 0 && (
              <div className="pt-4 border-t border-white/5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Amount (empty = all)"
                    className="flex-1 bg-ink-black border border-white/10 px-3 py-2.5 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                  />
                  <button
                    onClick={handleWithdrawFees}
                    disabled={withdrawing}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                  >
                    {withdrawing ? "..." : "Withdraw"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Hot Wallet Status */}
        {hotWallet && hotWallet.status === "operational" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6 mb-6 sm:mb-10"
          >
            <h2 className="text-xs sm:text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-4 sm:mb-6">
              Hot Wallet Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              <div>
                <h3 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-3 sm:mb-4">
                  Balances
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-moon-grey/60 text-xs sm:text-sm">
                      USDC
                    </span>
                    <span className="text-white font-light tabular-nums text-xs sm:text-sm">
                      {hotWallet.balances?.usdc_formatted ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-moon-grey/60 text-xs sm:text-sm">
                      SOL
                    </span>
                    <span className="text-white font-light tabular-nums text-xs sm:text-sm">
                      {hotWallet.balances?.sol_formatted ?? "N/A"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-3 sm:mb-4">
                  Liabilities
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-moon-grey/60 text-xs sm:text-sm">
                      USDC Liability
                    </span>
                    <span className="text-white font-light tabular-nums text-xs sm:text-sm">
                      {hotWallet.liabilities?.total_usdc_formatted ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-moon-grey/60 text-xs sm:text-sm">
                      Wallets
                    </span>
                    <span className="text-white font-light tabular-nums text-xs sm:text-sm">
                      {hotWallet.liabilities?.total_wallets ?? 0}
                    </span>
                  </div>
                  {hotWallet.reserve_ratio && (
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-moon-grey/60 text-xs sm:text-sm">
                        Reserve
                      </span>
                      <span
                        className={`font-medium text-xs sm:text-sm ${
                          hotWallet.reserve_ratio.status === "healthy"
                            ? "text-aqua-pulse"
                            : hotWallet.reserve_ratio.status === "warning"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {hotWallet.reserve_ratio.usdc}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            {hotWallet.address && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/5">
                <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                  Wallet Address
                </div>
                <code className="text-[10px] sm:text-xs text-moon-grey/60 font-mono break-all">
                  {hotWallet.address}
                </code>
              </div>
            )}

            {/* Cold Storage Withdrawal - Collapsible on mobile */}
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5">
              <button
                onClick={() => setShowColdStorage(!showColdStorage)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-xs sm:text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                  Withdraw to Cold Storage
                </h3>
                <span
                  className={`text-moon-grey/40 transition-transform duration-200 ${
                    showColdStorage ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              <AnimatePresence>
                {showColdStorage && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-6">
                      <div>
                        <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                          Passcode
                        </label>
                        <input
                          type="password"
                          value={coldStoragePasscode}
                          onChange={(e) =>
                            setColdStoragePasscode(e.target.value)
                          }
                          placeholder="Enter HIGH_ORDER_TX_PW passcode"
                          className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                          Amount (USDC)
                        </label>
                        <input
                          type="number"
                          value={coldStorageAmount}
                          onChange={(e) => setColdStorageAmount(e.target.value)}
                          placeholder="0.00"
                          step="0.000001"
                          min="0.01"
                          className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                        />
                        {hotWallet.balances?.usdc && (
                          <p className="text-[10px] text-moon-grey/40 mt-1">
                            Available: {hotWallet.balances.usdc_formatted}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2">
                          Cold Storage Address
                        </label>
                        <input
                          type="text"
                          value={coldStorageAddress}
                          onChange={(e) =>
                            setColdStorageAddress(e.target.value)
                          }
                          placeholder="Enter Solana address"
                          className="w-full bg-ink-black border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-mono text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                        />
                      </div>
                      <button
                        onClick={handleWithdrawToColdStorage}
                        disabled={
                          withdrawingToColdStorage ||
                          !coldStoragePasscode ||
                          !coldStorageAmount ||
                          !coldStorageAddress
                        }
                        className="w-full py-2.5 sm:py-3 text-xs sm:text-sm tracking-wide uppercase font-medium text-rose-400 border border-rose-400/30 hover:border-rose-400/50 hover:bg-rose-400/5 transition-all duration-300 disabled:opacity-50"
                      >
                        {withdrawingToColdStorage
                          ? "Withdrawing..."
                          : "Withdraw to Cold Storage"}
                      </button>
                      <p className="text-[10px] text-moon-grey/40">
                        ⚠️ This action requires the HIGH_ORDER_TX_PW passcode
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Market Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
        >
          <h2 className="text-xs sm:text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-4 sm:mb-6">
            Market Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                label: "Total",
                value: stats?.markets.total ?? 0,
                color: "text-white",
              },
              {
                label: "Active",
                value: stats?.markets.active ?? 0,
                color: "text-neon-iris",
              },
              {
                label: "Resolved",
                value: stats?.markets.resolved ?? 0,
                color: "text-aqua-pulse",
              },
              {
                label: "Featured",
                value: stats?.markets.featured ?? 0,
                color: "text-amber-400",
              },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-1 sm:mb-2">
                  {stat.label}
                </div>
                <div
                  className={`text-xl sm:text-2xl font-extralight ${stat.color} tabular-nums`}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Additional Admin Links - Mobile friendly */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3"
        >
          {[
            { to: "/admin/disputes", label: "Disputes" },
            { to: "/admin/suspicious-trades", label: "Suspicious" },
            { to: "/admin/markets", label: "Markets" },
            { to: "/admin/users", label: "Users" },
            { to: "/admin/withdrawals", label: "Withdrawals" },
            { to: "/admin/settings", label: "Settings" },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block p-3 sm:p-4 text-center bg-ink-black border border-white/5 hover:border-white/10 transition-all duration-300"
            >
              <span className="text-[10px] sm:text-xs tracking-wide uppercase text-moon-grey/60 hover:text-white transition-colors">
                {link.label}
              </span>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
