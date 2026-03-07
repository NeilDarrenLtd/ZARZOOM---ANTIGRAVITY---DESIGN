# Multi-Workspace Architecture for ZARZOOM SaaS

## 1. Recommended Architecture

### 1.1 Conceptual model

- **User** (auth.users + profiles): One login/email; can own or belong to multiple **workspaces**.
- **Workspace** (product term): Maps 1:1 to **tenant** in the database. Each workspace has:
  - Its own onboarding/setup wizard state
  - Its own subscription/billing
  - Its own API keys, social connections, content, settings, analytics, support tickets
- **Tenant membership**: Links user to tenant with a role (`owner` | `admin` | `member` | `viewer`). The user who creates the workspace is the **owner**.
- **Active workspace**: The workspace context for the current request. Stored in a **cookie** (`active_workspace_id` or `x-tenant-id`) and sent as **`X-Tenant-Id`** header on API requests. Dashboard and app routes read this to show workspace-scoped data.

### 1.2 Current state (from codebase review)

| Area | Current behaviour | Change for multi-workspace |
|------|-------------------|----------------------------|
| **Auth / user** | profiles (id, email, display_name, is_admin); auth.users | No change. One user, multiple memberships. |
| **Tenancy** | tenant_memberships (user_id, tenant_id, role); resolveTenant() uses X-Tenant-Id or first membership | Keep. Add guaranteed first workspace + membership on signup; add “create workspace” flow. |
| **Onboarding** | onboarding_profiles keyed by **user_id** only | Make **workspace-scoped**: add tenant_id, composite (tenant_id, user_id) or new workspace_onboarding table. |
| **Billing** | tenant_subscriptions (tenant_id, plan_id, status); checkout uses ctx.membership.tenantId | No change. Each workspace billed separately. |
| **Support tickets** | support_tickets (user_id); tenantOptional: true | **Workspace-scoped**: add tenant_id; list/filter by active workspace. |
| **API keys / provider_secrets / usage_counters / jobs / social** | Already tenant_id scoped | No schema change. Ensure all API calls use active workspace (X-Tenant-Id). |
| **Post-auth redirect** | resolvePostAuthRedirect(userId) → onboarding_profiles by user_id | **Per-workspace**: redirect by active or default workspace onboarding status. |
| **Dashboard** | No explicit tenant in layout; API calls may not send X-Tenant-Id | Add workspace provider; send X-Tenant-Id on all API requests; workspace switcher in nav. |

### 1.3 High-level flow

1. **Sign up** → Create profile (existing) + **create first workspace** (tenant + tenant_membership as owner) + optionally create first workspace onboarding row (or lazy on first visit to onboarding).
2. **Login** → Resolve active workspace from cookie; if missing, use first membership; set cookie. Redirect by **that workspace’s** onboarding status.
3. **Dashboard** → Every API call sends `X-Tenant-Id: <active_workspace_id>` (from cookie). Data shown is for active workspace only.
4. **Switch workspace** → Update cookie (and optionally localStorage), redirect to /dashboard (or current section). No re-auth.
5. **Create workspace** → Insert tenant + tenant_membership (owner); optionally redirect to new workspace’s onboarding; set active workspace to new one.
6. **Unpaid workspace** → Workspace exists; subscription status `incomplete` / `past_due` / `canceled` / `unpaid`. User can: complete payment, open billing, or **switch to another (paid) workspace**. No locking out of switching.

---

## 2. Recommended Database Schema

### 2.1 Tables that must exist (add if missing)

Scripts reference `tenant_memberships` and `tenant_subscriptions` but the base `tenants` table is not present in the reviewed migrations. Assume or add:

```sql
-- Core tenant/workspace (create if not exists)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Workspace',
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_key ON public.tenants (slug) WHERE slug IS NOT NULL;

-- Membership (create if not exists)
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_user_id ON public.tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_id ON public.tenant_memberships (tenant_id);
```

(RLS and policies for tenants/tenant_memberships to be added per your existing pattern.)

### 2.2 Workspace-scoped onboarding

