# Workspace Feature — Audit and End-to-End Wiring

## PART 1 — Review: Current Implementation

### Workspace database / schema

- **tenants** (scripts/015_workspace_foundation.sql): `id`, `name`, `status` (draft | active | payment_required | inactive), `created_at`, `updated_at`. One row per workspace.
- **tenant_memberships**: `tenant_id`, `user_id`, `role` (owner | admin | member | viewer). Links users to workspaces. RLS allows select/insert for own user.
- **Backfill**: Migration 015 runs `backfill_workspaces_for_users()` so every user with a profile but no membership gets one tenant ("My Workspace", status active) and one membership (owner). Single-workspace behaviour is preserved.

### Create-workspace backend

- **POST /api/v1/workspaces** (app/api/v1/workspaces/route.ts): Auth required, tenant optional. Inserts into `tenants` (name from body or "My Workspace", status `draft`), inserts into `tenant_memberships` (current user, role `owner`). Sets `active_workspace_id` cookie to the new tenant id and returns the new workspace (status `setup_incomplete` in response). **Working.**

### Active workspace context

- **Cookie**: `active_workspace_id` (lib/workspace/active.ts). Not httpOnly so client can send it as X-Tenant-Id.
- **Server**: Dashboard layout calls `getActiveWorkspaceId(supabase, user.id, cookieValue)`. If cookie is set and user is a member of that tenant, use it; else use first membership. Sets cookie if it was missing/invalid.
- **Client**: `ActiveWorkspaceProvider` (lib/workspace/context.tsx) provides `initialActiveWorkspaceId` from the layout. `useWorkspaceFetch()` / `useWorkspaceFetcher()` add `X-Tenant-Id` to requests when present. **Working.**

### Workspace switcher UI

- **WorkspaceSwitcher** (components/dashboard/WorkspaceSwitcher.tsx): Dropdown with workspace list, status badges, and "Add Workspace". **Existed but was not rendered on the dashboard page** — only the inline Workspaces card was shown. So there was no header dropdown to switch or add.

### Add Workspace button / action

- **Dashboard page** had `handleAddWorkspace` calling POST /api/v1/workspaces with fixed name "My Workspace", then redirecting to `/dashboard`. **Issues**: (1) No way to give the new workspace a name. (2) Redirect to dashboard only; user was not taken into a clear setup/onboarding flow for the new workspace.

### Onboarding flow for a new workspace

- **onboarding_profiles** is **per user** (user_id PK), not per workspace. So there is a single onboarding profile per user. The **dashboard profile page** uses `workspaceFetch("/api/v1/onboarding")` so it runs in the active workspace context, but the onboarding API itself does not scope by tenant. **Minimal fix**: After creating a workspace, redirect to `/dashboard/profile` so the user lands in “setup” with the new workspace active; no schema change to onboarding.

### Billing / workspace status logic

- **GET /api/v1/workspaces** loads memberships, tenants, and `tenant_subscriptions`. `toWorkspaceStatus(tenant.status, sub.status)` maps to `active` | `setup_incomplete` | `payment_required`: subscription past_due/unpaid → payment_required; active/trialing → active; tenant draft/inactive → setup_incomplete. **Working.** UI was using "Active" instead of "Paid" and inconsistent casing.

### How current workspace is resolved

- **Layout**: Server reads `active_workspace_id` cookie, validates membership, else first membership; sets cookie if needed; passes id to `ActiveWorkspaceProvider`.
- **API**: Handlers use `ctx.membership.tenantId` from `resolveTenant()`, which prefers `X-Tenant-Id` then falls back to first membership. **Working.**

### What was missing or partial

1. **Header switcher**: WorkspaceSwitcher was not used on the dashboard, so no single place to switch or add workspace in the header.
2. **Add Workspace**: No name input; redirect was to dashboard only, not to a setup flow.
3. **Status labels**: UI used "Active" / "Setup incomplete" / "Payment required"; requirement was "Paid" / "Setup Incomplete" / "Payment Required" and consistent casing.

---

## PART 2 — What Was Implemented

### A. Add Workspace

