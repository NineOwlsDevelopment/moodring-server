import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PriceHistoryPoint } from "@/types/market";
import { formatProbability, formatShortDate } from "@/utils/format";

interface MarketChartProps {
  priceHistory: PriceHistoryPoint[];
  createdAt?: Date;
}

type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";

const getDefaultTimeRange = (createdAt?: Date): TimeRange => {
  if (!createdAt) return "24h";

  const now = new Date();
  const ageInMs = now.getTime() - createdAt.getTime();
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

  if (ageInDays <= 1) return "1h";
  if (ageInDays <= 7) return "24h";
  if (ageInDays <= 30) return "7d";
  if (ageInDays <= 45) return "30d";
  return "all";
};

export const MarketChart = ({ priceHistory, createdAt }: MarketChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    getDefaultTimeRange(createdAt)
  );
  const [showVolume, setShowVolume] = useState(false);

  const filteredData = useMemo(() => {
    if (timeRange === "all") return priceHistory;

    const cutoffDate = new Date();
    switch (timeRange) {
      case "1h":
        cutoffDate.setHours(cutoffDate.getHours() - 1);
        break;
      case "24h":
        cutoffDate.setHours(cutoffDate.getHours() - 24);
        break;
      case "7d":
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case "30d":
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        break;
    }

    return priceHistory.filter((point) => point.timestamp >= cutoffDate);
  }, [priceHistory, timeRange]);

  const chartData = useMemo(() => {
    return filteredData.map((point) => ({
      date: point.timestamp.getTime(),
      YES: (point.yesPrice * 100).toFixed(1),
      NO: (point.noPrice * 100).toFixed(1),
      volume: point.volume,
    }));
  }, [filteredData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-900 p-3 rounded-lg shadow-lg border border-dark-700">
          <p className="text-sm text-gray-400 mb-2">
            {formatShortDate(new Date(label))}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-success-400">YES:</span>
              <span className="text-sm font-bold text-success-300">
                {payload[0].value}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-danger-400">NO:</span>
              <span className="text-sm font-bold text-danger-300">
                {payload[1].value}%
              </span>
            </div>
            {showVolume && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-dark-700">
                <span className="text-xs text-gray-400">Volume:</span>
                <span className="text-xs font-medium text-gray-300">
                  {payload[0].payload.volume.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Price History</h2>
        <div className="flex items-center gap-4">
          {/* Volume Toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
              showVolume
                ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                : "bg-dark-800 text-gray-400 hover:bg-dark-700 border border-dark-700"
            }`}
          >
            Volume
          </button>

          {/* Time Range Buttons */}
          <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1 border border-dark-700">
            {(["1h", "24h", "7d", "30d", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {range === "all" ? "All" : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="date"
              tickFormatter={(timestamp) =>
                formatShortDate(new Date(timestamp))
              }
              stroke="#6d6d6d"
              style={{ fontSize: "12px", fill: "#9ca3af" }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="#6d6d6d"
              style={{ fontSize: "12px", fill: "#9ca3af" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "14px", paddingTop: "20px" }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="YES"
              stroke="#c084fc"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              name="YES Price"
            />
            <Line
              type="monotone"
              dataKey="NO"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              name="NO Price"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Below Chart */}
      {filteredData.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-dark-800">
          <div>
            <div className="text-xs text-gray-400 mb-1">Change (Period)</div>
            <div
              className={`text-lg font-bold ${
                filteredData[filteredData.length - 1].yesPrice >
                filteredData[0].yesPrice
                  ? "text-success-400"
                  : "text-danger-400"
              }`}
            >
              {(
                ((filteredData[filteredData.length - 1].yesPrice -
                  filteredData[0].yesPrice) /
                  filteredData[0].yesPrice) *
                100
              ).toFixed(1)}
              %
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">High</div>
            <div className="text-lg font-bold text-white">
              {formatProbability(
                Math.max(...filteredData.map((d) => d.yesPrice))
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Low</div>
            <div className="text-lg font-bold text-white">
              {formatProbability(
                Math.min(...filteredData.map((d) => d.yesPrice))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
