import { useEffect, useState } from "react";
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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <div className="flex gap-3">
          <button
            onClick={handleTogglePauseTrading}
            disabled={updatingPause}
            className={`btn text-sm ${
              pauseTrading ? "btn-danger" : "btn-secondary"
            }`}
          >
            {updatingPause
              ? "Updating..."
              : pauseTrading
              ? "Resume Trading"
              : "Pause Trading"}
          </button>
          <button
            onClick={loadDashboardData}
            className="btn btn-secondary text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          to="/admin/markets"
          className="card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer"
        >
          <div className="text-sm text-gray-400 mb-1">Manage Markets</div>
          <div className="text-lg font-semibold text-white">
            Resolve & Configure
          </div>
          <div className="text-xs text-gray-500 mt-1">
            View and manage all markets
          </div>
        </Link>

        <Link
          to="/admin/users"
          className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 hover:border-green-500/40 transition-colors cursor-pointer"
        >
          <div className="text-sm text-gray-400 mb-1">User Management</div>
          <div className="text-lg font-semibold text-white">
            Adjust Balances
          </div>
          <div className="text-xs text-gray-500 mt-1">Manage user accounts</div>
        </Link>

        <Link
          to="/admin/withdrawals"
          className="card bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 hover:border-yellow-500/40 transition-colors cursor-pointer"
        >
          <div className="text-sm text-gray-400 mb-1">Withdrawals</div>
          <div className="text-lg font-semibold text-yellow-400">
            {pendingWithdrawals} Pending
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Process withdrawal requests
          </div>
        </Link>

        <Link
          to="/admin/settings"
          className="card bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40 transition-colors cursor-pointer"
        >
          <div className="text-sm text-gray-400 mb-1">Platform Settings</div>
          <div className="text-lg font-semibold text-white">Configure</div>
          <div className="text-xs text-gray-500 mt-1">
            Update platform settings
          </div>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-primary-500/10 to-primary-600/5 border-primary-500/20">
          <div className="text-sm text-gray-400 mb-1">Total Volume</div>
          <div className="text-2xl font-bold text-white">
            {stats ? formatUSDC(stats.trades.total_volume) : "$0"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            24h: {stats ? formatUSDC(stats.trades.volume_24h) : "$0"}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="text-sm text-gray-400 mb-1">Active Markets</div>
          <div className="text-2xl font-bold text-white">
            {stats?.markets.active ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats?.markets.total ?? 0} total, {stats?.markets.resolved ?? 0}{" "}
            resolved
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="text-sm text-gray-400 mb-1">Total Users</div>
          <div className="text-2xl font-bold text-white">
            {stats?.users.total.toLocaleString() ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            +{stats?.users.new_24h ?? 0} today, +{stats?.users.new_7d ?? 0} this
            week
          </div>
        </div>

        <div className="card bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <div className="text-sm text-gray-400 mb-1">Pending Withdrawals</div>
          <div className="text-2xl font-bold text-yellow-400">
            {pendingWithdrawals}
          </div>
          <div className="text-xs text-gray-500 mt-1">Requires attention</div>
        </div>
      </div>

      {/* Trading Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            Trading Activity
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Trades</span>
              <span className="text-white font-semibold">
                {stats?.trades.total.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Trades (24h)</span>
              <span className="text-white font-semibold">
                {stats?.trades.trades_24h.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Volume</span>
              <span className="text-white font-semibold">
                {stats ? formatUSDC(stats.trades.total_volume) : "$0"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Volume (24h)</span>
              <span className="text-white font-semibold">
                {stats ? formatUSDC(stats.trades.volume_24h) : "$0"}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            Protocol Fees
          </h2>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Current Balance</span>
              <span className="text-white font-semibold">
                {fees ? formatUSDC(fees.protocol_fees.current_balance) : "$0"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Lifetime Earned</span>
              <span className="text-white font-semibold">
                {fees ? formatUSDC(fees.protocol_fees.lifetime_earned) : "$0"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Withdrawn</span>
              <span className="text-white font-semibold">
                {fees ? formatUSDC(fees.protocol_fees.total_withdrawn) : "$0"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Creator Fees</span>
              <span className="text-white font-semibold">
                {fees ? formatUSDC(fees.other_fees.creator_fees) : "$0"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">LP Fees</span>
              <span className="text-white font-semibold">
                {fees ? formatUSDC(fees.other_fees.lp_fees) : "$0"}
              </span>
            </div>
          </div>
          {fees && fees.protocol_fees.current_balance > 0 && (
            <div className="pt-4 border-t border-dark-700">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount (leave empty for all)"
                  className="input flex-1"
                />
                <button
                  onClick={handleWithdrawFees}
                  disabled={withdrawing}
                  className="btn btn-primary"
                >
                  {withdrawing ? "Withdrawing..." : "Withdraw"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Leave amount empty to withdraw all available fees
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hot Wallet Status */}
      {hotWallet && hotWallet.status === "operational" && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Hot Wallet Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Balances
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">USDC</span>
                  <span className="text-white font-semibold">
                    {hotWallet.balances?.usdc_formatted ?? "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">SOL</span>
                  <span className="text-white font-semibold">
                    {hotWallet.balances?.sol_formatted ?? "N/A"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Liabilities
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Total USDC Liability</span>
                  <span className="text-white font-semibold">
                    {hotWallet.liabilities?.total_usdc_formatted ?? "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Total Wallets</span>
                  <span className="text-white font-semibold">
                    {hotWallet.liabilities?.total_wallets ?? 0}
                  </span>
                </div>
                {hotWallet.reserve_ratio && (
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-dark-700">
                    <span className="text-gray-300">Reserve Ratio</span>
                    <span
                      className={`font-semibold ${
                        hotWallet.reserve_ratio.status === "healthy"
                          ? "text-green-400"
                          : hotWallet.reserve_ratio.status === "warning"
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {hotWallet.reserve_ratio.usdc}% (
                      {hotWallet.reserve_ratio.status})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {hotWallet.address && (
            <div className="mt-4 pt-4 border-t border-dark-700">
              <span className="text-xs text-gray-500 font-mono">
                {hotWallet.address}
              </span>
            </div>
          )}

          {/* Cold Storage Withdrawal */}
          <div className="mt-6 pt-6 border-t border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Withdraw to Cold Storage
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Passcode
                </label>
                <input
                  type="password"
                  value={coldStoragePasscode}
                  onChange={(e) => setColdStoragePasscode(e.target.value)}
                  placeholder="Enter HIGH_ORDER_TX_PW passcode"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={coldStorageAmount}
                  onChange={(e) => setColdStorageAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  min="0.01"
                  className="input w-full"
                />
                {hotWallet.balances?.usdc && (
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {hotWallet.balances.usdc_formatted}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cold Storage Address
                </label>
                <input
                  type="text"
                  value={coldStorageAddress}
                  onChange={(e) => setColdStorageAddress(e.target.value)}
                  placeholder="Enter Solana address"
                  className="input w-full font-mono text-sm"
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
                className="btn btn-danger w-full"
              >
                {withdrawingToColdStorage
                  ? "Withdrawing..."
                  : "Withdraw to Cold Storage"}
              </button>
              <p className="text-xs text-gray-500">
                ⚠️ This action requires the HIGH_ORDER_TX_PW passcode and will
                transfer funds from the hot wallet to cold storage. This action
                cannot be undone.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Market Stats */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">
          Market Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Markets</div>
            <div className="text-2xl font-bold text-white">
              {stats?.markets.total ?? 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Active</div>
            <div className="text-2xl font-bold text-blue-400">
              {stats?.markets.active ?? 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Resolved</div>
            <div className="text-2xl font-bold text-green-400">
              {stats?.markets.resolved ?? 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Featured</div>
            <div className="text-2xl font-bold text-purple-400">
              {stats?.markets.featured ?? 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
