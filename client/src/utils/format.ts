/**
 * Capitalize the first letter of a string (for display)
 * Converts "will bitcoin reach $100k?" to "Will bitcoin reach $100k?"
 */
export const capitalize = (text: string | null | undefined): string => {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * Capitalize the first letter of each word (for labels/titles)
 * Converts "bitcoin price" to "Bitcoin Price"
 * Handles special cases like all-caps words and preserves existing capitalizations
 */
export const capitalizeWords = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .trim()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      // Handle words that are entirely uppercase (e.g., "USA", "NFL")
      // Keep them as-is unless they're very short common words
      if (
        word.length <= 3 &&
        word === word.toUpperCase() &&
        /^[A-Z]+$/.test(word)
      ) {
        return word;
      }
      // Handle words with mixed case like "iPhone", "eBay" - keep as-is
      if (
        word.length > 1 &&
        word.slice(1) !== word.slice(1).toLowerCase() &&
        word[0] === word[0].toLowerCase()
      ) {
        return word;
      }
      // Normal case: capitalize first letter, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

export const formatCurrency = (
  amount: number | string | null | undefined
): string => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(0)}%`;
};

export const formatProbability = (
  value: number | string | null | undefined,
  _isResolved: boolean = false
): string => {
  const num = Number(value) || 0;
  if (!Number.isFinite(num)) return "0%";

  // Show the actual probability without clamping
  // This ensures displayed percentages match the actual market prices
  return `${(num * 100).toFixed(1)}%`;
};

export const formatDate = (
  date: Date | number | string | null | undefined
): string => {
  if (date === null || date === undefined) return "No date";

  let dateObj: Date;
  if (typeof date === "number") {
    // Unix timestamp - if very large, it's milliseconds, otherwise seconds
    dateObj = new Date(date > 100000000000 ? date : date * 1000);
  } else if (typeof date === "string") {
    // Check if it's a numeric string (Unix timestamp)
    const parsed = parseInt(date, 10);
    if (!isNaN(parsed) && /^\d+$/.test(date.trim())) {
      // It's a numeric string (timestamp)
      dateObj = new Date(parsed > 100000000000 ? parsed : parsed * 1000);
    } else {
      // It's a datetime string like "2025-12-19 17:06:38.393364"
      // Replace space with 'T' to make it ISO-like for better browser compatibility
      const isoString = date.trim().replace(" ", "T");
      dateObj = new Date(isoString);
    }
  } else {
    dateObj = new Date(date);
  }

  if (isNaN(dateObj.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
};

export const formatShortDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

export const formatTimeRemaining = (
  endDate: Date | number | string | null | undefined
): string => {
  if (endDate === null || endDate === undefined) return "No date";

  // Handle Unix timestamp (seconds or string) or Date object
  let expirationMs: number;

  if (typeof endDate === "string") {
    // Try parsing as number first (Unix timestamp as string)
    const parsed = parseInt(endDate, 10);
    if (!isNaN(parsed) && parsed > 0) {
      // If the number is very large (> year 3000 in seconds), it's likely milliseconds
      expirationMs = parsed > 100000000000 ? parsed : parsed * 1000;
    } else {
      // Try parsing as date string
      expirationMs = new Date(endDate).getTime();
    }
  } else if (typeof endDate === "number") {
    // If the number is very large (> year 3000 in seconds), it's likely milliseconds
    // Unix timestamp for year 3000 is ~32503680000
    expirationMs = endDate > 100000000000 ? endDate : endDate * 1000;
  } else {
    expirationMs = new Date(endDate).getTime();
  }

  if (isNaN(expirationMs) || expirationMs <= 0) return "No date";

  const now = Date.now();
  const diff = expirationMs - now;

  if (diff < 0) return "Ended";

  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  // For dates beyond a year: format as "Xy Ym Zd"
  const daysInYear = 365.25;
  const daysInMonth = 30.44; // Average days per month (365.25/12)

  if (totalDays >= daysInYear) {
    const years = Math.floor(totalDays / daysInYear);
    const remainingDaysAfterYears = totalDays % daysInYear;
    const months = Math.floor(remainingDaysAfterYears / daysInMonth);
    const days = Math.floor(remainingDaysAfterYears % daysInMonth);

    const parts: string[] = [];
    if (years > 0) {
      parts.push(`${years}y`);
    }
    if (months > 0) {
      parts.push(`${months}m`);
    }
    if (days > 0) {
      parts.push(`${days}d`);
    }

    return parts.join(" ");
  }

  // For dates under 1 day: show hours and minutes
  if (totalDays < 1) {
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }

  // For dates between 1 day and 1 year: show days and hours
  const days = totalDays;
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // If more than 48 hours remaining, show only days
  if (totalHours > 48) {
    return `${days}d`;
  }

  return `${days}d ${hours}h`;
};

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Format micro-USDC (6 decimals) to display currency
 * Shows "k" notation for thousands (e.g., $10.54k for 10,540)
 * Shows "M" notation for millions (e.g., $120M for 120,000,000)
 * @param amount - Amount in micro-USDC (raw units from blockchain/DB)
 * @returns Formatted currency string
 */
export const formatUSDC = (
  amount: number | string | null | undefined
): string => {
  const num = Number(amount) || 0;
  const displayAmount = num / 1_000_000;

  // Use "M" notation for millions
  if (displayAmount >= 1_000_000) {
    const millions = displayAmount / 1_000_000;
    // Show up to 2 decimal places for M notation
    const rounded = Math.round(millions * 100) / 100;
    return `$${rounded.toFixed(rounded % 1 === 0 ? 0 : 2)}M`;
  }

  // Use "k" notation for thousands
  if (displayAmount >= 1000) {
    const thousands = displayAmount / 1000;
    // Show up to 2 decimal places for k notation
    const rounded = Math.round(thousands * 100) / 100;
    return `$${rounded.toFixed(rounded % 1 === 0 ? 0 : 2)}k`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayAmount);
};

export const normalizeDbTimestamp = (s: string): Date => {
  const iso =
    s
      .trim()
      .replace(" ", "T")
      .replace(/(\.\d{3})\d+/, "$1") + "Z";

  return new Date(iso);
};

export const formatDistanceToNow = (isoUtc: number): string => {
  const then = Number(isoUtc);
  if (!Number.isFinite(then)) return "recently";

  // Handle both seconds and milliseconds timestamps
  // If the number is very large (> year 2001 in seconds), it's likely milliseconds
  const thenMs = then > 100000000000 ? then : then * 1000;
  const diffMs = thenMs - Date.now();

  const sec = Math.floor(Math.abs(diffMs / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  const suffix = diffMs <= 0 ? "ago" : "in";

  if (sec < 60) return diffMs <= 0 ? "just now" : "in a moment";
  if (min < 60) return `${min}m ${suffix}`;
  if (hr < 24) return `${hr}h ${suffix}`;
  if (day < 7) return `${day}d ${suffix}`;

  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ${suffix}`;

  return `${Math.floor(day / 30)}mo ${suffix}`;
};