**Option A (recommended): Add `tenant_id` to onboarding_profiles and use composite uniqueness**

- One row per (user, tenant). Same user can have different onboarding state per workspace.
- Migrate existing rows: assign all current `onboarding_profiles` to a single “default” tenant per user (e.g. first membership’s tenant_id).

```sql
-- Add tenant_id; backfill from first membership; then set NOT NULL and add unique (tenant_id, user_id)
ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill: set tenant_id from first tenant_membership per user
UPDATE public.onboarding_profiles op
SET tenant_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm
  WHERE tm.user_id = op.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE op.tenant_id IS NULL;

-- Then add NOT NULL and unique constraint (run after backfill)
-- ALTER TABLE public.onboarding_profiles ALTER COLUMN tenant_id SET NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS onboarding_profiles_tenant_user_key
--   ON public.onboarding_profiles (tenant_id, user_id);
-- Drop old PK and add new composite PK or keep user_id as PK and add unique(tenant_id, user_id)
```

**Option B:** New table `workspace_onboarding` (tenant_id, user_id, ...) and keep `onboarding_profiles` for backward compatibility during migration. Then switch reads/writes to workspace_onboarding and deprecate onboarding_profiles.

Recommendation: **Option A** with a single table keyed by `(tenant_id, user_id)` and a migration that backfills `tenant_id` from first membership.

### 2.3 Support tickets: workspace-scoped

```sql
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill: set tenant_id from first membership of ticket's user_id
UPDATE public.support_tickets st
SET tenant_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm
  WHERE tm.user_id = st.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE st.tenant_id IS NULL;

-- Then add index and RLS updates so users see only tickets for workspaces they belong to
CREATE INDEX IF NOT EXISTS support_tickets_tenant_id ON public.support_tickets (tenant_id);
```

Update RLS: user can SELECT/INSERT/UPDATE tickets only where `tenant_id` is in their memberships (e.g. via `is_tenant_member(auth.uid(), tenant_id)`).

### 2.4 Subscription status (existing)

