# Workspace Isolation Audit – Root Causes and Fixes

## 1. Exact root causes

### RC1: First-workspace fallback when X-Tenant-Id is missing
- **Where:** `lib/api/tenancy.ts` – `resolveTenant(supabase, userId, preferredTenantId)`.
- **Behavior:** When `preferredTenantId` (from `X-Tenant-Id` header) is null/undefined, the query uses only `.eq("user_id", userId)` and `.limit(1).single()`, so the **first** membership (first workspace) is returned.
- **Impact:** Any API route using `createApiHandler` that receives a request **without** `X-Tenant-Id` will resolve to the first workspace. Writes (profile, onboarding, API keys, etc.) then go to the first workspace instead of the active one.

### RC2: Client active workspace can lag server initial (hydration race)
- **Where:** `lib/workspace/context.tsx` – `ActiveWorkspaceProvider` initial state is `initialActiveWorkspaceId` from the server; cookie sync runs in `useEffect` after first paint.
- **Behavior:** If the server layout runs without the cookie (e.g. cached or cookie not sent), `getActiveWorkspaceId` returns the first workspace and that is passed as `initialActiveWorkspaceId`. The client may have the correct workspace in `document.cookie` (e.g. after a switch in another tab or a previous client-side switch), but the first render and early requests use the server’s “first workspace” until the effect runs.
- **Impact:** First few requests (e.g. profile load, onboarding GET) can use the wrong workspace id in the header.

### RC3: X-Tenant-Id not sent from onboarding wizard subcomponents
- **Where:** `components/onboarding/Step2Brand.tsx` – `fetch("/api/v1/onboarding/autofill/website", ...)`, `fetch("/api/v1/onboarding/upload-file", ...)`, `fetch("/api/v1/onboarding/autofill/file", ...)` are called **without** `X-Tenant-Id`.
- **Behavior:** Those requests do not send the active workspace. Autofill/website and autofill/file use `persistAutofillResults(supabase, userId, ...)` (and RPC `update_onboarding_autofill` with `p_user_id` only), so they currently persist by user only; upload-file may not write to onboarding_profiles. Sending no header still makes createApiHandler routes (if any) fall back to first workspace and is inconsistent for future workspace-scoped autofill.
- **Impact:** Autofill/upload calls are not explicitly workspace-scoped; any handler that does use tenant will see “no header” and fall back to first workspace.

### RC4: Header not trimmed in API handler
- **Where:** `lib/api/handler.ts` – `req.headers.get("x-tenant-id")` is passed to `resolveTenant` without trimming.
- **Behavior:** A value like `"  <uuid>  "` might not match DB and can be treated as invalid.
- **Impact:** Minor; can cause “not a member” or wrong tenant when client sends whitespace.

### RC5: Legacy paths use user_id only (single row per user)
- **Where:** `app/api/v1/onboarding/route.ts` (GET/PUT), `app/api/v1/onboarding/complete/route.ts`, `app/api/v1/onboarding/skip/route.ts`, `app/api/v1/onboarding/restart/route.ts` – when `isLegacySchemaError()` is true (e.g. `tenant_id` column missing), code uses `.eq("user_id", user.id)` only.
- **Behavior:** One row per user is read/updated; all workspaces share that row.
- **Impact:** If migration 016 is not applied, workspace isolation is impossible. With migration applied, these paths should not run.

### RC6: Workspaces GET content_language legacy fallback
- **Where:** `app/api/v1/workspaces/route.ts` – when no per-tenant content_language is found, legacy fallback sets only `tenantIds[0]`.
- **Behavior:** Only the first workspace gets a content_language in that case.
- **Impact:** Display only; reinforces “first workspace” behavior in legacy schema.

---

## 2. Exact broken files / functions / queries

| File | Function / area | Issue |
|------|----------------------------------|--------|
| `lib/api/tenancy.ts` | `resolveTenant` | No tenant filter when `preferredTenantId` is falsy → first membership returned. |
| `lib/api/handler.ts` | Tenant resolution block | `x-tenant-id` not trimmed; empty string not normalized to null. |
| `lib/workspace/context.tsx` | `ActiveWorkspaceProvider` initial state | Uses only server `initialActiveWorkspaceId`; cookie not used for initial state → hydration race. |
| `components/onboarding/Step2Brand.tsx` | `handleInvestigate`, `handleFileAnalyse`, PDF upload fetch | No `X-Tenant-Id` on autofill/website, upload-file, autofill/file. |
| `app/api/v1/onboarding/route.ts` | GET/PUT legacy branches | `.eq("user_id", user.id)` only when legacy schema detected. |
| `app/api/v1/onboarding/restart|skip|complete/route.ts` | Legacy branches | Same user_id-only updates. |
| `app/api/v1/workspaces/route.ts` | GET content_language | Legacy fallback sets only `tenantIds[0]`. |

---

## 3. Fix plan (implemented)

1. **Tenancy**
   - In `resolveTenant`, treat empty/whitespace `preferredTenantId` as missing (no change to “first membership” behavior when header is absent; document that workspace-scoped calls must send header).
   - In `handler.ts`, read `x-tenant-id` with `.trim()` and pass `null` when empty so tenancy uses a single convention.

