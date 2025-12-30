import { MarketOption } from "@/types/market";
import {
  formatProbability,
  calculateYesPrice,
} from "@/utils/format";

interface MoodRingProps {
  options?: MarketOption[];
  size?: number;
  strokeWidth?: number;
  showLabels?: boolean;
  liquidityParam?: number;
  isResolved?: boolean;
  // For binary markets (expects prices between 0 and 1)
  yes_quantity?: number;
  no_quantity?: number;
}

// Enhanced color palette with neon-style gradients
const COLORS = [
  { start: "#c084fc", end: "#9333ea" }, // Neon Purple
  { start: "#60a5fa", end: "#2563eb" }, // Neon Blue
  { start: "#f472b6", end: "#ec4899" }, // Neon Pink
  { start: "#5FFAE6", end: "#21F6D2" }, // Aqua Teal (replacing neon green)
  { start: "#fbbf24", end: "#f59e0b" }, // Neon Yellow
  { start: "#fb923c", end: "#f97316" }, // Neon Orange
  { start: "#a78bfa", end: "#7c3aed" }, // Neon Violet
  { start: "#2dd4bf", end: "#14b8a6" }, // Neon Teal
  { start: "#818cf8", end: "#6366f1" }, // Neon Indigo
  { start: "#e879f9", end: "#d946ef" }, // Neon Fuchsia
];

// Special colors for binary YES/NO - Neon style
const BINARY_COLORS = {
  yes: { start: "#c084fc", end: "#9333ea" }, // Neon Purple gradient
  no: { start: "#60a5fa", end: "#2563eb" }, // Neon Blue gradient
};

