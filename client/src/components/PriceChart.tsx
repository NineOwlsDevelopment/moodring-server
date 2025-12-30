import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  fetchPriceHistory,
  fetchMarketPriceHistory,
  PriceHistoryPoint,
  TimeRange,
} from "@/api/api";
import { calculateYesPrice } from "@/utils/format";
import { useOptionSocket } from "@/hooks/useSocket";
import { PriceUpdate } from "@/services/socket";
import { GradientAccent } from "./GradientAccent";
import { MarketOption } from "@/types/market";

interface PriceChartProps {
  marketId: string;
  options: MarketOption[];
  liquidityParameter: number;
  isMultipleChoice?: boolean;
  isResolved?: boolean;
  createdAt?: Date | string;
}

const getDefaultTimeRange = (createdAt?: Date | string): TimeRange => {
  if (!createdAt) return "24H";

  const now = new Date();
  let createdDate: Date;
  if (createdAt instanceof Date) {
    createdDate = createdAt;
  } else if (typeof createdAt === "string") {
    // Handle datetime string format like "2025-12-19 17:06:38.393364"
    // Replace space with 'T' to make it ISO-like for better browser compatibility
    const isoString = createdAt.trim().includes(" ")
      ? createdAt.trim().replace(" ", "T")
      : createdAt.trim();
    createdDate = new Date(isoString);
  } else {
    createdDate = new Date(createdAt);
  }

  // Check if date is valid
  if (isNaN(createdDate.getTime())) return "24H";

  const ageInMs = Math.abs(now.getTime() - createdDate.getTime());
  if (ageInMs > 7 * 24 * 60 * 60 * 1000) return "ALL";
  if (ageInMs > 24 * 60 * 60 * 1000) return "7D";
  if (ageInMs > 60 * 60 * 1000) return "24H";
  return "1H";
};

// Helper function to get cutoff time for time range
const getCutoffTime = (range: TimeRange): number => {
  const now = Date.now();
  switch (range) {
    case "1H":
      return now - 60 * 60 * 1000;
    case "24H":
      return now - 24 * 60 * 60 * 1000;
    case "7D":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30D":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "ALL":
      return now - 365 * 24 * 60 * 60 * 1000; // Default to 1 year for ALL
    default:
      return now - 7 * 24 * 60 * 60 * 1000;
  }
};

// Professional color palette inspired by Polymarket/Kalshi
const OPTION_COLORS = [
  "#21F6D2", // aqua-pulse (replacing emerald)
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#5FFAE6", // aqua-pulse-light (replacing lime)
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
];

