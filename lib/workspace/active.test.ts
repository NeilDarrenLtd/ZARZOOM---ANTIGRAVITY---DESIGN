/**
 * Tests for active workspace resolution (client cookie helper).
 * getActiveWorkspaceIdFromCookie is client-only; run in jsdom so document exists.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  getActiveWorkspaceIdFromCookie,
  ACTIVE_WORKSPACE_COOKIE,
} from "./active";

describe("getActiveWorkspaceIdFromCookie", () => {
  const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

  beforeEach(() => {
    let cookie = "";
    Object.defineProperty(document, "cookie", {
      get: () => cookie,
      set: (v: string) => {
        const parts = v.split(";").map((p) => p.trim());
        const [nameEqVal] = parts;
        const name = nameEqVal?.split("=")[0]?.trim();
        const value = nameEqVal?.split("=").slice(1).join("=").trim();
        if (name === ACTIVE_WORKSPACE_COOKIE) {
          cookie = value ? `${ACTIVE_WORKSPACE_COOKIE}=${value}` : "";
        }
      },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie);
    }
  });

  it("returns null when cookie is not set", () => {
    expect(getActiveWorkspaceIdFromCookie()).toBeNull();
  });

  it("returns workspace id when cookie is set", () => {
    document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=abc-123; path=/`;
    expect(getActiveWorkspaceIdFromCookie()).toBe("abc-123");
  });

  it("decodes URI-encoded value", () => {
    document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent("id-with-dash")}; path=/`;
    expect(getActiveWorkspaceIdFromCookie()).toBe("id-with-dash");
  });
});
