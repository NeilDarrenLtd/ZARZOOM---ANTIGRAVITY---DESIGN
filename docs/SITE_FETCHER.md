# Site Fetcher - SSRF-Safe Website Content Extraction

A secure, lightweight website content fetcher for the wizard auto-fill feature. Includes comprehensive SSRF (Server-Side Request Forgery) protection.

## Features

### Security (SSRF Protection)

- ✅ **Protocol validation** - Only allows `http://` and `https://`
- ✅ **Localhost blocking** - Blocks all localhost variations
- ✅ **Private IP blocking** - Blocks RFC 1918 ranges (10/8, 172.16/12, 192.168/16)
- ✅ **Link-local blocking** - Blocks 169.254/16 and fe80::/10
- ✅ **Loopback blocking** - Blocks 127.0.0.0/8 and ::1
- ✅ **IPv6 ULA blocking** - Blocks fc00::/7 unique local addresses
- ✅ **Credential blocking** - Rejects URLs with embedded credentials
- ✅ **Redirect limits** - Caps maximum redirects
- ✅ **Size limits** - Caps bytes per page and total bytes
- ✅ **Timeout protection** - Enforces fetch timeouts

### Content Extraction

- 📄 **Smart crawling** - Prioritizes `/about`, `/features`, `/pricing`, etc.
- 🎯 **Main content focus** - Extracts from `<main>`, `<article>`, or `<body>`
- 🧹 **Boilerplate removal** - Strips nav, header, footer, scripts, styles
- 🔗 **Link discovery** - Finds and prioritizes internal links
- 📊 **Metadata extraction** - Title, description, word counts
- ⚡ **Fast & deterministic** - Timeouts and page limits

## Installation

The site fetcher is already installed. No additional dependencies needed.

## Usage

### Basic Usage

```typescript
import { fetchSiteContent } from "@/lib/siteFetcher";

// Fetch website content
const result = await fetchSiteContent("https://example.com");

console.log(`Fetched ${result.totalPages} pages`);
console.log(`Total words: ${result.totalWords}`);
console.log(`Combined text length: ${result.combinedText.length}`);

// Access individual pages
result.pages.forEach((page) => {
  console.log(`${page.title} - ${page.wordCount} words`);
  console.log(page.textSnippet);
});
```

### With Options

```typescript
import { fetchSiteContent } from "@/lib/siteFetcher";

const result = await fetchSiteContent("https://example.com", {
  maxPages: 8, // Fetch up to 8 pages (default: 6)
  maxBytesPerPage: 1_000_000, // 1MB per page (default: 500KB)
  maxTotalBytes: 5_000_000, // 5MB total (default: 2MB)
  timeout: 15_000, // 15 seconds per page (default: 10s)
  snippetLength: 1000, // Longer snippets (default: 500)
});
```

### Safe Fetch (Returns null on error)

```typescript
import { safeFetchSiteContent } from "@/lib/siteFetcher";

const result = await safeFetchSiteContent("https://example.com");

if (!result) {
  console.error("Failed to fetch site content");
  return;
}

// Use result...
```

### URL Validation Only

```typescript
import { validateURL, URLValidationError } from "@/lib/siteFetcher";

try {
  const validated = validateURL("https://example.com");
  console.log("URL is safe:", validated.hostname);
} catch (error) {
  if (error instanceof URLValidationError) {
    console.error(`Validation failed: ${error.message}`);
    console.error(`Error code: ${error.code}`);
  }
}
```

## API Reference

### `fetchSiteContent(url, options?)`

Fetches and extracts content from a website.

**Parameters:**
- `url` (string) - The website URL to fetch
- `options` (SiteFetcherOptions, optional) - Fetch options

**Returns:** `Promise<SiteFetchResult>`

**Throws:** `URLValidationError` if URL fails SSRF checks

### `safeFetchSiteContent(url, options?)`

Safe version that returns null on error instead of throwing.

**Returns:** `Promise<SiteFetchResult | null>`

### `validateURL(url)`

Validates a URL with SSRF protection.

**Parameters:**
- `url` (string) - The URL to validate

**Returns:** `ValidatedURL`

**Throws:** `URLValidationError` with specific error codes

### Types

#### `SiteFetchResult`

```typescript
interface SiteFetchResult {
  pages: FetchedPage[];         // Array of fetched pages
  combinedText: string;          // All page content combined
  discoveredUrls: string[];      // All discovered URLs
  baseUrl: string;               // Original base URL
  totalPages: number;            // Number of pages fetched
  totalWords: number;            // Total word count
  errorPages: string[];          // URLs that failed to fetch
}
```

#### `FetchedPage`

```typescript
interface FetchedPage {
  url: string;                   // Page URL
  title: string | null;          // Page title
  description: string | null;    // Meta description
  textSnippet: string;           // Truncated text preview
  fullText: string;              // Full extracted text
  wordCount: number;             // Word count
  fetchedAt: string;             // ISO timestamp
}
```

#### `SiteFetcherOptions`

```typescript
interface SiteFetcherOptions {
  maxPages?: number;             // Max pages to fetch (default: 6)
  maxBytesPerPage?: number;      // Max bytes per page (default: 500KB)
  maxTotalBytes?: number;        // Max total bytes (default: 2MB)
  timeout?: number;              // Timeout per page in ms (default: 10s)
  maxRedirects?: number;         // Max redirects (default: 3)
  snippetLength?: number;        // Snippet truncation length (default: 500)
  userAgent?: string;            // User agent string
}
```

#### `URLValidationError`

```typescript
class URLValidationError extends Error {
  code: string; // Error code for programmatic handling
}
```

