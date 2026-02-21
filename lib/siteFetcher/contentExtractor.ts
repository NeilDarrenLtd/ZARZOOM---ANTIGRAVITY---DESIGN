/**
 * HTML content extraction utilities
 * Extracts readable text and metadata from HTML without external dependencies
 */

export interface ExtractedContent {
  title: string | null;
  description: string | null;
  text: string;
  links: string[];
  wordCount: number;
}

/**
 * Strip HTML tags and decode entities
 */
function stripHTMLTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract text content from specific HTML tag
 */
function extractTagContent(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(regex);
  if (match && match[1]) {
    return stripHTMLTags(match[1]).trim();
  }
  return null;
}

/**
 * Extract meta tag content
 */
function extractMetaContent(html: string, name: string): string | null {
  // Try name attribute
  let regex = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  let match = html.match(regex);
  if (match && match[1]) return match[1];

  // Try property attribute (for Open Graph tags)
  regex = new RegExp(
    `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  match = html.match(regex);
  if (match && match[1]) return match[1];

  // Try reversed order (content before name)
  regex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
    "i"
  );
  match = html.match(regex);
  if (match && match[1]) return match[1];

  return null;
}

/**
 * Extract all links from HTML
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]*href=["']([^"']*)["']/gi;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    try {
      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl).toString();
      links.push(absoluteUrl);
    } catch {
      // Skip invalid URLs
    }
  }

  return [...new Set(links)]; // Remove duplicates
}

/**
 * Remove navigation, footer, and other non-content sections
 */
function removeBoilerplate(html: string): string {
  return html
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

/**
 * Extract main content text from HTML
 * Prioritizes <main>, <article>, or falls back to <body>
 */
function extractMainContent(html: string): string {
  // Try <main> first
  let content = extractTagContent(html, "main");
  if (content && content.length > 100) return content;

  // Try <article>
  content = extractTagContent(html, "article");
  if (content && content.length > 100) return content;

  // Fall back to body with boilerplate removed
  const cleanedHTML = removeBoilerplate(html);
  content = extractTagContent(cleanedHTML, "body");
  if (content) return content;

  // Last resort: strip all tags
  return stripHTMLTags(html);
}

/**
 * Extract structured content from HTML
 */
export function extractContent(html: string, url: string): ExtractedContent {
  // Extract title
  let title = extractTagContent(html, "title");
  if (!title) {
    title = extractMetaContent(html, "og:title");
  }

  // Extract description
  let description = extractMetaContent(html, "description");
  if (!description) {
    description = extractMetaContent(html, "og:description");
  }

  // Extract main text content
  const text = extractMainContent(html);

  // Extract links
  const links = extractLinks(html, url);

  // Count words
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    title,
    description,
    text,
    links,
    wordCount,
  };
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to truncate at sentence boundary
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastExclamation = truncated.lastIndexOf("!");
  
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > maxLength * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }
  
  // Otherwise truncate at word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace).trim() + "...";
  }
  
  return truncated.trim() + "...";
}