2. **Client workspace context**
   - In `ActiveWorkspaceProvider`, initialize state with `getActiveWorkspaceIdFromCookie() ?? initialActiveWorkspaceId` so the client cookie wins on first paint when available and the server value is fallback.

3. **Step2Brand**
   - Add `X-Tenant-Id` to all onboarding API calls (autofill/website, upload-file, autofill/file) using `getActiveWorkspaceIdFromCookie()`, so all requests are explicitly workspace-scoped and consistent with the rest of the app.

4. **Handler**
   - Trim `x-tenant-id` header and pass `undefined` when empty into `resolveTenant`.

5. **Legacy paths**
   - Leave as-is but rely on migration 016; ensure all new code and client always send `X-Tenant-Id` for workspace-scoped operations. Optional: add a runtime check that `tenant_id` column exists and 400 if not (document in deploy notes).

6. **Workspaces GET**
   - Keep legacy content_language fallback but add a short comment that it only applies when migration 016 is not applied.

---

## 4. Canonical active workspace (single source of truth)

Refactor ensures **exactly one** active workspace identity is used everywhere.

### Rules

1. **Single source of truth:** `activeWorkspaceId` comes only from `WorkspaceProvider` (cookie + server initial). No component or API may derive “current workspace” from first item in a list, a default, or stale state.
2. **No silent fallbacks:** Workspace-scoped API routes use `requireExplicitTenant: true`. If `X-Tenant-Id` is missing or empty, the handler returns **400** with a clear message; no fallback to first workspace.
3. **Explicit tenant on read/write:** Every workspace-scoped read and write receives `activeWorkspaceId` (client) or `X-Tenant-Id` (API). Query keys, form loaders, and save handlers include `workspace_id` (or use `workspaceScopedKey(url, activeWorkspaceId)` for SWR).
4. **Workspace switch:** On switch, `setActiveWorkspaceAndInvalidate(workspaceId)` updates context, increments `workspaceSwitchKey`, and triggers SWR global mutate so workspace-scoped caches are invalidated. Components that hold workspace-scoped local state use `key={workspaceSwitchKey}` so they remount and clear that state.
5. **No inferring workspace from data:** Components must not assume workspace from previously loaded data; they use `activeWorkspaceId` from context (or `useRequiredActiveWorkspace()` in dev to throw if null).
6. **Dev guard:** In development, `useWorkspaceFetch` throws if `activeWorkspaceId` is null and the request URL is workspace-scoped. Use `useRequiredActiveWorkspace()` where a null workspace is invalid.

### Key pieces

- **Context** (`lib/workspace/context.tsx`): `activeWorkspaceId`, `workspaceSwitchKey`, `setActiveWorkspaceAndInvalidate`, `useActiveWorkspace`, `useRequiredActiveWorkspace`, `useWorkspaceSwitchKey`, `workspaceScopedKey`, `useWorkspaceFetch` (dev guard).
- **API handler** (`lib/api/handler.ts`): `requireExplicitTenant` → 400 when `X-Tenant-Id` missing on workspace-scoped routes.
- **Workspace-scoped routes:** All routes that use `ctx.membership.tenantId` for data have `requireExplicitTenant: true` (api-keys, billing, onboarding-related, social, writing, jobs, images, videos, research, artefacts, assets, admin prompts/settings/keys/provider-keys). User/scoped routes (workspaces list, workspace switch, support, health, contact) remain `tenantOptional` or no tenant.
- **Dashboard:** Uses only `activeWorkspaceId` from context; switch flow calls `setActiveWorkspaceAndInvalidate` then navigates to `/dashboard` (no full reload).
- **Profile / workspace-scoped forms:** Main content wrapped with `key={workspaceSwitchKey}` so local state resets on workspace change.
- **SWR:** Workspace-scoped keys use `workspaceScopedKey("/api/v1/...", activeWorkspaceId)` (e.g. api-keys page, `useOnboarding`).

### Workspace name vs business name

- **Workspace name** lives in `tenants.name` (workspace record). It is set only when creating a workspace (user-entered name) and must be changed only via a dedicated rename flow that updates `tenants` by `id`.
- **Business name** lives in `onboarding_profiles.business_name` (workspace-scoped profile). It is loaded and saved by `tenant_id` + `user_id`; no shared row across workspaces.
- On **blank workspace creation**, `business_name` is pre-populated from `tenants.name` so the wizard shows the workspace name as the initial business name. After that, the two may diverge; no automatic sync.
- **No rename operation updates both:** Editing business name (profile/onboarding PUT) updates only `onboarding_profiles`. Editing workspace name (when implemented) must update only `tenants.name` by workspace id. There is no `syncWorkspaceNameFromProfile` or push from business_name to tenants.name on save/load/complete.

---

## 5. Verification

- After fixes: dashboard layout sets cookie when missing; client initial state prefers cookie over server when present; all dashboard and onboarding fetch calls that hit workspace-scoped APIs send `X-Tenant-Id`.
- Manual: create two workspaces, switch to second, change business name / profile / API key; confirm only the second workspace changes; switch back to first and confirm first is unchanged.
- All workspace-scoped API routes require `X-Tenant-Id` and return 400 when missing; no first-workspace fallback.