export const PriceChart = ({
  marketId,
  options,
  liquidityParameter,
  isMultipleChoice = false,
  isResolved = false,
  createdAt,
}: PriceChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    getDefaultTimeRange(createdAt)
  );
  const [priceHistory, setPriceHistory] = useState<
    PriceHistoryPoint[] | Record<string, PriceHistoryPoint[]>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const pendingUpdates = useRef<PriceUpdate[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store current chart data for incremental updates
  const chartDataRef = useRef<any[]>([]);
  const [chartDataKey, setChartDataKey] = useState(0);

  // Get option IDs for websocket subscription
  const optionIds = useMemo(() => options.map((opt) => opt.id), [options]);

  // Handle real-time price updates from websocket - incremental updates for smooth animation
  const handlePriceUpdate = useCallback(
    (update: PriceUpdate) => {
      // Add to pending updates
      pendingUpdates.current.push(update);

      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Process updates incrementally to avoid full rerenders
      const processUpdates = () => {
        const updates = [...pendingUpdates.current];
        pendingUpdates.current = [];

        if (updates.length === 0 || !initialLoadDone.current) return;

        // Update price history state (for historical data)
        setPriceHistory((prev) => {
          if (isMultipleChoice) {
            const historyRecord = prev as Record<string, PriceHistoryPoint[]>;
            const updatedRecord = { ...historyRecord };

            updates.forEach((update) => {
              const timestamp =
                update.timestamp instanceof Date
                  ? update.timestamp.getTime()
                  : new Date(update.timestamp).getTime();

              const optionHistory = updatedRecord[update.option_id] || [];

              // Check if we already have a point at this timestamp (within 1 second)
              const existingIndex = optionHistory.findIndex(
                (p) => Math.abs(p.timestamp - timestamp) < 1000
              );

              const newPoint: PriceHistoryPoint = {
                timestamp,
                yesPrice: update.yes_price,
                noPrice: update.no_price,
              };

              if (existingIndex >= 0) {
                // Update existing point in place
                const updated = [...optionHistory];
                updated[existingIndex] = newPoint;
                updatedRecord[update.option_id] = updated;
              } else {
                // Add new point - append to end if timestamp is newer
                const lastTimestamp =
                  optionHistory.length > 0
                    ? optionHistory[optionHistory.length - 1].timestamp
                    : 0;

                if (timestamp >= lastTimestamp) {
                  updatedRecord[update.option_id] = [
                    ...optionHistory,
                    newPoint,
                  ];
                } else {
                  const sorted = [...optionHistory, newPoint].sort(
                    (a, b) => a.timestamp - b.timestamp
                  );
                  updatedRecord[update.option_id] = sorted;
                }
              }
            });

            return updatedRecord;
          } else {
            let history = prev as PriceHistoryPoint[];

            updates.forEach((update) => {
              const timestamp =
                update.timestamp instanceof Date
                  ? update.timestamp.getTime()
                  : new Date(update.timestamp).getTime();

              const existingIndex = history.findIndex(
                (p) => Math.abs(p.timestamp - timestamp) < 1000
              );

              const newPoint: PriceHistoryPoint = {
                timestamp,
                yesPrice: update.yes_price,
                noPrice: update.no_price,
              };

              if (existingIndex >= 0) {
                const updated = [...history];
                updated[existingIndex] = newPoint;
                history = updated;
              } else {
                const lastTimestamp =
                  history.length > 0
                    ? history[history.length - 1].timestamp
                    : 0;

                if (timestamp >= lastTimestamp) {
                  history = [...history, newPoint];
                } else {
                  history = [...history, newPoint].sort(
                    (a, b) => a.timestamp - b.timestamp
                  );
                }
              }
            });

            return history;
          }
        });

        // Incrementally update chart data ref for smooth rendering
        if (chartDataRef.current.length > 0) {
          let currentData = [...chartDataRef.current];
          let dataChanged = false;

          updates.forEach((update) => {
            const timestamp =
              update.timestamp instanceof Date
                ? update.timestamp.getTime()
                : new Date(update.timestamp).getTime();

            if (isMultipleChoice) {
              // For multiple choice, update the specific option's value
              const lastPoint = currentData[currentData.length - 1];
              if (
                lastPoint &&
                Math.abs(lastPoint.timestamp - timestamp) < 1000
              ) {
                // Update existing point - create new object to trigger rerender
                const updatedPoint = { ...lastPoint };
                updatedPoint[update.option_id] = update.yes_price;
                currentData = [...currentData.slice(0, -1), updatedPoint];
                dataChanged = true;
              } else {
                // Create new point with all current values
                const newPoint: any = { timestamp, volume: 0 };
                const optionsToShow = selectedOption
                  ? options.filter((o) => o.id === selectedOption)
                  : options.slice(0, 6);

                optionsToShow.forEach((opt) => {
                  if (opt.id === update.option_id) {
                    newPoint[opt.id] = update.yes_price;
                  } else {
                    // Carry forward previous value from last point
                    const prevValue = lastPoint?.[opt.id];
                    newPoint[opt.id] =
                      prevValue ??
                      (opt as any).yes_price ??
                      calculateYesPrice(
                        opt.yes_quantity,
                        opt.no_quantity,
                        liquidityParameter,
                        isResolved
                      );
                  }
                });
                currentData = [...currentData, newPoint];
                dataChanged = true;
              }
            } else {
              // Binary market: update YES/NO prices
              const lastPoint = currentData[currentData.length - 1];
              if (
                lastPoint &&
                Math.abs(lastPoint.timestamp - timestamp) < 1000
              ) {
                // Update existing point - create new object to trigger rerender
                currentData = [
                  ...currentData.slice(0, -1),
                  {
                    ...lastPoint,
                    yesPrice: update.yes_price,
                    noPrice: update.no_price,
                  },
                ];
                dataChanged = true;
              } else {
                // Append new point
                currentData = [
                  ...currentData,
                  {
                    timestamp,
                    yesPrice: update.yes_price,
                    noPrice: update.no_price,
                  },
                ];
                dataChanged = true;
              }
            }
          });

          if (dataChanged) {
            // Limit data points to prevent memory issues (keep last 1000 points)
            const cutoff = getCutoffTime(timeRange);
            if (currentData.length > 1000) {
              currentData = currentData.filter((p) => p.timestamp >= cutoff);
            }
            chartDataRef.current = currentData;

            // Trigger rerender with minimal state update
            setChartDataKey((k) => k + 1);
          }
        }
      };

      // Process updates with minimal delay for smooth animation
      if (pendingUpdates.current.length === 1) {
        processUpdates();
        updateTimeoutRef.current = setTimeout(processUpdates, 50);
      } else {
        updateTimeoutRef.current = setTimeout(processUpdates, 50);
      }
    },
    [
      isMultipleChoice,
      options,
      liquidityParameter,
      isResolved,
      timeRange,
      selectedOption,
    ]
  );

  // Subscribe to websocket price updates
  useOptionSocket(optionIds, { onPrice: handlePriceUpdate });

  // Fetch price history for charts - only on mount or when timeRange/marketId changes
  useEffect(() => {
    const loadPriceHistory = async () => {
      setIsLoading(true);
      // Reset chart data ref when loading new history
      chartDataRef.current = [];
      setChartDataKey(0);
      try {
        if (isMultipleChoice) {
          // Fetch history for all options in the market
          const { history } = await fetchMarketPriceHistory(
            marketId,
            timeRange
          );
          setPriceHistory(history);
        } else {
          // Binary market: fetch history for the first option
          const option = options[0];
          if (option) {
            const { history } = await fetchPriceHistory(option.id, timeRange);
            setPriceHistory(history);
          }
        }
        initialLoadDone.current = true;
      } catch (error) {
        console.error("Failed to load price history:", error);
        setPriceHistory(isMultipleChoice ? {} : []);
        initialLoadDone.current = true;
      } finally {
        setIsLoading(false);
      }
    };
    loadPriceHistory();
  }, [marketId, timeRange, isMultipleChoice]); // Removed 'options' from dependencies to prevent reloads

  // Reset initial load flag when market changes
  useEffect(() => {
    initialLoadDone.current = false;
    // Clear pending updates when market changes
    pendingUpdates.current = [];
    chartDataRef.current = [];
    setChartDataKey(0);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, [marketId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Build chart data from price history - use ref for incremental updates
  const chartData = useMemo(() => {
    // If we have ref data and initial load is done, use ref (for smooth updates)
    // Otherwise, build from priceHistory (initial load or time range change)
    const useRefData =
      initialLoadDone.current &&
      chartDataRef.current.length > 0 &&
      chartDataKey > 0;

    if (isMultipleChoice) {
      const historyRecord = priceHistory as Record<string, PriceHistoryPoint[]>;
      const optionsToShow = selectedOption
        ? options.filter((o) => o.id === selectedOption)
        : options.slice(0, 6);

      if (useRefData) {
        // Use ref data for smooth incremental updates
        return chartDataRef.current;
      }

      // Initial load: build from price history
      const allTimestamps = new Set<number>();
      optionsToShow.forEach((opt) => {
        const optHistory = historyRecord[opt.id] || [];
        optHistory.forEach((p) => allTimestamps.add(p.timestamp));
      });

      if (allTimestamps.size === 0) {
        const now = Date.now();
        const cutoff = getCutoffTime(timeRange);
        const interval = (now - cutoff) / 20;

        const data = Array.from({ length: 20 }, (_, i) => {
          const point: any = {
            timestamp: cutoff + interval * i,
          };
          optionsToShow.forEach((opt) => {
            const price =
              (opt as any).yes_price ??
              calculateYesPrice(
                opt.yes_quantity,
                opt.no_quantity,
                liquidityParameter,
                isResolved
              );
            point[opt.id] = price;
          });
          return point;
        });
        chartDataRef.current = data;
        return data;
      }

      const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
      const lastPrices: Record<string, number> = {};

      optionsToShow.forEach((opt) => {
        lastPrices[opt.id] =
          (opt as any).yes_price ??
          calculateYesPrice(
            opt.yes_quantity,
            opt.no_quantity,
            liquidityParameter,
            isResolved
          );
      });

      const data = sortedTimestamps.map((ts) => {
        const point: any = { timestamp: ts, volume: 0 };
        optionsToShow.forEach((opt) => {
          const optHistory = historyRecord[opt.id] || [];
          const historyPoint = optHistory.find((p) => p.timestamp === ts);
          if (historyPoint) {
            point[opt.id] = historyPoint.yesPrice;
            lastPrices[opt.id] = historyPoint.yesPrice;
          } else {
            point[opt.id] = lastPrices[opt.id];
          }
        });
        return point;
      });
      chartDataRef.current = data;
      return data;
    } else {
      // Binary market
      const history = priceHistory as PriceHistoryPoint[];
      const option = options[0];
      if (!option) return [];

      const currentYesPrice =
        (option as any).yes_price ??
        calculateYesPrice(
          option.yes_quantity,
          option.no_quantity,
          liquidityParameter,
          isResolved
        );

      if (useRefData) {
        // Use ref data for smooth incremental updates
        return chartDataRef.current;
      }

      // Initial load: build from price history
      if (!history || history.length === 0) {
        const now = Date.now();
        const cutoff = getCutoffTime(timeRange);
        const interval = (now - cutoff) / 30;

        const data = Array.from({ length: 31 }, (_, i) => ({
          timestamp: cutoff + interval * i,
          yesPrice: currentYesPrice,
          noPrice: 1 - currentYesPrice,
        }));
        chartDataRef.current = data;
        return data;
      }

      const dataPoints = history.map((point) => ({
        timestamp: point.timestamp,
        yesPrice: point.yesPrice,
        noPrice: point.noPrice,
      }));

      const lastPoint = dataPoints[dataPoints.length - 1];
      if (!lastPoint || Date.now() - lastPoint.timestamp > 60000) {
        dataPoints.push({
          timestamp: Date.now(),
          yesPrice: currentYesPrice,
          noPrice: 1 - currentYesPrice,
        });
      }

      chartDataRef.current = dataPoints;
      return dataPoints;
    }
  }, [
    priceHistory,
    options,
    liquidityParameter,
    timeRange,
    isMultipleChoice,
    selectedOption,
    isResolved,
    chartDataKey, // Include key to trigger update when ref changes
  ]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      return (
        <div className="bg-black/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl border border-white/10 min-w-[180px]">
          <p className="text-xs text-white/70 mb-3 font-medium border-b border-white/10 pb-2">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              ...(timeRange === "1H" || timeRange === "24H"
                ? {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                : {}),
            })}
          </p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => {
              // For binary markets, show YES/NO labels
              let label = entry.dataKey;
              if (!isMultipleChoice) {
                label = entry.dataKey === "yesPrice" ? "YES" : "NO";
              } else {
                label =
                  options.find((o) => o.id === entry.dataKey)?.option_label?.slice(0, 20) || entry.dataKey;
              }
              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-white/90 font-medium">
                      {label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {(entry.value * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (timeRange === "1H") {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (timeRange === "24H") {
      if (diffDays === 0) {
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    } else if (timeRange === "7D") {
      if (diffDays === 0) {
        return "Today";
      } else if (diffDays === 1) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const primaryOption = options[0];
  const primaryPrice = primaryOption
    ? (primaryOption as any).yes_price ??
      calculateYesPrice(
        primaryOption.yes_quantity,
        primaryOption.no_quantity,
        liquidityParameter,
        isResolved
      )
    : 0.5;

  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return 0;
    const firstPrice = isMultipleChoice
      ? chartData[0][options[0]?.id]
      : (chartData[0] as any).yesPrice;
    const lastPrice = isMultipleChoice
      ? chartData[chartData.length - 1][options[0]?.id]
      : (chartData[chartData.length - 1] as any).yesPrice;
    if (!firstPrice || !lastPrice) return 0;
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [chartData, isMultipleChoice, options]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="h-64 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-neon-iris border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-dark-900/50 rounded-lg">
      <GradientAccent color="neon-iris" position="both" />
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        {/* Time Range Selector - Left side */}
        <div className="flex items-center gap-0.5 bg-dark-800 rounded-md p-0.5 border border-dark-600">
          {(["1H", "24H", "7D", "30D", "ALL"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                timeRange === range
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-dark-700"
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Price and Percentage - Right side */}
        <div className="flex items-center gap-3">
          {!isMultipleChoice && (
            <>
              <div className="text-right">
                <div className="text-2xl font-bold text-white leading-tight">
                  {(primaryPrice * 100).toFixed(1)}¢
                </div>
                <div
                  className={`text-xs font-semibold mt-0.5 ${
                    priceChange >= 0 ? "text-aqua-pulse" : "text-red-400"
                  }`}
                >
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(1)}%
                </div>
              </div>
            </>
          )}
          {isMultipleChoice && (
            <div className="text-sm text-gray-400">
              {options.length} outcomes
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-4" style={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          {isMultipleChoice ? (
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
            >
              <CartesianGrid
                strokeDasharray="2 2"
                stroke="#374151"
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                minTickGap={50}
                height={40}
              />
              <YAxis
                yAxisId="price"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                width={50}
                orientation="right"
              />

              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={0.5}
                stroke="#6b7280"
                strokeDasharray="2 2"
                strokeWidth={1}
                yAxisId="price"
              />

              {/* Price lines */}
              {options.slice(0, 6).map((opt, i) => (
                <Line
                  key={opt.id}
                  yAxisId="price"
                  type="monotone"
                  dataKey={opt.id}
                  stroke={OPTION_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: OPTION_COLORS[i],
                    strokeWidth: 2,
                    fill: "#ffffff",
                  }}
                  isAnimationActive={chartDataKey === 0}
                  animationDuration={chartDataKey === 0 ? 300 : 0}
                />
              ))}
            </ComposedChart>
          ) : (
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
            >
              <CartesianGrid
                strokeDasharray="2 2"
                stroke="#374151"
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                minTickGap={50}
                height={40}
              />
              <YAxis
                yAxisId="price"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                width={50}
                orientation="right"
              />

              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={0.5}
                stroke="#6b7280"
                strokeDasharray="2 2"
                strokeWidth={1}
                yAxisId="price"
              />

              {/* YES Price Line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="yesPrice"
                stroke="#21F6D2"
                strokeWidth={2}
                dot={false}
                name="YES"
                isAnimationActive={chartDataKey === 0}
                animationDuration={chartDataKey === 0 ? 300 : 0}
                activeDot={{
                  r: 4,
                  stroke: "#21F6D2",
                  strokeWidth: 2,
                  fill: "#ffffff",
                }}
              />
              {/* NO Price Line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="noPrice"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="NO"
                isAnimationActive={chartDataKey === 0}
                animationDuration={chartDataKey === 0 ? 300 : 0}
                activeDot={{
                  r: 4,
                  stroke: "#ef4444",
                  strokeWidth: 2,
                  fill: "#ffffff",
                }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend for Binary Markets */}
      {!isMultipleChoice && (
        <div className="px-4 pb-4 border-t border-white/[0.08] pt-4">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#21F6D2]" />
              <div className="text-center">
                <div className="text-xs text-white/60 font-medium uppercase tracking-wide">
                  YES
                </div>
                <div className="text-lg font-bold text-white tabular-nums">
                  {(primaryPrice * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <div className="text-center">
                <div className="text-xs text-white/60 font-medium uppercase tracking-wide">
                  NO
                </div>
                <div className="text-lg font-bold text-white tabular-nums">
                  {((1 - primaryPrice) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Option Legend for Multiple Choice */}
      {isMultipleChoice && options.length > 1 && (
        <div className="px-4 pb-3 border-t border-white/[0.08] pt-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {options.slice(0, 6).map((opt: any, i) => {
              const price =
                (opt as any).yes_price ??
                calculateYesPrice(
                  opt.yes_quantity,
                  opt.no_quantity,
                  liquidityParameter,
                  isResolved
                );
              return (
                <button
                  key={opt.id}
                  onClick={() =>
                    setSelectedOption(selectedOption === opt.id ? null : opt.id)
                  }
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all border max-w-full ${
                    selectedOption === opt.id
                      ? "bg-white/[0.08] border-white/20 ring-1 ring-white/10"
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: OPTION_COLORS[i] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div>
                      <div className="text-xs text-white font-medium truncate">
                        {opt.option_label}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-white tabular-nums">
                      {(price * 100).toFixed(1)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
