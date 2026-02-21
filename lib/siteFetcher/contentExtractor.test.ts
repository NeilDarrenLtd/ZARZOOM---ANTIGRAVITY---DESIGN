/**
 * Tests for HTML content extraction
 */

import { describe, it, expect } from "@jest/globals";
import { extractContent, truncateText } from "./contentExtractor";

describe("Content Extractor", () => {
  describe("extractContent", () => {
    it("should extract title from <title> tag", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page Title</title></head>
          <body>Content here</body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.title).toBe("Test Page Title");
    });

    it("should extract title from og:title meta tag", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Open Graph Title" />
          </head>
          <body>Content here</body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.title).toBe("Open Graph Title");
    });

    it("should extract description from meta tag", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="description" content="This is a test description" />
          </head>
          <body>Content here</body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.description).toBe("This is a test description");
    });

    it("should extract description from og:description", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:description" content="OG description" />
          </head>
          <body>Content here</body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.description).toBe("OG description");
    });

    it("should strip HTML tags from text content", () => {
      const html = `
        <html>
          <body>
            <p>This is a <strong>paragraph</strong> with <a href="#">links</a>.</p>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toContain("This is a paragraph with links.");
      expect(result.text).not.toContain("<strong>");
      expect(result.text).not.toContain("<a href");
    });

    it("should remove script tags and their content", () => {
      const html = `
        <html>
          <body>
            <p>Visible text</p>
            <script>alert('hidden');</script>
            <p>More visible text</p>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toContain("Visible text");
      expect(result.text).not.toContain("alert");
      expect(result.text).not.toContain("hidden");
    });

    it("should remove style tags and their content", () => {
      const html = `
        <html>
          <body>
            <style>.test { color: red; }</style>
            <p>Visible text</p>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toContain("Visible text");
      expect(result.text).not.toContain("color: red");
    });

    it("should extract links from <a> tags", () => {
      const html = `
        <html>
          <body>
            <a href="https://example.com/page1">Link 1</a>
            <a href="/page2">Link 2</a>
            <a href="page3">Link 3</a>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com/");
      expect(result.links).toContain("https://example.com/page1");
      expect(result.links).toContain("https://example.com/page2");
      expect(result.links).toContain("https://example.com/page3");
    });

    it("should skip invalid links", () => {
      const html = `
        <html>
          <body>
            <a href="#">Hash link</a>
            <a href="javascript:alert(1)">JS link</a>
            <a href="mailto:test@example.com">Email</a>
            <a href="tel:555-1234">Phone</a>
            <a href="https://example.com/valid">Valid link</a>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.links).toHaveLength(1);
      expect(result.links[0]).toBe("https://example.com/valid");
    });

    it("should remove duplicate links", () => {
      const html = `
        <html>
          <body>
            <a href="/page1">Link 1</a>
            <a href="/page1">Link 1 again</a>
            <a href="/page2">Link 2</a>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.links).toHaveLength(2);
    });

    it("should count words correctly", () => {
      const html = `
        <html>
          <body>
            <p>This is a test with ten words in it.</p>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.wordCount).toBe(10);
    });

    it("should prioritize <main> tag content", () => {
      const html = `
        <html>
          <body>
            <nav>Navigation content</nav>
            <main>Main content here</main>
            <footer>Footer content</footer>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toBe("Main content here");
      expect(result.text).not.toContain("Navigation");
      expect(result.text).not.toContain("Footer");
    });

    it("should prioritize <article> tag if no <main>", () => {
      const html = `
        <html>
          <body>
            <nav>Navigation content</nav>
            <article>Article content here</article>
            <footer>Footer content</footer>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toBe("Article content here");
    });

    it("should decode HTML entities", () => {
      const html = `
        <html>
          <body>
            <p>Test &amp; example &lt;with&gt; entities &quot;here&quot;</p>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toContain('Test & example <with> entities "here"');
    });

    it("should collapse whitespace", () => {
      const html = `
        <html>
          <body>
            <p>Text   with    multiple     spaces</p>
          </body>
        </html>
      `;
      const result = extractContent(html, "https://example.com");
      expect(result.text).toBe("Text with multiple spaces");
    });
  });

  describe("truncateText", () => {
    it("should not truncate text shorter than max length", () => {
      const text = "Short text";
      expect(truncateText(text, 100)).toBe("Short text");
    });

    it("should truncate at sentence boundary when possible", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const result = truncateText(text, 30);
      expect(result).toBe("First sentence.");
    });

    it("should truncate at word boundary if no sentence boundary", () => {
      const text = "This is a very long text without any punctuation marks at all";
      const result = truncateText(text, 30);
      expect(result.endsWith("...")).toBe(true);
      expect(result.length).toBeLessThanOrEqual(34); // 30 + "..."
    });

    it("should handle text with question marks", () => {
      const text = "What is this? Another sentence here.";
      const result = truncateText(text, 20);
      expect(result).toBe("What is this?");
    });

    it("should handle text with exclamation marks", () => {
      const text = "Wow! Another sentence here.";
      const result = truncateText(text, 10);
      expect(result).toBe("Wow!");
    });

    it("should not break in middle of sentence if too close", () => {
      const text = "A. Very long text that needs truncation";
      const result = truncateText(text, 30);
      // Should not stop at "A." since it's too early
      expect(result).not.toBe("A.");
      expect(result.endsWith("...")).toBe(true);
    });
  });
});