- `tenant_subscriptions`: already per tenant_id. Status values: `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `paused`.
- No schema change. Use status to show “Payment required” / “Incomplete” in UI and allow switching workspace.

### 2.5 Summary of schema changes

| Table | Action |
|-------|--------|
| tenants | Create if missing |
| tenant_memberships | Create if missing |
| onboarding_profiles | Add tenant_id; backfill; unique (tenant_id, user_id); PK or unique constraint |
| support_tickets | Add tenant_id; backfill; index; RLS by tenant |
| tenant_subscriptions | No change |
| api_keys, provider_secrets, usage_counters, jobs, social_*, etc. | Already tenant-scoped; no change |

---

## 3. Migration Strategy

### 3.1 Order of operations

1. **Ensure tenants + tenant_memberships exist**  
   - If not: add migration creating them.  
   - **Backfill existing users**: For every user in `profiles` with no membership, create one default tenant and one `tenant_memberships` row (role `owner`). Use a deterministic name (e.g. “Workspace” + short id or user email).

2. **Onboarding: add tenant_id**  
   - Add column (nullable).  
   - Backfill from first membership per user.  
   - Set NOT NULL, add unique (tenant_id, user_id).  
   - Update `onboarding_profiles` RLS so rows are scoped by tenant (user can only see rows for tenants they belong to).  
   - Application: all reads/writes to onboarding pass `tenant_id` (active workspace).

3. **Support tickets: add tenant_id**  
   - Add column, backfill from ticket’s user first membership.  
   - Update RLS to tenant-scoped.  
   - Application: create/list tickets for active workspace only.

4. **Application and frontend**  
   - Active workspace cookie + X-Tenant-Id (see below).  
   - Post-auth and onboarding redirect by workspace.  
   - Dashboard and API clients send X-Tenant-Id.  
   - Workspace switcher + “Create workspace” flow.

### 3.2 Backfill: “first workspace” for existing users

```sql
-- Pseudocode: for each user in profiles without any tenant_membership
INSERT INTO public.tenants (id, name, created_at, updated_at)
SELECT gen_random_uuid(), 'My Workspace', now(), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = u.id);
-- Then insert tenant_memberships linking user to new tenant with role 'owner'.
-- (Exact syntax depends on how you generate tenant id per user.)
```

Run in a transaction; one tenant per user with no memberships; then one membership (owner) per such user.

### 3.3 New user signup

- Keep `handle_new_user()` for profiles.  
- Add a trigger or server action after first signup: create one tenant (e.g. “My Workspace”), one tenant_membership (role `owner`). Optionally create one `onboarding_profiles` row (tenant_id, user_id) with status `not_started`.  
- Do not block login if tenant creation fails; have a “recovery” path that creates workspace on first dashboard load if user has no membership.

---

## 4. Workspace Switching Strategy

### 4.1 Storing active workspace

- **Cookie**: `active_workspace_id` or reuse `x-tenant-id` (e.g. `zarzoom-active-tenant`)  
  - Path: `/`  
  - HttpOnly: false so client can send it with API requests (or use a non-HttpOnly cookie and send in header from client).  
  - SameSite: Lax, Secure in production.  
- **Optional**: Mirror in localStorage for client-only use (e.g. workspace list and last active).

### 4.2 Resolving active workspace (server)

- **Middleware or layout (dashboard)**  
  - Read cookie `active_workspace_id`.  
  - If present, validate that current user has membership for that tenant_id (query tenant_memberships).  
  - If invalid or missing, set to first membership’s tenant_id and set cookie.  
- **API (already in place)**  
  - Handler uses `X-Tenant-Id` header; `resolveTenant(supabase, userId, preferredTenantId)` already supports preferred tenant.  
  - Ensure dashboard and all client-side API calls send `X-Tenant-Id: <cookie value>`.

### 4.3 Client: sending X-Tenant-Id

- **Fetch wrapper or SWR/fetch config**: Read active workspace id from cookie (or from a React context that reads cookie/server-provided value) and add header `X-Tenant-Id: <id>` to every request to `/api/v1/*`.  
- **Server Components**: Pass active_workspace_id from layout (from cookie + validation) to children so they can use it in server-side fetches or pass to client.

### 4.4 Switch workspace action

- **Endpoint**: e.g. `POST /api/v1/workspace/switch` or inline in app.  
  - Body or query: `tenant_id` (or workspace_id).  
  - Check user is member of that tenant; then set cookie `active_workspace_id` and return success.  
- **Client**: Call switch API, then redirect to `/dashboard` (or current path) so all subsequent requests use new workspace. Optionally refetch workspace-scoped data (SWR revalidate, or full navigation).

### 4.5 Workspace list

- **Endpoint**: `GET /api/v1/workspaces` (or `/api/v1/tenants`).  
  - Returns list of tenants the user is a member of, with: id, name, role, subscription status (active / incomplete / past_due etc.), onboarding status for current user in that workspace.  
- Used by workspace switcher dropdown and for “Create workspace” + “Switch back to paid workspace” flows.

---

## 5. Implementation Phases

### Phase 1: Foundation (no user-facing behaviour change)

1. Add migration: ensure `tenants` and `tenant_memberships` exist; backfill one tenant + one membership (owner) per existing user.  
2. Add migration: `onboarding_profiles.tenant_id` + backfill + unique (tenant_id, user_id) + RLS.  
3. Keep reading onboarding by user_id in app for now (e.g. “first” workspace), so behaviour stays the same.

### Phase 2: Active workspace and API

4. Introduce `active_workspace_id` cookie. In dashboard layout or middleware: set from cookie or default to first membership; validate membership; set cookie if missing.  
5. Ensure all dashboard API calls from the client send `X-Tenant-Id` (fetch wrapper or provider).  
6. Add `GET /api/v1/workspaces` returning user’s memberships + subscription and onboarding status per workspace.  
7. Add `POST /api/v1/workspace/switch` (or equivalent) to set cookie and return success.

### Phase 3: Onboarding and redirect per workspace

8. Change onboarding reads/writes to use active workspace’s `tenant_id`.  
9. Update `resolvePostAuthRedirect(userId)` to consider **active workspace** (from cookie or first membership): if that workspace’s onboarding is completed → dashboard; else → onboarding.  
10. Middleware onboarding guard: for dashboard/engine routes, check onboarding status for the **active workspace** (requires resolving active workspace in middleware and then looking up onboarding_profiles by tenant_id + user_id).

### Phase 4: Support tickets and UI

11. Migration: `support_tickets.tenant_id` + backfill + RLS.  
12. Support ticket list/create filtered by active workspace; API uses ctx.membership (so X-Tenant-Id is already correct).  
13. Workspace switcher in dashboard nav: dropdown of workspaces (from GET /api/v1/workspaces) with status badges (paid / incomplete / payment required); on select → switch API + redirect.  
14. “Create workspace” flow: create tenant + membership (owner), set active workspace cookie, redirect to onboarding for new workspace.

### Phase 5: Unpaid and edge cases

15. Unpaid workspace: allow full access to billing/portal and to workspace switcher; show banner “Payment required” but do not block switching.  
16. Ensure user can always switch to a paid workspace (or to any workspace they belong to).  
17. Optional: “default workspace” preference (e.g. last active or explicit default) for login redirect when cookie is missing.

---

## 6. Potential Risks

| Risk | Mitigation |
|------|-------------|
| **Existing users with no tenant_membership** | Backfill creates one tenant + one owner membership per such user before any code assumes membership exists. |
| **Onboarding_profiles backfill** | Backfill tenant_id from first membership; then enforce unique (tenant_id, user_id). Handle NULLs in application during rollout. |
| **Support_tickets backfill** | Same: backfill tenant_id from ticket’s user first membership; then RLS and app filter by tenant. |
| **API called without X-Tenant-Id** | resolveTenant() already falls back to “first” membership. Ensure first membership is deterministic (e.g. oldest). Prefer always sending header from client. |
| **Cookie not sent on first request after switch** | Switch endpoint sets cookie and client redirects; next request is full page or API with cookie. Use path=/, SameSite=Lax. |
| **Post-auth: no cookie yet** | After login, redirect URL is decided server-side: resolve “first” or “default” workspace, set cookie, then redirect to onboarding or dashboard based on that workspace’s onboarding. |
| **Multiple tabs / devices** | Each tab/device has its own cookie. Switching in one tab does not affect another until that tab reloads or refetches. Acceptable; optional: broadcast or “workspace changed” notice. |
| **RLS and tenant_id** | All tenant-scoped tables must restrict by tenant_id and membership. Audit RLS for onboarding_profiles and support_tickets after adding tenant_id. |
| **Billing webhook** | Already uses tenant_id in metadata; no change. Ensure checkout always sends correct tenant_id (active workspace). |
| **Admin functionality** | Out of scope; admin routes can continue to use first tenant or a separate admin tenant resolution if needed. |

---

## 7. Summary

- **Architecture**: One user, many workspaces (tenants); each workspace has its own onboarding, billing, API keys, social, content, settings, analytics, support tickets. Active workspace stored in cookie and sent as `X-Tenant-Id`.
- **Schema**: Add tenants/tenant_memberships if missing; add and backfill `tenant_id` on onboarding_profiles and support_tickets; keep subscription and rest of tenant-scoped data as-is.
- **Migration**: Backfill one tenant + owner membership per user; backfill onboarding and tickets with tenant_id from first membership; then enforce NOT NULL and RLS.
- **Switching**: Cookie + X-Tenant-Id; GET workspaces list; POST switch; client sends header on every API call.
- **Phases**: Foundation (backfill, schema) → active workspace + API header → onboarding/redirect per workspace → support tickets + switcher UI → unpaid handling and edge cases.
- **Risks**: Backfill correctness, RLS, missing header/cookie, multi-tab; all addressed with backfill design, validation of membership, and clear redirect/switch flow.

This keeps the existing tenant-based API and billing model, extends onboarding and support to be workspace-scoped, and adds a minimal, production-safe multi-workspace experience without redesigning routing or admin.