export const formatNumber = (
  num: number | string | null | undefined
): string => {
  const n = Number(num) || 0;
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

/**
 * Format number with compact notation, rounding UP
 * Used for platform stats to show rounded-up values
 * Never more than 4 characters (e.g., "999", "1.2K", "12M", "1.2B")
 * Anything over 999k becomes 1M, over 999M becomes 1B, etc.
 */
export const formatNumberRoundedUp = (
  num: number | string | null | undefined
): string => {
  const n = Number(num) || 0;
  if (n === 0) return "0";
  
  // Trillions
  if (n >= 1_000_000_000_000) {
    const trillions = n / 1_000_000_000_000;
    // If >= 1000T, round up to next unit (but we don't have a higher unit, so cap at 999T)
    if (trillions >= 1000) {
      return "999T";
    }
    const rounded = Math.ceil(trillions * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}T`;
  }
  
  // Billions
  if (n >= 1_000_000_000) {
    const billions = n / 1_000_000_000;
    // If >= 1000B, round up to 1T
    if (billions >= 1000) {
      return "1T";
    }
    const rounded = Math.ceil(billions * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}B`;
  }
  
  // Millions
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    // If >= 1000M, round up to 1B
    if (millions >= 1000) {
      return "1B";
    }
    const rounded = Math.ceil(millions * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}M`;
  }
  
  // Thousands
  if (n >= 1_000) {
    const thousands = n / 1_000;
    // If >= 1000K, round up to 1M
    if (thousands >= 1000) {
      return "1M";
    }
    const rounded = Math.ceil(thousands * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}K`;
  }
  
  // Less than 1000, show as integer
  return Math.ceil(n).toString();
};

