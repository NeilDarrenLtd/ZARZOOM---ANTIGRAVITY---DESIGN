/**
 * Tests for dev-only workspace guardrails.
 * Run with NODE_ENV=development so assertions are active (see describe block).
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  assertWorkspaceSave,
  assertWorkspaceWhere,
  logWorkspaceSave,
  logWorkspaceSwitch,
  warnQueryWithoutWorkspaceId,
} from "./workspace-guardrails";

const originalEnv = process.env.NODE_ENV;

describe("workspace-guardrails (dev mode)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("assertWorkspaceSave", () => {
    it("throws when activeWorkspaceId is null", () => {
      expect(() =>
        assertWorkspaceSave(null, { tenant_id: "tid-1" }, "onboarding_profiles")
      ).toThrow(/activeWorkspaceId required/);
    });

    it("throws when payload tenant_id does not match activeWorkspaceId", () => {
      expect(() =>
        assertWorkspaceSave(
          "workspace-a",
          { tenant_id: "workspace-b", name: "x" },
          "onboarding_profiles"
        )
      ).toThrow(/Payload workspace_id must match activeWorkspaceId/);
    });

    it("throws when payload workspace_id does not match activeWorkspaceId", () => {
      expect(() =>
        assertWorkspaceSave(
          "workspace-a",
          { workspace_id: "workspace-b" },
          "api_keys"
        )
      ).toThrow(/Payload workspace_id must match activeWorkspaceId/);
    });

    it("does not throw when payload tenant_id matches activeWorkspaceId", () => {
      expect(() =>
        assertWorkspaceSave(
          "workspace-a",
          { tenant_id: "workspace-a", business_name: "Acme" },
          "onboarding_profiles"
        )
      ).not.toThrow();
    });

    it("does not throw when payload has no workspace_id (server adds it)", () => {
      expect(() =>
        assertWorkspaceSave("workspace-a", { name: "key1" }, "api_keys")
      ).not.toThrow();
    });
  });

  describe("assertWorkspaceWhere", () => {
    it("throws when tenantId is null in dev", () => {
      expect(() =>
        assertWorkspaceWhere(null, "update", "onboarding_profiles")
      ).toThrow(/tenantId required/);
    });

    it("throws when whereClause tenant_id does not match context tenantId", () => {
      expect(() =>
        assertWorkspaceWhere("workspace-a", "update", "onboarding_profiles", {
          tenant_id: "workspace-b",
        })
      ).toThrow(/Where clause tenant_id must match context/);
    });

    it("does not throw when whereClause includes matching tenant_id", () => {
      expect(() =>
        assertWorkspaceWhere("workspace-a", "update", "onboarding_profiles", {
          tenant_id: "workspace-a",
          user_id: "user-1",
        })
      ).not.toThrow();
    });

    it("does not throw when whereClause is omitted (caller responsible)", () => {
      expect(() =>
        assertWorkspaceWhere("workspace-a", "delete", "api_keys")
      ).not.toThrow();
    });
  });

  describe("logWorkspaceSave", () => {
    it("does not throw", () => {
      expect(() =>
        logWorkspaceSave("api_keys", "workspace-a", "workspace-a")
      ).not.toThrow();
    });
  });

  describe("logWorkspaceSwitch", () => {
    it("does not throw", () => {
      expect(() =>
        logWorkspaceSwitch("workspace-a", "workspace-b", ["SWR refetch"])
      ).not.toThrow();
    });
  });

  describe("warnQueryWithoutWorkspaceId", () => {
    it("does not throw when workspaceId is null (only warns)", () => {
      expect(() =>
        warnQueryWithoutWorkspaceId(null, "GET /api/v1/onboarding")
      ).not.toThrow();
    });
  });

  describe("cross-workspace leakage prevention", () => {
    it("fails if rename/save in Workspace A would write to Workspace B (payload tenant_id mismatch)", () => {
      expect(() =>
        assertWorkspaceSave(
          "workspace-a",
          { tenant_id: "workspace-b", name: "B Name" },
          "tenants"
        )
      ).toThrow(/Payload workspace_id must match activeWorkspaceId/);
    });

    it("fails if business name save in Workspace B would write to Workspace A (payload mismatch)", () => {
      expect(() =>
        assertWorkspaceSave(
          "workspace-b",
          { tenant_id: "workspace-a", business_name: "A Business" },
          "onboarding_profiles"
        )
      ).toThrow(/Payload workspace_id must match activeWorkspaceId/);
    });

    it("fails if update/delete where clause targets wrong workspace", () => {
      expect(() =>
        assertWorkspaceWhere("workspace-a", "update", "onboarding_profiles", {
          tenant_id: "workspace-b",
        })
      ).toThrow(/Where clause tenant_id must match context/);
    });
  });
});

describe("workspace-guardrails (production mode)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("assertWorkspaceSave does not throw when payload mismatch (no-op in prod)", () => {
    expect(() =>
      assertWorkspaceSave(
        "workspace-a",
        { tenant_id: "workspace-b" },
        "onboarding_profiles"
      )
    ).not.toThrow();
  });

  it("assertWorkspaceWhere does not throw when tenantId is null (no-op in prod)", () => {
    expect(() =>
      assertWorkspaceWhere(null, "update", "onboarding_profiles")
    ).not.toThrow();
  });
});
