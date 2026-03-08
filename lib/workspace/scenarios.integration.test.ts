/**
 * Integration-style tests for workspace isolation scenarios.
 * Uses an in-memory store that mirrors API rules (create workspace, rename,
 * onboarding get/update, workspace list, support tickets) so we can verify
 * cross-workspace invariants without a real DB or auth.
 *
 * The real API is expected to enforce the same tenant_id scoping and
 * copy-from semantics. These tests fail if isolation logic is broken.
 *
 * Architecture: tenant_id is the sole PK for onboarding_profiles (one profile
 * per workspace). user_id is metadata only. All queries use tenant_id as the
 * primary filter.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/* ------------------------------------------------------------------ */
/*  In-memory store (mirrors API behavior)                            */
/* ------------------------------------------------------------------ */

type Tenant = { id: string; name: string; status: string };
type Membership = { tenant_id: string; user_id: string; role: string };
type OnboardingProfile = {
  tenant_id: string;
  user_id: string;
  onboarding_status: string;
  onboarding_step: number;
  business_name: string | null;
  [key: string]: unknown;
};
type SupportTicket = {
  id: string;
  tenant_id: string;
  user_id: string;
  subject: string;
  status: string;
};

const store = {
  tenants: [] as Tenant[],
  memberships: [] as Membership[],
  onboarding: [] as OnboardingProfile[],
  tickets: [] as SupportTicket[],
};

let idCounter = 0;
function nextId(): string {
  return `id-${++idCounter}`;
}

function resetStore(): void {
  store.tenants.length = 0;
  store.memberships.length = 0;
  store.onboarding.length = 0;
  store.tickets.length = 0;
  idCounter = 0;
}

const TEST_USER = "user-1";

/** Create workspace: same rules as POST /api/v1/workspaces (blank or copy-from). */
function createWorkspace(
  userId: string,
  name: string,
  copyOnboardingFromWorkspaceId?: string | null
): { id: string; name: string } {
  const id = nextId();
  store.tenants.push({ id, name, status: "draft" });
  store.memberships.push({ tenant_id: id, user_id: userId, role: "owner" });

  if (copyOnboardingFromWorkspaceId) {
    const membership = store.memberships.find(
      (m) => m.tenant_id === copyOnboardingFromWorkspaceId && m.user_id === userId
    );
    if (membership) {
      // Lookup by tenant_id only (PK is tenant_id)
      const source = store.onboarding.find(
        (o) => o.tenant_id === copyOnboardingFromWorkspaceId
      );
      if (source) {
        const brandOnlyKeys = [
          "business_description", "website_url", "content_language", "auto_publish",
          "article_styles", "article_style_links", "brand_color_hex", "logo_url",
          "goals", "website_or_landing_url", "product_or_sales_url", "selected_plan",
          "discount_opt_in", "approval_preference", "additional_notes",
        ];
        const copied: Record<string, unknown> = {};
        for (const key of brandOnlyKeys) {
          if (source[key] !== undefined) copied[key] = source[key];
        }
        store.onboarding.push({
          tenant_id: id,
          user_id: userId,
          onboarding_status: "not_started",
          onboarding_step: 1,
          business_name: name.slice(0, 200),
          ...copied,
        } as OnboardingProfile);
      }
    }
  } else {
    store.onboarding.push({
      tenant_id: id,
      user_id: userId,
      onboarding_status: "not_started",
      onboarding_step: 1,
      business_name: name.slice(0, 200),
    });
  }
  return { id, name };
}

/** Rename workspace: same rules as PATCH /api/v1/workspaces/[id]; syncs business_name. */
function renameWorkspace(
  workspaceId: string,
  name: string,
  userId: string
): void {
  const membership = store.memberships.find(
    (m) => m.tenant_id === workspaceId && m.user_id === userId
  );
  if (!membership || membership.role !== "owner") throw new Error("Forbidden");
  const tenant = store.tenants.find((t) => t.id === workspaceId);
  if (!tenant) throw new Error("Not found");
  const trimmed = name.slice(0, 200);
  tenant.name = trimmed;
  // Lookup by tenant_id only (PK is tenant_id)
  const onboarding = store.onboarding.find(
    (o) => o.tenant_id === workspaceId
  );
  if (onboarding) onboarding.business_name = trimmed;
}

/** Get workspaces for user (names from tenants). */
function getWorkspaces(userId: string): { id: string; name: string }[] {
  const mems = store.memberships.filter((m) => m.user_id === userId);
  return mems.map((m) => {
    const t = store.tenants.find((x) => x.id === m.tenant_id);
    return { id: m.tenant_id, name: t?.name ?? "Workspace" };
  });
}

/** Get onboarding profile for workspace (by tenant_id only — sole PK). */
function getOnboarding(tenantId: string): OnboardingProfile | null {
  return store.onboarding.find((o) => o.tenant_id === tenantId) ?? null;
}

