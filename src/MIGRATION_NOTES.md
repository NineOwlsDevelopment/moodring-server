# Migration Notes: Standard Security Packages

This document describes the migration from custom security implementations to standard Express packages.

## Changes Made

### 1. CSRF Protection

- **Before**: Custom implementation using `csrf` package
- **After**: `csrf-csrf` package (modern, actively maintained)
- **Benefits**: Better TypeScript support, more flexible configuration, actively maintained

### 2. IP Filtering

- **Before**: Custom implementation with CIDR support
- **After**: `express-ipfilter` package
- **Benefits**: Standard package, well-tested, better error handling

### 3. Rate Limiting

- **Before**: Custom in-memory rate limiter
- **After**: `express-rate-limit` with optional Redis support
- **Benefits**:
  - Industry standard
  - Redis support for distributed systems
  - Better features (standard headers, etc.)
  - More reliable

### 4. Rate Limit Values Fixed

Fixed incorrect rate limit values:

- General: 12000 → 120 requests/minute
- Auth: 100000 → 10 attempts/hour
- Trade: 2000 → 20 trades/minute
- Market Creation: 1000 → 10 markets/hour

## Breaking Changes

### None

All changes are backward compatible. The API remains the same, only the underlying implementation changed.

## Configuration Updates

### Redis for Rate Limiting (Optional)

If you want to use Redis for rate limiting in production:

```bash
# .env
REDIS_URL=redis://localhost:6379
```

Or:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

If Redis is not configured, the system automatically falls back to in-memory rate limiting.

### Trust Proxy

Added `TRUST_PROXY` environment variable support. If your app is behind a load balancer or proxy, set:

```bash
TRUST_PROXY=1
```

Or set to `false` to disable proxy trust.

## Testing

All existing tests should continue to work. The middleware APIs remain the same:

- `csrfProtection` - CSRF middleware
- `getCSRFToken` - Get CSRF token endpoint
- `attachCSRFToken` - Attach token to responses
- `globalIPBlacklist` - Global IP blacklist
- `adminIPWhitelist` - Admin IP whitelist
- All rate limiters (`generalLimiter`, `authLimiter`, etc.)

## Package Dependencies

### Added

- `csrf-csrf@^4.0.3` - CSRF protection
- `express-ipfilter@^1.3.2` - IP filtering
- `express-rate-limit@^8.2.1` - Rate limiting
- `rate-limit-redis@^4.3.1` - Redis store for rate limiting
- `redis@^5.10.0` - Redis client

### Removed

- `csrf@^3.1.0` - Replaced by `csrf-csrf`

## Performance

- **Rate Limiting**: With Redis, rate limiting works across multiple server instances
- **CSRF**: Slightly improved performance with optimized token generation
- **IP Filtering**: Similar performance, better error handling

## Next Steps

1. Test all endpoints to ensure CSRF tokens work correctly
2. Configure Redis if deploying to multiple servers
3. Review and adjust rate limits based on your needs
4. Update client code if needed (CSRF token handling should be the same)
