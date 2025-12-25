import { useState, useEffect } from "react";
import { formatUSDC } from "@/utils/format";
import { Market } from "@/types/market";
import {
  fetchMarkets,
  submitResolution,
  toggleMarketFeatured,
  toggleMarketVerified,
} from "@/api/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export const AdminMarkets = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resolvingMarketId, setResolvingMarketId] = useState<string | null>(
    null
  );
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [winningSide, setWinningSide] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadMarkets();
  }, [page]);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetchMarkets({
        page,
        limit: 50,
        sort: "created_at",
        order: "desc",
      });
      setMarkets(response.markets || []);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error: any) {
      console.error("Failed to load markets:", error);
      toast.error(error.response?.data?.error || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedMarket || !selectedOption) return;

    try {
      setResolvingMarketId(selectedMarket.id);
      await submitResolution({
        marketId: selectedMarket.id,
        optionId: selectedOption.id,
        outcome: selectedOption.option_label,
        winningSide,
        evidence: reason.trim() ? { notes: reason.trim() } : undefined,
      });
      toast.success("Market option resolved successfully");
      setShowResolveModal(false);
      setReason("");
      setSelectedMarket(null);
      setSelectedOption(null);
      loadMarkets();
    } catch (error: any) {
      console.error("Failed to resolve market:", error);
      toast.error(
        error.response?.data?.error || "Failed to resolve market option"
      );
    } finally {
      setResolvingMarketId(null);
    }
  };

  const handleToggleFeatured = async (market: Market) => {
    try {
      await toggleMarketFeatured(market.id, {
        is_featured: !(market as any).is_featured,
      });
      toast.success(
        (market as any).is_featured
          ? "Market unfeatured"
          : "Market featured successfully"
      );
      loadMarkets();
    } catch (error: any) {
      console.error("Failed to toggle featured:", error);
      toast.error(error.response?.data?.error || "Failed to update market");
    }
  };

  const handleToggleVerified = async (market: Market) => {
    try {
      await toggleMarketVerified(market.id, {
        is_verified: !(market as any).is_verified,
      });
      toast.success(
        (market as any).is_verified
          ? "Market unverified"
          : "Market verified successfully"
      );
      loadMarkets();
    } catch (error: any) {
      console.error("Failed to toggle verified:", error);
      toast.error(error.response?.data?.error || "Failed to update market");
    }
  };

  const openResolveModal = (market: Market, option: any) => {
    setSelectedMarket(market);
    setSelectedOption(option);
    setWinningSide(1);
    setReason("");
    setShowResolveModal(true);
  };

  if (loading && markets.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Manage Markets</h1>
        <button onClick={loadMarkets} className="btn btn-secondary text-sm">
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-300">
                  Market
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">
                  Options
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">
                  Volume
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">
                  Flags
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {markets.length > 0 ? (
                markets.map((market) => (
                  <tr
                    key={market.id}
                    className="border-b border-dark-700 hover:bg-dark-800"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">
                        {market.question}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {market.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {market.options?.map((option: any) => (
                          <div
                            key={option.id}
                            className="text-sm text-gray-300 flex items-center gap-2"
                          >
                            <span>
                              {option.text || option.label || "Option"}
                            </span>
                            {option.is_resolved ? (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded text-xs">
                                Resolved
                              </span>
                            ) : (
                              <button
                                onClick={() => openResolveModal(market, option)}
                                disabled={resolvingMarketId === market.id}
                                className="text-xs text-primary-400 hover:text-primary-300 disabled:opacity-50"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {formatUSDC(market.total_volume || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          market.is_resolved
                            ? "bg-success-500/20 text-success-300 border border-success-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {(market as any).is_resolved ? "Resolved" : "Active"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleFeatured(market)}
                          className={`text-xs px-2 py-1 rounded ${
                            (market as any).is_featured
                              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                              : "bg-gray-700 text-gray-400 border border-gray-600"
                          }`}
                        >
                          {(market as any).is_featured ? "Featured" : "Feature"}
                        </button>
                        <button
                          onClick={() => handleToggleVerified(market)}
                          className={`text-xs px-2 py-1 rounded ${
                            (market as any).is_verified
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-gray-700 text-gray-400 border border-gray-600"
                          }`}
                        >
                          {(market as any).is_verified ? "Verified" : "Verify"}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/market/${market.id}`}
                        className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-3 px-4 text-center text-gray-300"
                  >
                    No markets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-dark-700 px-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {showResolveModal && selectedMarket && selectedOption && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Resolve Market Option
            </h2>
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                <strong>Market:</strong> {selectedMarket.question}
              </p>
              <p className="text-gray-300 mb-4">
                <strong>Option:</strong>{" "}
                {selectedOption.text || selectedOption.label || "Option"}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Winning Side
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value={1}
                    checked={winningSide === 1}
                    onChange={() => setWinningSide(1)}
                    className="mr-2"
                  />
                  <span className="text-gray-300">YES</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value={2}
                    checked={winningSide === 2}
                    onChange={() => setWinningSide(2)}
                    className="mr-2"
                  />
                  <span className="text-gray-300">NO</span>
                </label>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Reason for resolution..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setSelectedMarket(null);
                  setSelectedOption(null);
                  setReason("");
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolvingMarketId === selectedMarket.id}
                className="btn btn-primary flex-1"
              >
                {resolvingMarketId === selectedMarket.id
                  ? "Resolving..."
                  : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