/**
 * Format USDC with compact notation, rounding UP
 * Used for platform stats to show rounded-up currency values
 * Never more than 4 characters total (e.g., "$999", "$1.2K", "$12M", "$1.2B")
 * Anything over 999k becomes $1M, over 999M becomes $1B, etc.
 */
export const formatUSDCRoundedUp = (
  amount: number | string | null | undefined
): string => {
  const num = Number(amount) || 0;
  const displayAmount = num / 1_000_000; // Convert from micro-USDC to USDC

  if (displayAmount === 0) return "$0";

  // Trillions
  if (displayAmount >= 1_000_000_000_000) {
    const trillions = displayAmount / 1_000_000_000_000;
    // If >= 1000T, cap at 999T
    if (trillions >= 1000) {
      return "$999T";
    }
    const rounded = Math.ceil(trillions * 10) / 10;
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}T`;
  }

  // Billions
  if (displayAmount >= 1_000_000_000) {
    const billions = displayAmount / 1_000_000_000;
    // If >= 1000B, round up to $1T
    if (billions >= 1000) {
      return "$1T";
    }
    const rounded = Math.ceil(billions * 10) / 10;
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}B`;
  }

  // Millions
  if (displayAmount >= 1_000_000) {
    const millions = displayAmount / 1_000_000;
    // If >= 1000M, round up to $1B
    if (millions >= 1000) {
      return "$1B";
    }
    const rounded = Math.ceil(millions * 10) / 10;
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}M`;
  }

  // Thousands
  if (displayAmount >= 1_000) {
    const thousands = displayAmount / 1_000;
    // If >= 1000K, round up to $1M
    if (thousands >= 1000) {
      return "$1M";
    }
    const rounded = Math.ceil(thousands * 10) / 10;
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}K`;
  }

  // Less than 1000, show as integer
  return `$${Math.ceil(displayAmount).toFixed(0)}`;
};

/**
 * Format micro-unit shares/quantities (6 decimals) to display format
 * @param amount - Amount in micro-units (raw units from blockchain/DB)
 * @returns Formatted number string
 */
export const formatShares = (
  amount: number | string | null | undefined
): string => {
  const num = Number(amount) || 0;
  const displayAmount = num / 1_000_000;
  if (displayAmount === 0) return "0";
  if (displayAmount >= 1_000_000)
    return `${(displayAmount / 1_000_000).toFixed(1)}M`;
  if (displayAmount >= 1_000) return `${(displayAmount / 1_000).toFixed(1)}K`;
  // Show decimals when there's a fractional part for precision
  if (displayAmount >= 1) {
    return displayAmount % 1 === 0
      ? displayAmount.toFixed(0)
      : displayAmount.toFixed(2);
  }
  return displayAmount.toFixed(2);
};

export const formatPnL = (
  value: number
): { text: string; isPositive: boolean } => {
  const isPositive = value >= 0;
  const text = `${isPositive ? "+" : ""}${formatCurrency(value)}`;
  return { text, isPositive };
};

/**
 * Calculate LMSR YES price from share quantities
 * Price = 1 / (1 + e^((q_no - q_yes) / b))
 * Returns the actual calculated price (0.0 to 1.0) without clamping
 *
 * Note: Quantities are in micro-units (scaled by 1,000,000).
 * The liquidity parameter is already scaled correctly by the backend.
 * Do NOT auto-scale the liquidity parameter - it causes price drift.
 *
 * @param optionResolved - If the option is resolved, pass { is_resolved: true, winning_side: 1 or 2 }
 *                         If winning_side is 1, YES won (returns 1.0), if 2, NO won (returns 0.0)
 */