- **Name**: Clicking "Add Workspace" (header switcher or card) now prompts for a name via `window.prompt` (i18n key `dashboard.workspaceNamePrompt`), default "My Workspace"; value is trimmed and limited to 200 chars in the body.
- **Create**: Unchanged: POST /api/v1/workspaces creates tenant (draft) + membership (owner); API sets `active_workspace_id` cookie to the new workspace.
- **Redirect**: On success, redirect to **/dashboard/profile** so the user lands in setup for the new workspace. On failure or catch, redirect to /dashboard.

### B. Workspace switching

- **Header**: WorkspaceSwitcher is now rendered in the dashboard header (next to Sign out). It receives `workspaces`, `currentWorkspaceId`, `onSwitch`, `onAddWorkspace`.
- **List**: Workspaces still loaded with GET /api/v1/workspaces (unchanged); list shows all workspaces for the user.
- **Switch**: Clicking a workspace calls POST /api/v1/workspace/switch with `workspace_id`; API sets `active_workspace_id` cookie; client then does `window.location.href = "/dashboard"` so the page reloads and layout resolves the new workspace. Fallback: if the API fails, set cookie client-side and reload.

### C. Workspace status

- **API**: No change; GET /api/v1/workspaces still returns `status`: `active` | `setup_incomplete` | `payment_required`.
- **UI**: All status labels updated to: **Paid** (active), **Setup Incomplete** (setup_incomplete), **Payment Required** (payment_required). Applied in both the Workspaces card and WorkspaceSwitcher (`getStatusConfig`).

### D. Existing behaviour

- No change to layout resolution or backfill; existing users keep first workspace as default when cookie is missing.
- No admin changes. No redesign; only header switcher added and labels/redirect/prompt adjusted.

---

## PART 3 — Expected Behaviour After the Fix

1. **Log in** → Dashboard shows; current workspace is the one from cookie or first membership.
2. **See current workspace** → Header dropdown shows current workspace name and status (Paid / Setup Incomplete / Payment Required); Workspaces card shows the same list and statuses.
3. **Click "Add Workspace"** → Prompt for name (or use default) → New workspace is created, cookie set to it, redirect to **/dashboard/profile** (setup for that workspace).
4. **Create a new workspace** → As above; new workspace is in draft/setup_incomplete until they complete setup or add payment.
5. **Go through setup** → User is on profile/setup for the new workspace; they can complete onboarding/brand settings there.
6. **Return to switcher and swap** → From header dropdown or Workspaces card, select another workspace → Switch API sets cookie, page reloads → Dashboard and all data resolve for the selected workspace.
7. **Status badges** → Each workspace in the list and in the dropdown shows the correct status (Paid / Setup Incomplete / Payment Required).
8. **Correct workspace context** → All dashboard API calls use `workspaceFetch` / X-Tenant-Id, so data (profile, API keys, support, etc.) is for the active workspace.

---

## OUTPUT SUMMARY

### 1. Root cause(s) of why the feature was not working

- **Add Workspace**: No name input; redirect to dashboard only (no clear “setup for this workspace” step).
- **Switching**: No header switcher; only the Workspaces card had switch buttons, and the dedicated WorkspaceSwitcher component was never mounted, so “the dashboard header switcher” did not exist.
- **Status**: Labels were “Active” / “Setup incomplete” / “Payment required” instead of the requested “Paid” / “Setup Incomplete” / “Payment Required”.

### 2. Files changed

| File | Change |
|------|--------|
| app/dashboard/page.tsx | handleAddWorkspace: name prompt, redirect to /dashboard/profile on success; status labels → Paid / Setup Incomplete / Payment Required; header now includes WorkspaceSwitcher with workspaces, currentWorkspaceId, onSwitch, onAddWorkspace. |
| components/dashboard/WorkspaceSwitcher.tsx | getStatusConfig: "Active" → "Paid", "Setup incomplete" → "Setup Incomplete", "Payment required" → "Payment Required". |
| locales/en/app.json | dashboard.workspaceNamePrompt: "Workspace name?" |
| docs/WORKSPACE_FEATURE_AUDIT_AND_FIX.md | This document. |

