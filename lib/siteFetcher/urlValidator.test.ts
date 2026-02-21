/**
 * Tests for URL validator and SSRF protection
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateURL,
  safeValidateURL,
  isSameOrigin,
  normalizeURL,
  URLValidationError,
} from "./urlValidator";

describe("URL Validator - SSRF Protection", () => {
  describe("validateURL", () => {
    it("should accept valid HTTP URLs", () => {
      const result = validateURL("http://example.com");
      expect(result.hostname).toBe("example.com");
      expect(result.protocol).toBe("http:");
    });

    it("should accept valid HTTPS URLs", () => {
      const result = validateURL("https://example.com/path");
      expect(result.hostname).toBe("example.com");
      expect(result.protocol).toBe("https:");
    });

    it("should reject non-HTTP protocols", () => {
      expect(() => validateURL("ftp://example.com")).toThrow(URLValidationError);
      expect(() => validateURL("file:///etc/passwd")).toThrow(URLValidationError);
      expect(() => validateURL("javascript:alert(1)")).toThrow(URLValidationError);
      expect(() => validateURL("data:text/html,<script>alert(1)</script>")).toThrow(
        URLValidationError
      );
    });

    it("should reject malformed URLs", () => {
      expect(() => validateURL("not a url")).toThrow(URLValidationError);
      expect(() => validateURL("htp://example.com")).toThrow(URLValidationError);
      expect(() => validateURL("")).toThrow(URLValidationError);
    });
  });

  describe("SSRF Protection - Localhost", () => {
    it("should block localhost", () => {
      expect(() => validateURL("http://localhost")).toThrow(URLValidationError);
      expect(() => validateURL("https://localhost:3000")).toThrow(URLValidationError);
    });

    it("should block localhost variations", () => {
      expect(() => validateURL("http://LOCALHOST")).toThrow(URLValidationError);
      expect(() => validateURL("http://test.localhost")).toThrow(URLValidationError);
      expect(() => validateURL("http://api.localhost:8080")).toThrow(URLValidationError);
    });

    it("should block 127.0.0.0/8 range", () => {
      expect(() => validateURL("http://127.0.0.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://127.0.0.2:8080")).toThrow(URLValidationError);
      expect(() => validateURL("http://127.1.1.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://127.255.255.255")).toThrow(URLValidationError);
    });

    it("should block IPv6 localhost", () => {
      expect(() => validateURL("http://[::1]")).toThrow(URLValidationError);
      expect(() => validateURL("http://[::1]:8080")).toThrow(URLValidationError);
      expect(() => validateURL("http://[0:0:0:0:0:0:0:1]")).toThrow(URLValidationError);
    });
  });

  describe("SSRF Protection - Private IPv4 Ranges", () => {
    it("should block 10.0.0.0/8 range", () => {
      expect(() => validateURL("http://10.0.0.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://10.1.1.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://10.255.255.255")).toThrow(URLValidationError);
    });

    it("should block 172.16.0.0/12 range", () => {
      expect(() => validateURL("http://172.16.0.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://172.20.10.5")).toThrow(URLValidationError);
      expect(() => validateURL("http://172.31.255.255")).toThrow(URLValidationError);
    });

    it("should NOT block 172.15.x.x or 172.32.x.x (outside range)", () => {
      expect(() => validateURL("http://172.15.0.1")).not.toThrow();
      expect(() => validateURL("http://172.32.0.1")).not.toThrow();
    });

    it("should block 192.168.0.0/16 range", () => {
      expect(() => validateURL("http://192.168.0.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://192.168.1.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://192.168.255.255")).toThrow(URLValidationError);
    });

    it("should block 169.254.0.0/16 (link-local)", () => {
      expect(() => validateURL("http://169.254.0.1")).toThrow(URLValidationError);
      expect(() => validateURL("http://169.254.169.254")).toThrow(URLValidationError);
    });

    it("should block 0.0.0.0 and 255.255.255.255", () => {
      expect(() => validateURL("http://0.0.0.0")).toThrow(URLValidationError);
      expect(() => validateURL("http://255.255.255.255")).toThrow(URLValidationError);
    });
  });

  describe("SSRF Protection - Private IPv6 Ranges", () => {
    it("should block link-local IPv6 (fe80::/10)", () => {
      expect(() => validateURL("http://[fe80::1]")).toThrow(URLValidationError);
      expect(() => validateURL("http://[fe80:dead:beef::1]")).toThrow(URLValidationError);
    });

    it("should block unique local IPv6 (fc00::/7)", () => {
      expect(() => validateURL("http://[fc00::1]")).toThrow(URLValidationError);
      expect(() => validateURL("http://[fd00::1]")).toThrow(URLValidationError);
    });

    it("should block multicast IPv6 (ff00::/8)", () => {
      expect(() => validateURL("http://[ff00::1]")).toThrow(URLValidationError);
      expect(() => validateURL("http://[ff02::1]")).toThrow(URLValidationError);
    });

    it("should block unspecified IPv6 (::)", () => {
      expect(() => validateURL("http://[::]")).toThrow(URLValidationError);
    });
  });

  describe("SSRF Protection - Credentials", () => {
    it("should block URLs with embedded credentials", () => {
      expect(() => validateURL("http://user:pass@example.com")).toThrow(
        URLValidationError
      );
      expect(() => validateURL("https://admin:secret@internal.com/api")).toThrow(
        URLValidationError
      );
    });
  });

  describe("Public IPs - Should Pass", () => {
    it("should allow public IPv4 addresses", () => {
      expect(() => validateURL("http://8.8.8.8")).not.toThrow();
      expect(() => validateURL("http://1.1.1.1")).not.toThrow();
      expect(() => validateURL("http://93.184.216.34")).not.toThrow(); // example.com
    });

    it("should allow public domains", () => {
      expect(() => validateURL("http://example.com")).not.toThrow();
      expect(() => validateURL("https://www.google.com")).not.toThrow();
      expect(() => validateURL("https://api.github.com")).not.toThrow();
    });
  });

  describe("safeValidateURL", () => {
    it("should return ValidatedURL for valid URLs", () => {
      const result = safeValidateURL("https://example.com");
      expect(result).not.toBeNull();
      expect(result?.hostname).toBe("example.com");
    });

    it("should return null for invalid URLs", () => {
      expect(safeValidateURL("not a url")).toBeNull();
      expect(safeValidateURL("http://localhost")).toBeNull();
      expect(safeValidateURL("http://127.0.0.1")).toBeNull();
    });
  });

  describe("isSameOrigin", () => {
    it("should return true for same origin URLs", () => {
      expect(isSameOrigin("https://example.com", "https://example.com/path")).toBe(
        true
      );
      expect(isSameOrigin("https://example.com:443", "https://example.com/")).toBe(
        true
      );
    });

    it("should return false for different origins", () => {
      expect(isSameOrigin("https://example.com", "https://other.com")).toBe(false);
      expect(isSameOrigin("http://example.com", "https://example.com")).toBe(false);
      expect(isSameOrigin("https://example.com", "https://example.com:8080")).toBe(
        false
      );
    });

    it("should return false for invalid URLs", () => {
      expect(isSameOrigin("not a url", "https://example.com")).toBe(false);
      expect(isSameOrigin("https://example.com", "not a url")).toBe(false);
    });
  });

  describe("normalizeURL", () => {
    it("should remove fragments", () => {
      expect(normalizeURL("https://example.com#section")).toBe("https://example.com/");
      expect(normalizeURL("https://example.com/path#anchor")).toBe(
        "https://example.com/path"
      );
    });

    it("should remove trailing slashes", () => {
      expect(normalizeURL("https://example.com/path/")).toBe(
        "https://example.com/path"
      );
      expect(normalizeURL("https://example.com/a/b/")).toBe("https://example.com/a/b");
    });

    it("should keep root path slash", () => {
      expect(normalizeURL("https://example.com/")).toBe("https://example.com/");
      expect(normalizeURL("https://example.com")).toBe("https://example.com/");
    });

    it("should preserve query parameters", () => {
      expect(normalizeURL("https://example.com/path?foo=bar")).toBe(
        "https://example.com/path?foo=bar"
      );
    });

    it("should return original string for invalid URLs", () => {
      expect(normalizeURL("not a url")).toBe("not a url");
    });
  });
});

describe("URL Validator - Error Codes", () => {
  it("should throw error with INVALID_URL_FORMAT code", () => {
    try {
      validateURL("not a url");
    } catch (error) {
      expect(error).toBeInstanceOf(URLValidationError);
      expect((error as URLValidationError).code).toBe("INVALID_URL_FORMAT");
    }
  });

  it("should throw error with INVALID_PROTOCOL code", () => {
    try {
      validateURL("ftp://example.com");
    } catch (error) {
      expect(error).toBeInstanceOf(URLValidationError);
      expect((error as URLValidationError).code).toBe("INVALID_PROTOCOL");
    }
  });

  it("should throw error with LOCALHOST_BLOCKED code", () => {
    try {
      validateURL("http://localhost");
    } catch (error) {
      expect(error).toBeInstanceOf(URLValidationError);
      expect((error as URLValidationError).code).toBe("LOCALHOST_BLOCKED");
    }
  });

  it("should throw error with PRIVATE_IP_BLOCKED code", () => {
    try {
      validateURL("http://192.168.1.1");
    } catch (error) {
      expect(error).toBeInstanceOf(URLValidationError);
      expect((error as URLValidationError).code).toBe("PRIVATE_IP_BLOCKED");
    }
  });

  it("should throw error with CREDENTIALS_IN_URL code", () => {
    try {
      validateURL("http://user:pass@example.com");
    } catch (error) {
      expect(error).toBeInstanceOf(URLValidationError);
      expect((error as URLValidationError).code).toBe("CREDENTIALS_IN_URL");
    }
  });
});