export const calculateYesPrice = (
  yesQuantity: number | string | null | undefined,
  noQuantity: number | string | null | undefined,
  liquidityParam: number | string | null | undefined,
  isResolved:
    | boolean
    | { is_resolved: boolean; winning_side?: number | null } = false
): number => {
  // Handle resolved option - check if option-level resolution is provided
  let optionIsResolved = false;
  let winningSide: number | null = null;

  if (typeof isResolved === "object" && isResolved.is_resolved) {
    optionIsResolved = true;
    winningSide = isResolved.winning_side ?? null;
  } else if (isResolved === true) {
    // Market-level resolution (legacy)
    optionIsResolved = true;
  }

  // If option is resolved, return 1.0 for YES if YES won, 0.0 if NO won
  if (optionIsResolved && winningSide !== null) {
    return winningSide === 1 ? 1.0 : 0.0;
  }

  // Convert to numbers safely
  const yes = Number(yesQuantity) || 0;
  const no = Number(noQuantity) || 0;
  const b = Number(liquidityParam) || 0;

  // If liquidity param is missing/invalid or quantities are both 0, return 0.5 (50/50)
  // A missing liquidity param means the market is not properly initialized
  if (b <= 0 || (yes === 0 && no === 0)) {
    return 0.5;
  }

  // Backend already scales liquidity parameter correctly to match micro-unit quantities
  // Do NOT auto-scale here - it causes price drift and mismatches with backend
  const diff = (no - yes) / b;

  // Prevent overflow for large differences
  if (!Number.isFinite(diff)) return 0.5;
  // For extreme differences, clamp prices to reasonable bounds for unresolved markets
  // This prevents exact 0/1 prices which cause trading issues
  const minPrice = 0.001; // 0.1%
  const maxPrice = 0.999; // 99.9%

  if (diff > 20)
    return optionIsResolved ? 0 : Math.max(minPrice, 1 / (1 + Math.exp(20)));
  if (diff < -20)
    return optionIsResolved ? 1 : Math.min(maxPrice, 1 / (1 + Math.exp(-20)));

  const result = 1 / (1 + Math.exp(diff));

  // Guard against NaN
  if (!Number.isFinite(result)) return 0.5;

  // Clamp result to prevent exact boundary values for unresolved markets
  if (!optionIsResolved) {
    return Math.max(minPrice, Math.min(maxPrice, result));
  }

  return result;
};

/**
 * Calculate LMSR NO price from share quantities
 * Returns the actual calculated price (0.0 to 1.0) without clamping
 */
export const calculateNoPrice = (
  yesQuantity: number,
  noQuantity: number,
  liquidityParam: number,
  isResolved: boolean = false
): number => {
  return (
    1 - calculateYesPrice(yesQuantity, noQuantity, liquidityParam, isResolved)
  );
};

/**
 * LMSR Cost Function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
 * For numerical stability: C(q) = max(q_yes, q_no) + b * ln(1 + e^(-|q_yes - q_no|/b))
 *
 * Note: Backend already scales liquidity parameter correctly - do NOT auto-scale here
 */
const lmsrCostFunction = (
  yesQuantity: number,
  noQuantity: number,
  liquidityParam: number
): number => {
  const b = liquidityParam;
  if (b <= 0) return 0;

  // Backend already scales liquidity parameter correctly to match micro-unit quantities
  // Do NOT auto-scale here - it causes price drift and mismatches with backend

  const maxQ = Math.max(yesQuantity, noQuantity);
  const diff = Math.abs(yesQuantity - noQuantity);
  const ratio = diff / b;

  // For large ratios, ln(1 + e^(-x)) ≈ 0
  if (ratio > 20) {
    return maxQ;
  }

  // ln(1 + e^(-x))
  const lnTerm = Math.log(1 + Math.exp(-ratio));

  return maxQ + b * lnTerm;
};

