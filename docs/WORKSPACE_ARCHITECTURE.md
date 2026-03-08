# ZARZOOM Workspace Architecture

## Canonical source of truth

- **Server & client:** `active_workspace_id` cookie is the single source of truth for the active workspace.
- **Server:** Dashboard layout reads the cookie (or resolves to first membership), sets it if missing, and passes `initialActiveWorkspaceId` to `ActiveWorkspaceProvider`.
- **Client:** Provider syncs from cookie on mount. All dashboard/onboarding API calls must send `X-Tenant-Id: <activeWorkspaceId>`.

## Data isolation rules

1. Every query/mutation that is workspace-scoped must use `tenant_id` from:
   - **API routes:** `ctx.membership.tenantId` (from `createApiHandler`; derived from `X-Tenant-Id` header).
   - **Standalone API routes (onboarding, etc.):** `resolveTenantId(supabase, userId, request)` using `request.headers.get("x-tenant-id")`.
2. Never use a tenant id from the request body for writes; only from the header (or validated membership).
3. SWR/React Query keys that load workspace-scoped data must include `activeWorkspaceId` so cache is per-workspace.

## Files and areas changed

- `lib/workspace/active.ts` – cookie helpers (unchanged).
- `lib/workspace/context.tsx` – provider + cookie sync (unchanged).
- `lib/onboarding/useOnboarding.ts` – **workspace-scoped:** use active workspace and send X-Tenant-Id.
- `components/onboarding/OnboardingBanner.tsx` – uses useOnboarding (already under provider); no change except hook is now scoped.
- `app/auth/callback/route.ts` – **set cookie to first workspace** when user already has workspaces.
- `lib/auth/postAuthRedirect.ts` – **use cookie if present**, else first workspace.
- `app/login-launch/page.tsx` – **send X-Tenant-Id** when fetching onboarding (use first workspace from /api/v1/workspaces).
- Dashboard reminder – **per-workspace:** useOnboarding fetches for active workspace only; completed workspaces don't show banner.
- Blank workspace creation – POST /api/v1/workspaces sets cookie in response; redirect to /onboarding; wizard uses cookie (onboardingHeaders). No change needed except ensure no stale cache.
- Copy workspace – already copies onboarding_profiles row; data is independent. No change.

## Migrations

- `016_onboarding_per_workspace.sql` – already adds `tenant_id` to `onboarding_profiles` and RLS. Ensure it is applied.

## Tests

- **Unit:** `lib/workspace/active.test.ts` – `getActiveWorkspaceIdFromCookie` with mocked document (run in jsdom).
- **Integration (manual or E2E):** POST /api/v1/workspaces (blank vs copy), GET /api/v1/onboarding with/without X-Tenant-Id, workspace switch then reload profile/API keys.

## Manual QA steps

1. **Blank workspace:** Add Workspace → name "Test Blank" → New/Blank form → Submit. Expect redirect to /onboarding, step 1, business name "Test Blank". Complete or skip; confirm data isolated to that workspace.
2. **Copy workspace:** Add Workspace → "Test Copy" → Existing brand form → Submit. Expect redirect to /dashboard/profile, pre-filled; edits apply only to new workspace.
3. **Switch workspace:** Switch via dropdown/card; Profile, API keys, Support, Brand settings must show data for selected workspace only.
4. **Skip for now:** On /onboarding click Skip for now; expect redirect to dashboard and banner for that workspace only. Switch to completed workspace; banner must not show.
5. **Dashboard reminder:** Completed workspace = no banner. Incomplete/skipped workspace = banner. Per-workspace only.
6. **Login:** Email or OAuth; cookie set to first workspace; redirect to /dashboard or /onboarding by that workspace's status.
7. **Guardrails:** No API write uses tenant id from body; all use X-Tenant-Id (ctx.membership.tenantId).