### 3. What wiring was added/fixed

- **Add Workspace**: Prompt for name; redirect to `/dashboard/profile` after create so the new workspace is active and user is in setup.
- **Header switcher**: WorkspaceSwitcher rendered in dashboard header; same handlers as the Workspaces card (switch + add).
- **Status**: Single set of labels (Paid / Setup Incomplete / Payment Required) in both the card and the switcher.

### 4. How Add Workspace now works

1. User clicks "Add Workspace" (header dropdown or card).
2. Browser prompt: "Workspace name?" (or locale equivalent), default "My Workspace".
3. User enters name (or cancels → default "My Workspace"); name trimmed, max 200 chars.
4. POST /api/v1/workspaces with `{ name }`; backend creates tenant (draft) + membership (owner), sets `active_workspace_id` cookie to new tenant id.
5. Client redirects to **/dashboard/profile**; layout reads cookie, so profile/setup loads in the new workspace context.

### 5. How workspace switching now works

1. User opens header dropdown (WorkspaceSwitcher) or uses the Workspaces card.
2. List is from GET /api/v1/workspaces (all memberships for the user).
3. User clicks a workspace → POST /api/v1/workspace/switch with `{ workspace_id }`; API validates membership and sets `active_workspace_id` cookie.
4. Client does `window.location.href = "/dashboard"`; page reloads; layout reads cookie and sets active workspace; dashboard and child pages use that workspace via X-Tenant-Id.

### 6. How workspace status is determined

- **Server** (GET /api/v1/workspaces): For each membership, tenant row gives `status` (draft | active | payment_required | inactive); tenant_subscriptions gives subscription `status`. `toWorkspaceStatus(tenantStatus, subStatus)`:
  - Subscription past_due or unpaid → **payment_required**
  - Subscription active or trialing → **active**
  - Else tenant status active → **active**; payment_required → **payment_required**; draft/inactive/default → **setup_incomplete**
- **UI**: Maps to labels **Paid** (active), **Setup Incomplete** (setup_incomplete), **Payment Required** (payment_required).

### 7. Exact manual test steps

1. **Log in and see current workspace**  
   - Log in, go to dashboard.  
   - Check: Header shows a workspace dropdown with current workspace name and a status (Paid / Setup Incomplete / Payment Required).  
   - Check: Workspaces card shows the same workspace(s) with the same statuses.

2. **Switch workspace (if you have more than one)**  
   - Open the header dropdown.  
   - Click a different workspace.  
   - Check: Page reloads; header and card show the selected workspace as current.  
   - Check: Navigate to Profile, API & Integrations, Support; data and actions are for the selected workspace (e.g. different API keys or profile per workspace if you set them up).

3. **Add Workspace**  
   - Click "Add Workspace" (in header dropdown or on the card).  
   - In the prompt, enter a name (e.g. "Test Workspace 2") and confirm.  
   - Check: You are redirected to /dashboard/profile.  
   - Check: Header dropdown shows the new workspace as current with status "Setup Incomplete" (or similar).  
   - Check: Workspaces card lists the new workspace.

4. **Setup and status**  
   - With the new workspace active, complete or change profile/onboarding as needed.  
   - Go back to dashboard.  
   - Check: New workspace still selected; status reflects subscription/tenant (e.g. Setup Incomplete until paid or completed).

5. **Switch back to first workspace**  
   - In header or card, select the original workspace.  
   - Check: Page reloads; original workspace is current; its data (profile, API keys, etc.) is shown when you open those pages.

6. **Single-workspace user**  
   - As a user with only one workspace, open dashboard.  
   - Check: That workspace is selected; no errors; status shown (Paid / Setup Incomplete / Payment Required).  
   - Check: Add Workspace still works and creates a second workspace and redirects to profile.

7. **Status badges**  
   - For a workspace with active subscription: label "Paid".  
   - For a draft/new workspace: "Setup Incomplete".  
   - For a workspace with past_due/unpaid subscription: "Payment Required".

Run these in order; if any step fails, note which step and what you see so we can adjust.