/**
 * Calculate the LMSR cost to buy shares
 * Cost = C(q_new) - C(q_current)
 * Returns cost in the same units as quantities (micro-USDC if quantities are micro-shares)
 */
export const calculateLmsrBuyCost = (
  currentYes: number,
  currentNo: number,
  buyYes: number,
  buyNo: number,
  liquidityParam: number
): number => {
  const costBefore = lmsrCostFunction(currentYes, currentNo, liquidityParam);
  const costAfter = lmsrCostFunction(
    currentYes + buyYes,
    currentNo + buyNo,
    liquidityParam
  );

  return Math.max(0, costAfter - costBefore);
};

/**
 * Calculate the LMSR payout for selling shares
 * Payout = C(q_current) - C(q_new)
 */
export const calculateLmsrSellPayout = (
  currentYes: number,
  currentNo: number,
  sellYes: number,
  sellNo: number,
  liquidityParam: number
): number => {
  const costBefore = lmsrCostFunction(currentYes, currentNo, liquidityParam);
  const costAfter = lmsrCostFunction(
    currentYes - sellYes,
    currentNo - sellNo,
    liquidityParam
  );

  return Math.max(0, costBefore - costAfter);
};

/**
 * Calculate how many shares you can buy for a given amount using LMSR
 * Uses binary search to find the number of shares that costs the target amount
 */
export const calculateSharesForAmount = (
  currentYes: number,
  currentNo: number,
  amountMicro: number, // Amount in micro-USDC
  buyYes: boolean,
  liquidityParam: number
): number => {
  if (amountMicro <= 0 || liquidityParam <= 0) return 0;

  // Backend already scales liquidity parameter correctly - do NOT auto-scale here
  // Auto-scaling causes price drift and mismatches with backend calculations

  // Calculate current marginal price to set a reasonable upper bound
  const currentPrice = buyYes
    ? calculateYesPrice(currentYes, currentNo, liquidityParam)
    : calculateNoPrice(currentYes, currentNo, liquidityParam);

  // Convert micro-USDC amount to dollars for price calculations
  const amountDollars = amountMicro / 1_000_000;

  // Upper bound: if price is 1¢ ($0.01), you could get up to 100x amount in shares
  // Add 2x buffer for LMSR price impact. Minimum bound of amount * 10 for safety.
  const minPrice = Math.max(0.00001, currentPrice);
  const estimatedShares = amountDollars / minPrice;
  const high = Math.max(amountDollars * 10, estimatedShares * 2);

  // Binary search for shares (in regular units, then convert to micro-units)
  let searchLow = 0;
  let searchHigh = high;
  const tolerance = 1000; // $0.001 tolerance in micro-USDC

  for (let i = 0; i < 50; i++) {
    const mid = (searchLow + searchHigh) / 2;
    const midMicro = Math.floor(mid * 1_000_000); // Convert shares to micro-shares
    const cost = buyYes
      ? calculateLmsrBuyCost(currentYes, currentNo, midMicro, 0, liquidityParam)
      : calculateLmsrBuyCost(
          currentYes,
          currentNo,
          0,
          midMicro,
          liquidityParam
        );

    if (Math.abs(cost - amountMicro) < tolerance) {
      return midMicro; // Return micro-shares
    }

    if (cost < amountMicro) {
      searchLow = mid;
    } else {
      searchHigh = mid;
    }
  }

  return Math.floor(searchLow * 1_000_000); // Return micro-shares
};

/**
 * Calculate average price per share for a purchase
 * Average price = total cost / shares bought
 */
export const calculateAveragePrice = (
  currentYes: number,
  currentNo: number,
  shares: number,
  buyYes: boolean,
  liquidityParam: number
): number => {
  if (shares <= 0) return 0;

  const cost = buyYes
    ? calculateLmsrBuyCost(currentYes, currentNo, shares, 0, liquidityParam)
    : calculateLmsrBuyCost(currentYes, currentNo, 0, shares, liquidityParam);

  return cost / shares;
};
