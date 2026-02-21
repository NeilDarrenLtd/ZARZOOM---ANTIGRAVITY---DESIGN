/**
 * SSRF-safe website content fetcher
 * Fetches and extracts content from websites for wizard auto-fill
 */

import { validateURL, normalizeURL, isSameOrigin, URLValidationError } from "./urlValidator";
import { extractContent, truncateText } from "./contentExtractor";

export { URLValidationError } from "./urlValidator";

export interface FetchedPage {
  url: string;
  title: string | null;
  description: string | null;
  textSnippet: string;
  fullText: string;
  wordCount: number;
  fetchedAt: string;
}

export interface SiteFetchResult {
  pages: FetchedPage[];
  combinedText: string;
  discoveredUrls: string[];
  baseUrl: string;
  totalPages: number;
  totalWords: number;
  errorPages: string[];
}

export interface SiteFetcherOptions {
  maxPages?: number;
  maxBytesPerPage?: number;
  maxTotalBytes?: number;
  timeout?: number;
  maxRedirects?: number;
  snippetLength?: number;
  userAgent?: string;
}

const DEFAULT_OPTIONS: Required<SiteFetcherOptions> = {
  maxPages: 6,
  maxBytesPerPage: 500_000, // 500KB per page
  maxTotalBytes: 2_000_000, // 2MB total
  timeout: 10_000, // 10 seconds
  maxRedirects: 3,
  snippetLength: 500,
  userAgent: "ZARZOOM-Wizard-Bot/1.0",
};

/**
 * Priority keywords for page discovery
 * Pages matching these keywords are fetched first
 */
const PRIORITY_KEYWORDS = [
  "about",
  "about-us",
  "team",
  "company",
  "mission",
  "values",
  "story",
  "features",
  "services",
  "products",
  "pricing",
  "plans",
  "contact",
  "blog",
];

/**
 * Calculate priority score for a URL
 */
function calculateURLPriority(url: string): number {
  const urlLower = url.toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();

  let score = 0;

  // Homepage gets highest priority
  if (pathname === "/" || pathname === "") {
    return 1000;
  }

  // Check for priority keywords in path
  for (const keyword of PRIORITY_KEYWORDS) {
    if (pathname.includes(keyword)) {
      score += 100;
      // Exact match gets bonus
      if (pathname === `/${keyword}` || pathname === `/${keyword}/`) {
        score += 50;
      }
      break; // Only count first match
    }
  }

  // Penalize deep paths
  const depth = pathname.split("/").filter((p) => p).length;
  score -= depth * 10;

  // Penalize query parameters
  if (url.includes("?")) {
    score -= 20;
  }

  return score;
}

/**
 * Fetch a single page with safety limits
 */
async function fetchPage(
  url: string,
  options: Required<SiteFetcherOptions>,
  signal: AbortSignal
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    // Combine signals
    signal.addEventListener("abort", () => controller.abort());

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": options.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      next: { revalidate: 0 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[v0] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      console.log(`[v0] Skipping ${url}: not HTML (${contentType})`);
      return null;
    }

    // Check content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > options.maxBytesPerPage) {
      console.log(`[v0] Skipping ${url}: too large (${contentLength} bytes)`);
      return null;
    }

    // Read with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      return null;
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > options.maxBytesPerPage) {
        reader.cancel();
        console.log(`[v0] Truncated ${url}: exceeded ${options.maxBytesPerPage} bytes`);
        break;
      }

      chunks.push(value);
    }

    const html = new TextDecoder().decode(
      new Uint8Array(chunks.flatMap((chunk) => Array.from(chunk)))
    );

    return {
      html,
      finalUrl: response.url,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.log(`[v0] Timeout fetching ${url}`);
    } else {
      console.log(`[v0] Error fetching ${url}:`, (error as Error).message);
    }
    return null;
  }
}

/**
 * Filter and prioritize URLs for crawling
 */
