import { Request, Response, NextFunction } from "express";
import { IpFilter, IpDeniedError } from "express-ipfilter";

/**
 * IP Whitelist/Blacklist Middleware using express-ipfilter
 * Standard package with CIDR support
 */

/**
 * Get IP addresses from environment variable
 */
function getIPsFromEnv(envVar: string | undefined): string[] {
  if (!envVar) {
    return [];
  }
  return envVar
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/**
 * Global IP blacklist middleware
 * Blocks requests from known malicious IPs
 * NOTE: With trust proxy enabled, req.ip will correctly use X-Forwarded-For
 * Cloudflare also provides CF-Connecting-IP header which is the most reliable
 */
export const globalIPBlacklist = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip IP filtering for OPTIONS requests (CORS preflight)
  // These need to pass through to allow CORS to work properly
  if (req.method === "OPTIONS") {
    return next();
  }

  const blacklist = getIPsFromEnv(process.env.IP_BLACKLIST);

  // If no blacklist configured, allow all
  if (blacklist.length === 0) {
    return next();
  }

  // Apply IP filter
  // With trust proxy enabled, req.ip will be set correctly from X-Forwarded-For
  // express-ipfilter will use req.ip for filtering
  const filter = IpFilter(blacklist, {
    mode: "deny",
    log: false,
    logLevel: "deny",
    excluding: ["/health"], // Allow health check (needed for Cloudflare health checks)
  });

  return filter(req, res, (err?: any) => {
    if (err instanceof IpDeniedError) {
      // Log both the detected IP and Cloudflare header for debugging
      const cfIP = req.headers["cf-connecting-ip"] as string | undefined;
      console.warn(
        `[IP Filter] Blocked request from IP: ${req.ip}${
          cfIP ? ` (CF-Connecting-IP: ${cfIP})` : ""
        }`
      );
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied from this IP address",
      });
    }
    next(err);
  });
};

/**
 * Validate IP address format (IPv4 or IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 regex (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Get real client IP address, validating proxy headers
 * Only trusts X-Forwarded-For from known trusted proxy IPs
 * NOTE: This function is NOT used for admin endpoints (see adminIPWhitelist)
 */
function getRealIP(req: Request): string {
  const trustedProxies = getIPsFromEnv(process.env.TRUSTED_PROXY_IPS || "");
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  const realIP = req.headers["x-real-ip"] as string | undefined;

  // If we have a trusted proxy and X-Real-IP, use it (most reliable)
  if (
    realIP &&
    trustedProxies.length > 0 &&
    trustedProxies.includes(req.ip || "")
  ) {
    return realIP.trim();
  }

  // If we have X-Forwarded-For and the connection is from a trusted proxy
  if (
    forwarded &&
    trustedProxies.length > 0 &&
    trustedProxies.includes(req.ip || "")
  ) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    const firstIP = forwarded.split(",")[0].trim();
    return firstIP;
  }

  // Fallback to connection IP (not from proxy)
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Admin IP whitelist middleware
 * Uses CF-Connecting-IP header (Cloudflare) which is trustworthy and cannot be spoofed
 * Falls back to req.ip (Express with trust proxy) or socket.remoteAddress
 * This prevents X-Forwarded-For spoofing attacks while supporting Cloudflare
 */
export const adminIPWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const whitelist = getIPsFromEnv(process.env.ADMIN_IP_WHITELIST);

  // CRITICAL: Fail hard in production if whitelist not configured
  if (whitelist.length === 0) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "❌ ADMIN_IP_WHITELIST not set in production. BLOCKING all admin access."
      );
      return res.status(503).json({
        error: "Service Unavailable",
        message:
          "Admin access is not configured. Contact system administrator.",
      });
    }
    // Development: allow with warning
    console.warn(
      "⚠️  ADMIN_IP_WHITELIST not set. Allowing all IPs in development."
    );
    return next();
  }

  // Get real client IP address
  // Priority: CF-Connecting-IP (Cloudflare) > req.ip (Express with trust proxy) > socket.remoteAddress
  // CF-Connecting-IP is trustworthy because it's set by Cloudflare, not the client
  const cfIP = req.headers["cf-connecting-ip"] as string | undefined;
  const clientIP =
    cfIP?.trim() || req.ip || req.socket.remoteAddress || "unknown";

  // Validate IP format
  if (!isValidIP(clientIP)) {
    console.error(`[IP Filter] Invalid IP address format: ${clientIP}`);
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid IP address",
    });
  }

  // In development, always allow localhost
  const allowedIPs =
    process.env.NODE_ENV !== "production"
      ? [...whitelist, "127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]
      : whitelist;

  // Check if client IP is in whitelist
  if (!allowedIPs.includes(clientIP)) {
    const connectionIP = req.socket.remoteAddress || req.ip || "unknown";
    console.warn(
      `[IP Filter] Blocked admin request from IP: ${clientIP}${
        cfIP ? ` (CF-Connecting-IP: ${cfIP})` : ""
      } (connection IP: ${connectionIP})`
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "Admin access is restricted to whitelisted IP addresses",
    });
  }

  // IP is whitelisted, proceed
  next();
};