**Error Codes:**
- `INVALID_URL_FORMAT` - Malformed URL
- `INVALID_PROTOCOL` - Not http/https
- `LOCALHOST_BLOCKED` - Localhost access blocked
- `PRIVATE_IP_BLOCKED` - Private IP address blocked
- `CREDENTIALS_IN_URL` - URL contains embedded credentials

## Security Guidelines

### Blocked URLs

The following types of URLs are **automatically blocked**:

**Localhost:**
```
http://localhost
http://127.0.0.1
http://[::1]
http://test.localhost
```

**Private Networks:**
```
http://10.0.0.1          (10.0.0.0/8)
http://172.16.0.1        (172.16.0.0/12)
http://192.168.1.1       (192.168.0.0/16)
http://169.254.169.254   (AWS metadata - 169.254.0.0/16)
```

**IPv6 Private:**
```
http://[fe80::1]         (Link-local)
http://[fc00::1]         (Unique local)
http://[ff00::1]         (Multicast)
```

**Other:**
```
ftp://example.com        (Non-HTTP protocol)
file:///etc/passwd       (File protocol)
http://user:pass@site    (Embedded credentials)
```

### Allowed URLs

Only public HTTP/HTTPS URLs are allowed:

```
https://example.com
https://www.company.com/about
http://93.184.216.34     (Public IP)
https://api.service.com
```

### Best Practices

1. **Always validate user input** - Never trust URLs from users directly
2. **Use `safeFetchSiteContent()`** - For better error handling
3. **Set reasonable limits** - Don't fetch too many pages
4. **Handle errors gracefully** - Display user-friendly error messages
5. **Monitor usage** - Track failed attempts for security monitoring

## Page Prioritization

The fetcher automatically prioritizes pages likely to contain useful brand information:

**High Priority Paths:**
- `/about`, `/about-us`
- `/team`, `/company`
- `/mission`, `/values`, `/story`
- `/features`, `/services`, `/products`
- `/pricing`, `/plans`
- `/contact`, `/blog`

**Priority Score Formula:**
1. Homepage (`/`) = highest priority (1000 points)
2. Priority keywords in path = +100 points
3. Exact match (e.g., `/about`) = +50 bonus points
4. Deep paths = -10 points per level
5. Query parameters = -20 points

## Content Extraction Strategy

### 1. Metadata Extraction
- Page title from `<title>` or `og:title`
- Description from `<meta name="description">` or `og:description`

### 2. Main Content Extraction
Priority order:
1. Content inside `<main>` tag
2. Content inside `<article>` tag
3. Content inside `<body>` with boilerplate removed

### 3. Boilerplate Removal
Automatically strips:
- `<script>` and `<style>` tags
- `<nav>`, `<header>`, `<footer>` elements
- `<aside>` and `<form>` elements
- HTML comments

### 4. Text Cleaning
- Strips all HTML tags
- Decodes HTML entities (`&amp;` → `&`)
- Collapses whitespace
- Trims leading/trailing space

## Testing

The site fetcher includes comprehensive test coverage:

```bash
npm test lib/siteFetcher/urlValidator.test.ts
npm test lib/siteFetcher/contentExtractor.test.ts
```

### Test Coverage

**URL Validator:**
- ✅ Valid HTTP/HTTPS URLs
- ✅ Invalid protocols (ftp, file, javascript, data)
- ✅ Localhost blocking (all variations)
- ✅ Private IPv4 ranges (10/8, 172.16/12, 192.168/16, 169.254/16)
- ✅ Private IPv6 ranges (::1, fe80::/10, fc00::/7, ff00::/8)
- ✅ Credentials blocking
- ✅ Public IP allowance
- ✅ URL normalization

**Content Extractor:**
- ✅ Title extraction
- ✅ Description extraction
- ✅ HTML tag stripping
- ✅ Script/style removal
- ✅ Link extraction
- ✅ Entity decoding
- ✅ Main content prioritization
- ✅ Word counting

## Performance

### Typical Performance
- **Single page fetch:** 200-500ms
- **6 pages (default):** 1-3 seconds
- **8 pages (max recommended):** 2-4 seconds

### Optimization Tips

1. **Reduce `maxPages`** - Fewer pages = faster
2. **Increase `timeout`** - For slow sites, but carefully
3. **Use smaller `snippetLength`** - If you only need previews
4. **Cache results** - Store in database to avoid refetching

## Troubleshooting

### Common Issues

**"Validation failed: Localhost URLs are not allowed"**
- You're trying to fetch from localhost
- Use a public URL or disable validation in development (not recommended)

**"Failed to fetch: timeout"**
- The website is slow or unresponsive
- Increase the `timeout` option
- Check if the site blocks bots (User-Agent)

**"No pages fetched"**
- The website might be blocking the user agent
- Try a different `userAgent` option
- Check if the site requires authentication

**"Fetched 0 words"**
- The page might be JavaScript-rendered (SPA)
- This fetcher only handles server-rendered HTML
- Consider using a headless browser for SPAs

## Integration Example

### In API Route Handler

```typescript
import { fetchSiteContent, URLValidationError } from "@/lib/siteFetcher";

export async function POST(request: Request) {
  const { url } = await request.json();

  try {
    const result = await fetchSiteContent(url, {
      maxPages: 5,
      timeout: 8000,
    });

    return Response.json({
      success: true,
      data: {
        pages: result.totalPages,
        words: result.totalWords,
        content: result.combinedText,
      },
    });
  } catch (error) {
    if (error instanceof URLValidationError) {
      return Response.json(
        { error: "Invalid URL", details: error.message },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
```

## License

Part of the ZARZOOM project.