/** Update onboarding (same scoping as PUT /api/v1/onboarding with X-Tenant-Id); syncs workspace name when business_name changes. */
function updateOnboarding(
  tenantId: string,
  _userId: string,
  data: Partial<OnboardingProfile>
): void {
  const row = store.onboarding.find((o) => o.tenant_id === tenantId);
  if (!row) {
    const inserted = {
      tenant_id: tenantId,
      user_id: _userId,
      onboarding_status: "not_started",
      onboarding_step: 1,
      business_name: null,
      ...data,
    };
    store.onboarding.push(inserted as OnboardingProfile);
    if (data.business_name != null) {
      const tenant = store.tenants.find((t) => t.id === tenantId);
      if (tenant) tenant.name = String(data.business_name).slice(0, 200);
    }
    return;
  }
  Object.assign(row, data);
  if (data.business_name != null) {
    const tenant = store.tenants.find((t) => t.id === tenantId);
    if (tenant) tenant.name = String(data.business_name).slice(0, 200);
  }
}

/** Banner shown when status is skipped or in_progress (per workspace). */
function needsBanner(tenantId: string): boolean {
  const p = getOnboarding(tenantId);
  const status = p?.onboarding_status ?? "not_started";
  return status === "skipped" || status === "in_progress";
}

/** Create a support ticket scoped to a workspace. */
function createTicket(
  tenantId: string,
  userId: string,
  subject: string
): SupportTicket {
  const id = nextId();
  const ticket: SupportTicket = {
    id,
    tenant_id: tenantId,
    user_id: userId,
    subject,
    status: "open",
  };
  store.tickets.push(ticket);
  return ticket;
}

/** Get tickets for a workspace (filtered by tenant_id, not user_id). */
function getTickets(tenantId: string): SupportTicket[] {
  return store.tickets.filter((t) => t.tenant_id === tenantId);
}

