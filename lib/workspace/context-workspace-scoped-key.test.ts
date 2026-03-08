/**
 * Tests that data loader keys include workspace_id (no cross-workspace leakage).
 */

import { describe, it, expect } from "@jest/globals";
import { workspaceScopedKey } from "./workspace-scoped-key";

describe("workspaceScopedKey", () => {
  it("returns null when activeWorkspaceId is null (no fetch)", () => {
    expect(workspaceScopedKey("/api/v1/onboarding", null)).toBeNull();
    expect(workspaceScopedKey("/api/v1/api-keys", null)).toBeNull();
  });

  it("returns [url, workspaceId] when activeWorkspaceId is set", () => {
    expect(workspaceScopedKey("/api/v1/onboarding", "workspace-a")).toEqual([
      "/api/v1/onboarding",
      "workspace-a",
    ]);
    expect(workspaceScopedKey("/api/v1/api-keys", "workspace-b")).toEqual([
      "/api/v1/api-keys",
      "workspace-b",
    ]);
  });

  it("different workspaces produce different keys (SWR cache per workspace)", () => {
    const keyA = workspaceScopedKey("/api/v1/onboarding", "workspace-a");
    const keyB = workspaceScopedKey("/api/v1/onboarding", "workspace-b");
    expect(keyA).not.toEqual(keyB);
    expect(keyA).toEqual(["/api/v1/onboarding", "workspace-a"]);
    expect(keyB).toEqual(["/api/v1/onboarding", "workspace-b"]);
  });
});
