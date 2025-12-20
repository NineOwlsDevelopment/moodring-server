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
 */
export const globalIPBlacklist = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const blacklist = getIPsFromEnv(process.env.IP_BLACKLIST);

  // If no blacklist configured, allow all
  if (blacklist.length === 0) {
    return next();
  }

  // Apply IP filter
  const filter = IpFilter(blacklist, {
    mode: "deny",
    log: false,
    logLevel: "deny",
    excluding: ["/health"], // Allow health check
  });

  return filter(req, res, (err?: any) => {
    if (err instanceof IpDeniedError) {
      console.warn(`[IP Filter] Blocked request from IP: ${req.ip}`);
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied from this IP address",
      });
    }
    next(err);
  });
};

/**
 * Admin IP whitelist middleware
 * Only allows requests from whitelisted IPs for admin endpoints
 */
export const adminIPWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const whitelist = getIPsFromEnv(process.env.ADMIN_IP_WHITELIST);

  // If no whitelist configured, allow all (for development)
  if (whitelist.length === 0) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "⚠️  ADMIN_IP_WHITELIST not set in production. Admin endpoints are accessible from any IP."
      );
    }
    return next();
  }

  // In development, always allow localhost
  const allowedIPs =
    process.env.NODE_ENV !== "production"
      ? [...whitelist, "127.0.0.1", "::1", "::ffff:127.0.0.1"]
      : whitelist;

  // Apply IP filter
  const filter = IpFilter(allowedIPs, {
    mode: "allow",
    log: false,
    logLevel: "allow",
  });

  return filter(req, res, (err?: any) => {
    if (err instanceof IpDeniedError) {
      console.warn(`[IP Filter] Blocked admin request from IP: ${req.ip}`);
      return res.status(403).json({
        error: "Forbidden",
        message: "Admin access is restricted to whitelisted IP addresses",
      });
    }
    next(err);
  });
};