/* ------------------------------------------------------------------ */
/*  Scenario 1: Rename Workspace B → Workspace A name unchanged        */
/* ------------------------------------------------------------------ */
describe("Scenario 1: Rename workspace isolation", () => {
  beforeEach(resetStore);

  it("create Workspace A, create Workspace B, rename B, confirm A name unchanged", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    const b = createWorkspace(TEST_USER, "Workspace B");
    expect(getWorkspaces(TEST_USER).map((w) => w.name)).toEqual([
      "Workspace A",
      "Workspace B",
    ]);

    renameWorkspace(b.id, "Workspace B Renamed", TEST_USER);

    const workspaces = getWorkspaces(TEST_USER);
    const nameA = workspaces.find((w) => w.id === a.id)?.name;
    const nameB = workspaces.find((w) => w.id === b.id)?.name;
    expect(nameA).toBe("Workspace A");
    expect(nameB).toBe("Workspace B Renamed");
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 2: Business name in A does not change B                  */
/* ------------------------------------------------------------------ */
describe("Scenario 2: Business name per workspace", () => {
  beforeEach(resetStore);

  it("open A, change business name, save, switch to B, confirm B business name unchanged", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    const b = createWorkspace(TEST_USER, "Workspace B");
    updateOnboarding(b.id, TEST_USER, { business_name: "B Original" });

    updateOnboarding(a.id, TEST_USER, { business_name: "A Business Name" });

    const profileB = getOnboarding(b.id);
    expect(profileB?.business_name).toBe("B Original");
    expect(profileB?.business_name).not.toBe("A Business Name");
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 3: Settings in B do not change A                         */
/* ------------------------------------------------------------------ */
describe("Scenario 3: Brand/API/settings per workspace", () => {
  beforeEach(resetStore);

  it("open B, change brand/settings, save, switch to A, confirm A settings unchanged", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    const b = createWorkspace(TEST_USER, "Workspace B");
    updateOnboarding(a.id, TEST_USER, {
      business_name: "A Original",
      content_language: "en",
    });

    updateOnboarding(b.id, TEST_USER, {
      business_name: "B Brand",
      content_language: "de",
    });

    const profileA = getOnboarding(a.id);
    expect(profileA?.business_name).toBe("A Original");
    expect(profileA?.content_language).toBe("en");
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 4: Banner visibility per workspace                       */
/* ------------------------------------------------------------------ */
describe("Scenario 4: Onboarding banner per workspace", () => {
  beforeEach(resetStore);

  it("Workspace A complete, Workspace B incomplete: A no banner, B shows banner", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    const b = createWorkspace(TEST_USER, "Workspace B");
    updateOnboarding(a.id, TEST_USER, { onboarding_status: "completed" });
    updateOnboarding(b.id, TEST_USER, { onboarding_status: "in_progress" });

    expect(needsBanner(a.id)).toBe(false);
    expect(needsBanner(b.id)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 5: Blank workspace C – step 1, prefilled name, no copy    */
/* ------------------------------------------------------------------ */
describe("Scenario 5: Blank workspace wizard", () => {
  beforeEach(resetStore);

  it("create blank Workspace C: wizard step 1, business_name from C name, no completion/skipped from A/B", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    updateOnboarding(a.id, TEST_USER, { onboarding_status: "completed" });
    const b = createWorkspace(TEST_USER, "Workspace B");
    updateOnboarding(b.id, TEST_USER, { onboarding_status: "skipped" });

    const c = createWorkspace(TEST_USER, "Workspace C");
    const profileC = getOnboarding(c.id);
    expect(profileC?.onboarding_step).toBe(1);
    expect(profileC?.onboarding_status).toBe("not_started");
    expect(profileC?.business_name).toBe("Workspace C");
    expect(profileC?.onboarding_status).not.toBe("completed");
    expect(profileC?.onboarding_status).not.toBe("skipped");
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 6: Pre-filled from existing – only brand copied; fresh onboarding */
/* ------------------------------------------------------------------ */
describe("Scenario 6: Pre-filled from existing workspace", () => {
  beforeEach(resetStore);

  it("create D pre-filled from A: new name, fresh onboarding (step 1, not_started), only brand fields copied; edits in D do not affect A", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    updateOnboarding(a.id, TEST_USER, {
      business_name: "A Business",
      onboarding_status: "in_progress",
      onboarding_step: 2,
      content_language: "de",
      brand_color_hex: "#ff0000",
    });

    const d = createWorkspace(TEST_USER, "Workspace D", a.id);
    const profileDInitial = getOnboarding(d.id);
    expect(profileDInitial?.business_name).toBe("Workspace D");
    expect(profileDInitial?.onboarding_step).toBe(1);
    expect(profileDInitial?.onboarding_status).toBe("not_started");
    expect(profileDInitial?.content_language).toBe("de");
    expect(profileDInitial?.brand_color_hex).toBe("#ff0000");

    updateOnboarding(d.id, TEST_USER, {
      business_name: "D Edited",
      onboarding_step: 3,
    });

    const profileA = getOnboarding(a.id);
    expect(profileA?.business_name).toBe("A Business");
    expect(profileA?.onboarding_step).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 7: Business name → workspace name sync                    */
/* ------------------------------------------------------------------ */
describe("Scenario 7: Business name updates workspace name", () => {
  beforeEach(resetStore);

  it("edit business name in Beta: workspace name updates; Alpha unchanged", () => {
    const a = createWorkspace(TEST_USER, "Alpha");
    const b = createWorkspace(TEST_USER, "Beta");
    updateOnboarding(b.id, TEST_USER, { business_name: "Beta Business Inc" });

    const workspaces = getWorkspaces(TEST_USER);
    expect(workspaces.find((w) => w.id === a.id)?.name).toBe("Alpha");
    expect(workspaces.find((w) => w.id === b.id)?.name).toBe("Beta Business Inc");
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 8: Workspace rename → business name sync                  */
/* ------------------------------------------------------------------ */
describe("Scenario 8: Workspace rename updates business name", () => {
  beforeEach(resetStore);

  it("rename workspace: profile business_name updates to match", () => {
    const b = createWorkspace(TEST_USER, "Beta");
    renameWorkspace(b.id, "Beta Renamed", TEST_USER);
    const profile = getOnboarding(b.id);
    expect(profile?.business_name).toBe("Beta Renamed");
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 9: Support tickets are workspace-scoped                   */
/* ------------------------------------------------------------------ */
describe("Scenario 9: Support ticket workspace isolation", () => {
  beforeEach(resetStore);

  it("ticket in WS-A is not visible when listing WS-B tickets", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    const b = createWorkspace(TEST_USER, "Workspace B");

    createTicket(a.id, TEST_USER, "Issue in workspace A");
    createTicket(a.id, TEST_USER, "Another issue in workspace A");
    createTicket(b.id, TEST_USER, "Issue in workspace B");

    const ticketsA = getTickets(a.id);
    const ticketsB = getTickets(b.id);

    expect(ticketsA).toHaveLength(2);
    expect(ticketsB).toHaveLength(1);
    expect(ticketsA[0].subject).toBe("Issue in workspace A");
    expect(ticketsB[0].subject).toBe("Issue in workspace B");
  });

  it("tickets from one workspace do not leak into another", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    const b = createWorkspace(TEST_USER, "Workspace B");

    createTicket(a.id, TEST_USER, "Secret issue A");

    const ticketsB = getTickets(b.id);
    expect(ticketsB).toHaveLength(0);
    expect(ticketsB.some((t) => t.subject === "Secret issue A")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Scenario 10: Profile lookup by tenant_id only (not composite PK)   */
/* ------------------------------------------------------------------ */
describe("Scenario 10: Profile lookup uses tenant_id as sole key", () => {
  beforeEach(resetStore);

  it("getOnboarding uses tenant_id only, not tenant_id+user_id", () => {
    const a = createWorkspace(TEST_USER, "Workspace A");
    updateOnboarding(a.id, TEST_USER, {
      business_name: "Test Business",
      content_language: "fr",
    });

    // tenant_id alone is sufficient to find the profile
    const profile = getOnboarding(a.id);
    expect(profile).not.toBeNull();
    expect(profile?.business_name).toBe("Test Business");
    expect(profile?.content_language).toBe("fr");
  });
});