export const MoodRing = ({
  options,
  size = 200,
  strokeWidth = 30,
  showLabels = true,
  liquidityParam = 0,
  isResolved = false,
  yes_quantity = 0,
  no_quantity = 0,
}: MoodRingProps) => {
  // Determine if this is a binary market or multiple choice
  const isBinary =
    !options && yes_quantity !== undefined && no_quantity !== undefined;

  // Create segments based on market type
  let segments: any[] = [];
  let topTwo: any[] = [];

  if (isBinary) {
    // Binary market - yes_quantity and no_quantity are expected to be prices (0-1)
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Ensure values are between 0 and 1
    const yesPrice = Math.max(0, Math.min(1, yes_quantity || 0.5));
    const noPrice = Math.max(0, Math.min(1, no_quantity || 0.5));

    // Calculate segment lengths based on prices
    const yesSegmentLength = circumference * yesPrice;
    const noSegmentLength = circumference * noPrice;

    segments = [
      {
        id: "yes",
        name: "YES",
        color: BINARY_COLORS.yes,
        segmentLength: yesSegmentLength,
        gapLength: circumference - yesSegmentLength,
        rotation: -90,
        percent: yesPrice,
      },
      {
        id: "no",
        name: "NO",
        color: BINARY_COLORS.no,
        segmentLength: noSegmentLength,
        gapLength: circumference - noSegmentLength,
        rotation: -90 + yesPrice * 360,
        percent: noPrice,
      },
    ];

    // Sort by percent descending so dominant one is first
    topTwo = [...segments].sort((a, b) => b.percent - a.percent);
  } else if (options) {
    // Multiple choice market - use API-provided prices or calculate using LMSR
    const optionsWithPrices = options.map((option) => ({
      ...option,
      yesPrice:
        (option as any).yes_price ??
        calculateYesPrice(
          Number(option.yes_quantity) || 0,
          Number(option.no_quantity) || 0,
          liquidityParam,
          isResolved
        ),
    }));

    // Sort by YES price descending for visual order
    const sortedOptions = [...optionsWithPrices].sort(
      (a, b) => b.yesPrice - a.yesPrice
    );

    // Normalize prices to sum to 1 for the ring display
    const totalPrices = sortedOptions.reduce(
      (sum, opt) => sum + opt.yesPrice,
      0
    );

    // Calculate the radius
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Calculate cumulative percentages for each segment
    let cumulativePercent = 0;
    segments = sortedOptions.map((option, index) => {
      // Normalize the price so all segments sum to 1
      const segmentPercent =
        totalPrices > 0
          ? option.yesPrice / totalPrices
          : 1 / sortedOptions.length;
      const startPercent = cumulativePercent;
      cumulativePercent += segmentPercent;

      // Convert to stroke-dasharray values
      const segmentLength = circumference * segmentPercent;
      const gapLength = circumference - segmentLength;

      // Calculate rotation to position this segment
      const rotation = -90 + startPercent * 360;

      const fallbackVolume = (option.yes_shares ?? 0) + (option.no_shares ?? 0);
      const volume = option.total_volume ?? fallbackVolume;

      return {
        id: option.id || `option-${index}`,
        name: option.option_label,
        label: option.option_label,
        color: COLORS[index % COLORS.length],
        segmentLength,
        gapLength,
        rotation,
        percent: segmentPercent,
        total_volume: volume,
      };
    });

    const totalMarketVolume = segments.reduce(
      (sum, segment) => sum + (segment.total_volume || 0),
      0
    );

    if (totalMarketVolume === 0 && segments.length >= 2) {
      let fallbackStartPercent = 0;
      segments = segments.map((segment, index) => {
        const percent = index < 2 ? 0.5 : 0;
        const startPercent = fallbackStartPercent;
        fallbackStartPercent += percent;

        const segmentLength = circumference * percent;
        const gapLength = circumference - segmentLength;
        const rotation = -90 + startPercent * 360;

        return {
          ...segment,
          percent,
          segmentLength,
          gapLength,
          rotation,
        };
      });
    }

    topTwo = [...segments]
      .sort((a, b) => {
        const volumeDiff = (b.total_volume || 0) - (a.total_volume || 0);
        if (volumeDiff !== 0) {
          return volumeDiff;
        }
        return b.percent - a.percent;
      })
      .slice(0, 2);
  }

  // Calculate the center and radius (used in JSX)
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;

  return (
    <div className="flex flex-col items-center">
      {/* SVG Ring with padding to prevent cutoff */}
      <div
        className="relative group"
        style={{
          width: size,
          height: size,
        }}
      >
        {/* Enhanced Gradient definitions with shimmer effect */}
        <svg width={0} height={0} className="overflow-visible">
          <defs>
            {segments.map((segment) => (
              <radialGradient
                key={`gradient-${segment.id}`}
                id={`gradient-${segment.id}`}
                cx="30%"
                cy="30%"
                r="70%"
              >
                <stop
                  offset="0%"
                  style={{ stopColor: segment.color.start, stopOpacity: 1 }}
                />
                <stop
                  offset="50%"
                  style={{ stopColor: segment.color.start, stopOpacity: 0.95 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: segment.color.end, stopOpacity: 1 }}
                />
              </radialGradient>
            ))}
            {/* Shimmer overlay gradient */}
            <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.1" />
              <stop offset="50%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="white" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        <svg
          width={size}
          height={size}
          viewBox={`-20 -20 ${size + 40} ${size + 40}`}
          className="transform -rotate-90 transition-transform duration-300 group-hover:scale-105"
          style={{ overflow: "visible" }}
        >
          {/* Background circle with subtle shadow */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
          />

          {/* Glow layer for depth */}
          {segments.map((segment, index) => (
            <circle
              key={`glow-${segment.id}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color.start}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segment.segmentLength} ${segment.gapLength}`}
              strokeDashoffset={0}
              transform={`rotate(${segment.rotation} ${center} ${center})`}
              strokeLinecap="round"
              opacity="0.3"
              className="transition-all duration-700 ease-out"
              style={{
                filter: `blur(4px)`,
                animation: `fadeInSegment 0.6s ease-out ${index * 0.1}s both`,
              }}
            />
          ))}

          {/* Main colored segments with gradient */}
          {segments.map((segment, index) => (
            <circle
              key={segment.id}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#gradient-${segment.id})`}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segment.segmentLength} ${segment.gapLength}`}
              strokeDashoffset={0}
              transform={`rotate(${segment.rotation} ${center} ${center})`}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out animate-in"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))",
                animation: `fadeInSegment 0.6s ease-out ${index * 0.1}s both`,
              }}
            />
          ))}

          {/* Shimmer overlay on segments */}
          {segments.map((segment, index) => (
            <circle
              key={`shimmer-${segment.id}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="url(#shimmer)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${segment.segmentLength} ${segment.gapLength}`}
              strokeDashoffset={0}
              transform={`rotate(${segment.rotation} ${center} ${center})`}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out opacity-60 group-hover:opacity-80"
              style={{
                animation: `fadeInSegment 0.6s ease-out ${
                  index * 0.1
                }s both, shimmerPulse 3s ease-in-out infinite ${index * 0.2}s`,
              }}
            />
          ))}

          {/* Decorative circles at endpoints of dominant segment */}
          {topTwo[0] &&
            (() => {
              const dominant = topTwo[0];
              const startAngle = (dominant.rotation * Math.PI) / 180;
              const endAngle =
                ((dominant.rotation + dominant.percent * 360) * Math.PI) / 180;

              // Calculate positions for start and end circles
              const startX = center + radius * Math.cos(startAngle);
              const startY = center + radius * Math.sin(startAngle);
              const endX = center + radius * Math.cos(endAngle);
              const endY = center + radius * Math.sin(endAngle);

              const dotRadius = strokeWidth / 2 + 2;

              return (
                <>
                  {/* Start circle */}
                  <circle
                    cx={startX}
                    cy={startY}
                    r={dotRadius}
                    fill={dominant.color.start}
                    className="transition-all duration-700 ease-out"
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
                      animation: "fadeInSegment 0.6s ease-out both",
                    }}
                  />
                  {/* Inner glow for start circle */}
                  <circle
                    cx={startX}
                    cy={startY}
                    r={dotRadius - 3}
                    fill="white"
                    opacity="0.3"
                    className="transition-all duration-700 ease-out"
                    style={{
                      animation: "fadeInSegment 0.6s ease-out both",
                    }}
                  />

                  {/* End circle */}
                  <circle
                    cx={endX}
                    cy={endY}
                    r={dotRadius}
                    fill={dominant.color.end}
                    className="transition-all duration-700 ease-out"
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
                      animation: "fadeInSegment 0.6s ease-out both",
                    }}
                  />
                  {/* Inner glow for end circle */}
                  <circle
                    cx={endX}
                    cy={endY}
                    r={dotRadius - 3}
                    fill="white"
                    opacity="0.3"
                    className="transition-all duration-700 ease-out"
                    style={{
                      animation: "fadeInSegment 0.6s ease-out both",
                    }}
                  />
                </>
              );
            })()}
        </svg>

        {/* Center content with animation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center transform transition-transform duration-300 group-hover:scale-110">
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">
              {isBinary ? "YES" : "Leader"}
            </div>
            <div className="text-3xl font-bold text-white transition-all duration-300">
              {formatProbability(topTwo[0]?.percent || 0)}
            </div>
            {!isBinary && (
              <div className="text-xs text-gray-600 mt-1 font-medium truncate max-w-[100px]">
                {topTwo[0]?.name || ""}
              </div>
            )}
          </div>
        </div>

        {/* Circular pulsing glow effect on hover */}
        <div
          className="absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: size,
            height: size,
            background: `radial-gradient(circle, ${segments[0]?.color.start}20 0%, transparent 70%)`,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Labels - Top 2 Options */}
      {showLabels && (
        <div className="mt-4 w-full space-y-2">
          {topTwo.map((segment) => (
            <div
              key={segment.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${segment.color.start}, ${segment.color.end})`,
                  }}
                />
                <span className="text-gray-300 font-medium truncate">
                  {segment.name}
                </span>
              </div>
              <span className="text-white font-bold ml-2">
                {formatProbability(segment.percent)}
              </span>
            </div>
          ))}
          {options && options.length > 2 && (
            <div className="text-xs text-gray-500 text-center pt-1">
              +{options.length - 2} more options
            </div>
          )}
        </div>
      )}
    </div>
  );
};
