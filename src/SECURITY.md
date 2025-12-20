# Security Features Documentation

This document describes the security features implemented in the MoodRing application.

## Security Headers (Helmet.js)

Helmet.js is configured to set various HTTP security headers:

- **Content Security Policy (CSP)**: Restricts which resources can be loaded
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Strict-Transport-Security (HSTS)**: Forces HTTPS connections
- **X-XSS-Protection**: Enables browser XSS filtering

### Configuration

Helmet is automatically enabled. To customize, edit `src/index.ts`:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      /* ... */
    },
    hsts: {
      /* ... */
    },
  })
);
```

## Request Size Limits

Request body size limits are configured to prevent DoS attacks:

- **JSON payloads**: 10MB limit
- **URL-encoded data**: 10MB limit

These limits can be adjusted in `src/index.ts`:

```typescript
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
```

## CSRF Protection

CSRF (Cross-Site Request Forgery) protection is implemented using the `csrf-csrf` package, which uses the double-submit cookie pattern. This is a modern, actively maintained package.

### How It Works

1. Client requests a CSRF token from `/api/csrf-token` or `/api/v1/auth/csrf-token`
2. Server sets a cookie (`_csrf`) and returns the token in the response
3. Client includes the token in the `X-CSRF-Token` header for all state-changing requests (POST, PUT, DELETE, PATCH)
4. Server verifies that the cookie token matches the header token

### Client Implementation

```typescript
// Get CSRF token
const response = await fetch("/api/csrf-token");
const { csrfToken } = await response.json();

// Include in requests
fetch("/api/v1/trade/buy", {
  method: "POST",
  headers: {
    "X-CSRF-Token": csrfToken,
    "Content-Type": "application/json",
  },
  credentials: "include", // Important: include cookies
  body: JSON.stringify({
    /* ... */
  }),
});
```

### Exempted Endpoints

- GET, HEAD, OPTIONS requests (safe methods)
- `/health` endpoint
- `/api/webhooks/*` endpoints (use signature verification instead)

## Secrets Management

The application supports multiple secrets management backends:

1. **Environment Variables** (default, for development)
2. **AWS Secrets Manager** (for production)
3. **HashiCorp Vault** (optional)

### Environment Variables

Secrets are loaded from environment variables by default. Required secrets:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_PW`
- `DB_PASSWORD`

### AWS Secrets Manager

To use AWS Secrets Manager:

1. Set `AWS_SECRETS_MANAGER_ENABLED=true` in your environment
2. Configure AWS credentials:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (default: us-east-1)
3. Install AWS SDK: `npm install @aws-sdk/client-secrets-manager`

Secrets are cached for 5 minutes to reduce API calls.

### HashiCorp Vault

To use HashiCorp Vault:

1. Set `VAULT_ENABLED=true` in your environment
2. Configure Vault connection:
   - `VAULT_ADDR` - Vault server address
   - `VAULT_TOKEN` - Vault authentication token

Note: Vault integration requires additional implementation based on your Vault setup.

## API Versioning

All API endpoints are versioned under `/api/v1/`:

- `/api/v1/auth/*` - Authentication endpoints
- `/api/v1/user/*` - User management
- `/api/v1/market/*` - Market operations
- `/api/v1/trade/*` - Trading operations
- `/api/v1/admin/*` - Admin operations (IP whitelisted)

### Backward Compatibility

Legacy routes without versioning (`/api/*`) are still supported but deprecated. They will be removed in a future version.

## IP Whitelisting/Blacklisting

IP filtering is implemented using the `express-ipfilter` package, which provides standard IP-based access control with CIDR support.

### IP Blacklist

Block specific IPs or CIDR ranges globally:

```bash
# .env
IP_BLACKLIST=192.168.1.100,10.0.0.0/8,172.16.0.0/12
```

### Admin IP Whitelist

Restrict admin endpoints to specific IPs:

```bash
# .env
ADMIN_IP_WHITELIST=203.0.113.0/24,198.51.100.50
```

### CIDR Support

Both whitelist and blacklist support CIDR notation:

- Single IP: `192.168.1.100`
- CIDR range: `192.168.1.0/24`

### Localhost

Localhost (`127.0.0.1`, `::1`) is allowed by default in non-production environments.

## Rate Limiting

Rate limiting is implemented using the `express-rate-limit` package, the industry standard for Express applications. It supports both in-memory and Redis-backed stores for distributed systems.

### Configuration

Rate limiters are pre-configured for different endpoints:

- **General**: 120 requests per minute
- **Auth**: 10 attempts per hour
- **Trading**: 20 trades per minute
- **Comments**: 5 comments per minute
- **Withdrawals**: 5 withdrawals per hour
- **Market Creation**: 10 markets per hour

### Redis Support

For production deployments with multiple servers, configure Redis for centralized rate limiting:

```bash
# .env
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
```

If Redis is not configured, the system falls back to in-memory rate limiting (works for single-server deployments).

## Environment Variables

Add these to your `.env` file:

```bash
# CSRF Protection
CSRF_SECRET=<random-32-byte-hex-string>  # Auto-generated if not set

# IP Filtering
IP_BLACKLIST=192.168.1.100,10.0.0.0/8
ADMIN_IP_WHITELIST=203.0.113.0/24

# Rate Limiting (optional - for distributed systems)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS Secrets Manager (optional)
AWS_SECRETS_MANAGER_ENABLED=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# HashiCorp Vault (optional)
VAULT_ENABLED=false
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=

# Proxy Configuration (if behind load balancer)
TRUST_PROXY=1  # Set to false to disable proxy trust
```

## Security Best Practices

1. **Always use HTTPS in production** - The app redirects HTTP to HTTPS automatically
2. **Rotate secrets regularly** - Change JWT secrets, encryption passwords periodically
3. **Monitor IP blacklist** - Regularly review and update blocked IPs
4. **Use secrets manager in production** - Don't store secrets in environment variables in production
5. **Keep dependencies updated** - Run `npm audit` regularly and update packages
6. **Enable rate limiting** - Already configured, but review limits based on your needs
7. **Monitor admin access** - Review admin IP whitelist regularly
8. **CSRF tokens** - Always include CSRF tokens in state-changing requests

## Testing Security Features

### Test CSRF Protection

```bash
# This should fail without CSRF token
curl -X POST http://localhost:5001/api/v1/trade/buy \
  -H "Content-Type: application/json" \
  -d '{"market": "..."}'

# Get CSRF token first
curl http://localhost:5001/api/csrf-token -c cookies.txt

# Then use token (token will be in cookies.txt)
curl -X POST http://localhost:5001/api/v1/trade/buy \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-response>" \
  -b cookies.txt \
  -d '{"market": "..."}'
```

### Test IP Filtering

```bash
# Add your IP to blacklist in .env
IP_BLACKLIST=127.0.0.1

# Restart server and try accessing any endpoint
curl http://localhost:5001/health
# Should return 403 Forbidden
```

## Troubleshooting

### CSRF Token Errors

- Ensure cookies are enabled in your client
- Check that `credentials: 'include'` is set in fetch requests
- Verify the token is included in the `X-CSRF-Token` header
- Make sure the cookie and header tokens match

### IP Filtering Issues

- Check IP format (single IP or CIDR notation)
- Verify localhost is allowed in development
- Check proxy headers (`X-Forwarded-For`, `X-Real-IP`) if behind a load balancer

### Secrets Manager Errors

- Verify AWS credentials are correct
- Check IAM permissions for Secrets Manager
- Ensure secret names match exactly
- Check region configuration
