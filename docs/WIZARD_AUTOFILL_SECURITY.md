# Wizard Autofill Security & Performance Hardening

This document describes the security and performance measures implemented for the wizard autofill feature.

## Table of Contents

- [Rate Limiting](#rate-limiting)
- [Caching](#caching)
- [SSRF Protection](#ssrf-protection)
- [Audit Logging](#audit-logging)
- [File Upload Security](#file-upload-security)
- [Monitoring](#monitoring)

---

## Rate Limiting

### Implementation

The wizard autofill feature implements per-user, per-endpoint rate limiting using an in-memory sliding window algorithm.

**Configuration:**

```typescript
// lib/security/rateLimiter.ts
export const RATE_LIMIT_CONFIGS = {
  WEBSITE_AUTOFILL: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  FILE_AUTOFILL: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  FILE_UPLOAD: {
    maxRequests: 10,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
};
```

### Endpoints Protected

1. **`POST /api/v1/onboarding/autofill/website`** - 5 requests per 10 minutes
2. **`POST /api/v1/onboarding/autofill/file`** - 5 requests per 10 minutes
3. **`POST /api/v1/onboarding/upload-file`** - 10 requests per 10 minutes

### Response Format

When rate limit is exceeded, endpoints return:

```json
{
  "status": "fail",
  "message": "Too many requests",
  "error": "You've reached the limit of 5 website analyses per 10 minutes. Please try again in 8 minutes.",
  "resetAt": "2024-01-15T10:30:00.000Z"
}
```

**Status Code:** `429 Too Many Requests`

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets

### How It Works

1. **Key Generation:** `ratelimit:{userId}:{endpoint}`
2. **Sliding Window:** Tracks request count and window start time
3. **Automatic Cleanup:** Expired entries removed every 60 seconds
4. **Memory Efficient:** Uses Map-based storage with automatic eviction

### Admin Override

To reset a rate limit for a specific user (admin-only):

```typescript
import { resetRateLimit } from "@/lib/security/rateLimiter";

// Reset website autofill limit for user
resetRateLimit(userId, "website-autofill");
```

---

## Caching

### Implementation

Website analysis results are cached per user + URL combination to avoid repeated crawls and OpenRouter API calls.

**Configuration:**

```typescript
// lib/security/analysisCache.ts
const websiteAnalysisCache = new LRUCache<any>(100, 15 * 60 * 1000);
// Max 100 entries, 15 minute TTL
```

### Cache Strategy

1. **Key Format:** `website:{userId}:{normalizedUrl}`
2. **URL Normalization:** Strips query parameters and fragments
3. **LRU Eviction:** Least recently used entries removed when cache is full
4. **TTL:** 15 minutes (configurable)
5. **Automatic Cleanup:** Expired entries removed every 5 minutes

### When Cache is Used

- **Cache Hit:** Returns cached result immediately with `"cached": true` flag
- **Cache Miss:** Fetches website, analyzes with AI, caches result, returns to user

### Cache Hit Example

```json
{
  "status": "success",
  "message": "Successfully extracted all available information from the website.",
  "fieldsPopulated": 8,
  "confidence": { "brand": 0.95, "goals": 0.80 },
  "processingTime": 5234,
  "cached": true
}
```

### Why Not Cache Files?

File analysis is NOT cached because:
- Files are ephemeral (uploaded once, analyzed once)
- Storage path includes user ID + UUID (unique per upload)
- Less benefit vs. complexity
- Users can re-upload if needed

### Cache Management

Get cache statistics:

```typescript
import { getAnalysisCacheStats } from "@/lib/security/analysisCache";

const stats = getAnalysisCacheStats();
// { size: 42, maxSize: 100, ttlMs: 900000 }
```

Clear cache for specific URL:

```typescript
import { clearWebsiteCache } from "@/lib/security/analysisCache";

clearWebsiteCache(userId, url);
```

---

## SSRF Protection

### Server-Side URL Validation

All URLs are validated server-side using the `validateURL()` function from `lib/siteFetcher/urlValidator.ts`.

**Protections:**

1. **Protocol Validation:** Only `http://` and `https://` allowed
2. **Private IP Blocking:**
   - `10.0.0.0/8` (RFC 1918)
   - `172.16.0.0/12` (RFC 1918)
   - `192.168.0.0/16` (RFC 1918)
   - `127.0.0.0/8` (Loopback)
   - `169.254.0.0/16` (Link-local)
   - `0.0.0.0` and `255.255.255.255`
3. **IPv6 Private Ranges:**
   - `::1` (Loopback)
   - `fe80::/10` (Link-local)
   - `fc00::/7` and `fd00::/8` (Unique local)
   - `ff00::/8` (Multicast)
4. **Localhost Blocking:** `localhost`, `0.0.0.0`
5. **DNS Rebinding Protection:** Validates after DNS resolution
6. **Credential Stripping:** Blocks URLs with embedded credentials

### Implementation

```typescript
// In /api/v1/onboarding/autofill/website/route.ts
try {
  validateURL(url);
  console.log(`[v0] URL passed SSRF validation: ${url}`);
} catch (ssrfError: any) {
  await logAutofillAudit(
    supabase,
    userId,
    "website",
    url,
    "fail",
    `SSRF blocked: ${ssrfError.message}`
  );

  return NextResponse.json(
    {
      status: "fail",
      message: "Invalid or blocked URL",
      error: "This URL cannot be accessed for security reasons.",
    },
    { status: 422 }
  );
}
```

### Error Response

```json
{
  "status": "fail",
  "message": "Invalid or blocked URL",
  "error": "This URL cannot be accessed for security reasons. Private IPs, localhost, and internal networks are not allowed."
}
```

**Status Code:** `422 Unprocessable Entity`

### Testing SSRF Protection

The URL validator includes comprehensive tests:

```bash
npm test -- urlValidator.test.ts
```

Tests cover:
- ✅ Private IPv4 ranges
- ✅ Private IPv6 ranges
- ✅ Localhost variants
- ✅ Link-local addresses
- ✅ Embedded credentials
- ✅ DNS rebinding scenarios

---

## Audit Logging

### What is Logged

All autofill attempts (success, partial, fail) are logged to the `wizard_autofill_audit` table.

**Schema:**

```sql
CREATE TABLE wizard_autofill_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  source_type text NOT NULL CHECK (source_type IN ('website', 'file')),
  source_value text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'fail')),
  error_message text,
  fields_populated integer DEFAULT 0,
  confidence_scores jsonb,
  created_at timestamptz DEFAULT now()
);
```

### Secret Sanitization

Error messages are automatically sanitized to prevent logging secrets:

```typescript
// Patterns removed from error messages:
- api_key=xxx → api_key=[REDACTED]
- bearer xxx → bearer [REDACTED]
- token=xxx → token=[REDACTED]
- password=xxx → password=[REDACTED]
- secret=xxx → secret=[REDACTED]
```

Error messages are also truncated to 500 characters maximum.

### URL Sanitization

Website URLs have query parameters stripped before logging:

```typescript
// Original: https://example.com/page?api_key=secret&token=xyz
// Logged:   https://example.com/page
```

This prevents PII and tokens in query strings from being logged.

### Audit Log Examples

**Success:**

```json
{
  "user_id": "uuid",
  "source_type": "website",
  "source_value": "https://example.com",
  "status": "success",
  "error_message": null,
  "fields_populated": 8,
  "confidence_scores": { "brand": 0.95, "goals": 0.80 },
  "created_at": "2024-01-15T10:15:00Z"
}
```

**Partial:**

```json
{
  "user_id": "uuid",
  "source_type": "file",
  "source_value": "brand-guidelines.pdf",
  "status": "partial",
  "error_message": null,
  "fields_populated": 5,
  "confidence_scores": { "brand": 0.85 },
  "created_at": "2024-01-15T10:20:00Z"
}
```

**Failure:**

```json
{
  "user_id": "uuid",
  "source_type": "website",
  "source_value": "https://example.com",
  "status": "fail",
  "error_message": "SSRF blocked: Private IP address detected",
  "fields_populated": 0,
  "confidence_scores": null,
  "created_at": "2024-01-15T10:25:00Z"
}
```

### Querying Audit Logs (Admin)

```sql
-- Recent failures
SELECT * FROM wizard_autofill_audit
WHERE status = 'fail'
ORDER BY created_at DESC
LIMIT 50;

-- User's autofill history
SELECT * FROM wizard_autofill_audit
WHERE user_id = 'uuid'
ORDER BY created_at DESC;

-- Success rate by source type
SELECT 
  source_type,
  status,
  COUNT(*) as count
FROM wizard_autofill_audit
GROUP BY source_type, status;
```

---

## File Upload Security

### Validation Layers

**1. Client-Side (Pre-Upload):**
- File type: PDF, DOC, DOCX only
- Max size: 10MB
- Immediate feedback to user

**2. Server-Side (API):**
- MIME type validation
- File size verification
- Magic number verification (file header check)
- Rate limiting (10 uploads per 10 minutes)

**3. Storage Layer (Supabase RLS):**
- Files stored in private `wizard-uploads` bucket
- User can only access their own files
- Files stored in user-specific folders: `{userId}/filename`

### File Upload Flow

```
1. User selects file → Client validation
2. Upload to /api/v1/onboarding/upload-file
3. Authenticate user
4. Check rate limit
5. Validate file (type, size, magic number)
6. Upload to Supabase Storage (wizard-uploads bucket)
7. Extract text content (PDF/DOC/DOCX parsing)
8. Return storage path + extracted text
9. Client calls /api/v1/onboarding/autofill/file
10. Verify file ownership via RLS
11. Analyze with OpenRouter
12. Persist results
```

### File Size Limits

- **Upload:** 10MB max (enforced at API level)
- **Text Extraction:** 50,000 characters max (truncated if longer)
- **OpenRouter Analysis:** 30,000 characters max (truncated if longer)

### File Storage Policy

**RLS Policy:**

```sql
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'wizard-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

Users can ONLY upload to `wizard-uploads/{their_user_id}/`.

---

## Monitoring

### Rate Limiter Stats

```typescript
import { getRateLimiterStats } from "@/lib/security/rateLimiter";

const stats = getRateLimiterStats();
// { totalKeys: 42, memoryUsage: 12345678 }
```

### Cache Stats

```typescript
import { getAnalysisCacheStats } from "@/lib/security/analysisCache";

const stats = getAnalysisCacheStats();
// { size: 42, maxSize: 100, ttlMs: 900000 }
```

### Key Metrics to Monitor

1. **Rate Limit Hits:** How often users hit the limit (429 responses)
2. **Cache Hit Rate:** Percentage of requests served from cache
3. **SSRF Blocks:** Failed URL validations
4. **Analysis Success Rate:** Success vs. partial vs. fail
5. **Processing Times:** API latency and OpenRouter response time
6. **Memory Usage:** Rate limiter and cache memory consumption

### Logging

All security events are logged with `[v0]` prefix:

```
[v0] Rate limit exceeded for user {userId}
[v0] URL passed SSRF validation: {url}
[v0] SSRF validation failed for {url}: Private IP detected
[v0] Returning cached result for {url}
[v0] Cached result for {url}
```

### Alerts to Configure

1. **High 429 Rate:** More than 10% of requests rate limited
2. **SSRF Attempts:** Multiple SSRF blocks from same user/IP
3. **Analysis Failures:** High failure rate (>20%)
4. **Memory Growth:** Rate limiter or cache consuming excessive memory

---

## Security Best Practices

### For Developers

1. **Never log secrets:** Use sanitized error messages
2. **Validate server-side:** Don't trust client validation alone
3. **Test SSRF protection:** Run tests before deploying changes
4. **Monitor rate limits:** Adjust limits based on usage patterns
5. **Review audit logs:** Check for suspicious activity regularly

### For Admins

1. **Set appropriate rate limits:** Balance UX vs. abuse prevention
2. **Monitor failed attempts:** Look for patterns of abuse
3. **Review SSRF blocks:** Legitimate users may hit false positives
4. **Configure alerts:** Get notified of security events
5. **Regular audits:** Review logs and metrics monthly

---

## Configuration Reference

### Rate Limits (Adjustable)

Edit `lib/security/rateLimiter.ts`:

```typescript
export const RATE_LIMIT_CONFIGS = {
  WEBSITE_AUTOFILL: {
    maxRequests: 5,        // Adjust based on usage
    windowMs: 10 * 60 * 1000,
  },
  FILE_AUTOFILL: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
  },
  FILE_UPLOAD: {
    maxRequests: 10,       // More lenient for uploads
    windowMs: 10 * 60 * 1000,
  },
};
```

### Cache Settings (Adjustable)

Edit `lib/security/analysisCache.ts`:

```typescript
const websiteAnalysisCache = new LRUCache<any>(
  100,              // Max entries
  15 * 60 * 1000    // TTL in milliseconds
);
```

### File Size Limits (Adjustable)

Edit `lib/fileExtractor/index.ts`:

```typescript
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

---

## Future Enhancements

### Considered for Future Implementation

1. **Redis-based rate limiting:** For multi-instance deployments
2. **Distributed caching:** Redis/Memcached for cache sharing
3. **IP-based rate limiting:** Additional protection for unauthenticated endpoints
4. **Anomaly detection:** ML-based abuse detection
5. **Honeypot tokens:** Detect credential scanning attempts
6. **Content Security Policy:** Additional client-side protections

### Why Not Implemented Now

- **Redis:** Adds infrastructure complexity, in-memory sufficient for MVP
- **IP limiting:** Would need reverse proxy awareness (X-Forwarded-For)
- **ML detection:** Requires baseline data and ongoing training
- **CSP:** Frontend already has basic protections

---

## Troubleshooting

### "Too many requests" errors

**Cause:** User exceeded rate limit (5 requests per 10 minutes)

**Solution:**
1. Wait for rate limit window to reset (check `resetAt` timestamp)
2. Admin can manually reset: `resetRateLimit(userId, endpoint)`
3. Adjust rate limits if legitimate users are affected

### "Invalid or blocked URL" errors

**Cause:** SSRF protection blocked the URL

**Common reasons:**
- Private IP address (192.168.x.x, 10.x.x.x)
- Localhost or 127.0.0.1
- Link-local address (169.254.x.x)
- URL contains credentials (http://user:pass@example.com)

**Solution:**
1. Ensure URL is publicly accessible
2. Remove any credentials from URL
3. Check DNS resolution (may resolve to private IP)

### Cache serving stale data

**Cause:** Analysis cached for 15 minutes

**Solution:**
1. Wait 15 minutes for cache to expire
2. Admin can clear cache: `clearWebsiteCache(userId, url)`
3. User can use a different URL (e.g., add /about)

---

## Summary

The wizard autofill feature implements multiple layers of security:

✅ **Rate limiting** prevents abuse (5 requests per 10 min per endpoint)  
✅ **Caching** improves performance and reduces costs  
✅ **SSRF protection** blocks access to private networks  
✅ **Audit logging** tracks all attempts with sanitized errors  
✅ **File validation** ensures only safe files are processed  
✅ **RLS policies** enforce data isolation at database level  

These measures ensure the feature is both secure and performant while providing a good user experience.