function filterAndPrioritizeURLs(
  urls: string[],
  baseOrigin: string,
  visited: Set<string>
): string[] {
  const candidates: Array<{ url: string; score: number }> = [];

  for (const url of urls) {
    // Normalize URL
    const normalized = normalizeURL(url);

    // Skip if already visited
    if (visited.has(normalized)) continue;

    // Skip if not same origin
    if (!isSameOrigin(baseOrigin, url)) continue;

    // Validate URL (SSRF check)
    try {
      validateURL(url);
    } catch {
      continue;
    }

    // Skip common non-content paths
    const urlLower = url.toLowerCase();
    if (
      urlLower.includes("/wp-admin") ||
      urlLower.includes("/wp-content") ||
      urlLower.includes("/admin") ||
      urlLower.includes("/login") ||
      urlLower.includes("/signup") ||
      urlLower.includes("/cart") ||
      urlLower.includes("/checkout")
    ) {
      continue;
    }

    const score = calculateURLPriority(url);
    candidates.push({ url: normalized, score });
  }

  // Sort by priority score (highest first)
  candidates.sort((a, b) => b.score - a.score);

  return candidates.map((c) => c.url);
}

/**
 * Fetch and extract content from a website
 */
export async function fetchSiteContent(
  url: string,
  options: SiteFetcherOptions = {}
): Promise<SiteFetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate base URL
  const validated = validateURL(url);
  const baseUrl = validated.url.toString();
  const baseOrigin = validated.url.origin;

  // Track state
  const pages: FetchedPage[] = [];
  const visited = new Set<string>();
  const discoveredUrls = new Set<string>();
  const errorPages: string[] = [];
  let totalBytes = 0;

  // Abort controller for global timeout
  const abortController = new AbortController();

  // Queue starting with homepage
  const queue: string[] = [normalizeURL(baseUrl)];

  // Fetch pages
  while (queue.length > 0 && pages.length < opts.maxPages && totalBytes < opts.maxTotalBytes) {
    const currentUrl = queue.shift()!;

    // Skip if already visited
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    console.log(`[v0] Fetching page ${pages.length + 1}/${opts.maxPages}: ${currentUrl}`);

    // Fetch page
    const result = await fetchPage(currentUrl, opts, abortController.signal);

    if (!result) {
      errorPages.push(currentUrl);
      continue;
    }

    const { html, finalUrl } = result;
    totalBytes += html.length;

    // Extract content
    const extracted = extractContent(html, finalUrl);

    // Create page object
    const page: FetchedPage = {
      url: finalUrl,
      title: extracted.title,
      description: extracted.description,
      textSnippet: truncateText(extracted.text, opts.snippetLength),
      fullText: extracted.text,
      wordCount: extracted.wordCount,
      fetchedAt: new Date().toISOString(),
    };

    pages.push(page);

    // Add discovered links to queue (filtered and prioritized)
    for (const link of extracted.links) {
      discoveredUrls.add(link);
    }

    const newUrls = filterAndPrioritizeURLs(
      Array.from(discoveredUrls),
      baseOrigin,
      visited
    );

    // Add to queue (only if we haven't hit limits)
    if (pages.length < opts.maxPages && totalBytes < opts.maxTotalBytes) {
      queue.push(...newUrls.filter((u) => !visited.has(u)));
    }
  }

  // Combine all text
  const combinedText = pages
    .map((p) => {
      let text = "";
      if (p.title) text += `${p.title}\n\n`;
      if (p.description) text += `${p.description}\n\n`;
      text += p.fullText;
      return text;
    })
    .join("\n\n---\n\n");

  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);

  return {
    pages,
    combinedText,
    discoveredUrls: Array.from(discoveredUrls),
    baseUrl,
    totalPages: pages.length,
    totalWords,
    errorPages,
  };
}

/**
 * Fetch website content with error handling
 * Returns null on failure instead of throwing
 */
export async function safeFetchSiteContent(
  url: string,
  options?: SiteFetcherOptions
): Promise<SiteFetchResult | null> {
  try {
    return await fetchSiteContent(url, options);
  } catch (error) {
    console.error("[v0] Site fetch error:", error);
    return null;
  }
}
