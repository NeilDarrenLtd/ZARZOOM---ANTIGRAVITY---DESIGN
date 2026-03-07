# API & Integrations Page — Backend Integration

The **API & Integrations** page (`/dashboard/api-keys`) is connected to the workspace-scoped API key backend. The active workspace can view (masked) keys, generate a key, revoke a key, and generate a new key (rotate). OpenClaw and Skills tabs are unchanged.

---

## 1. Files changed

| File | Change |
|------|--------|
| **components/dashboard/create-key-modal.tsx** | Added optional `initialName` prop. When the modal is opened from the Rotate flow, the key name is pre-filled so the user can create a replacement key with the same label without retyping. |
| **app/dashboard/api-keys/page.tsx** | Passes `initialName={showRotateModal ? rotateName : undefined}` to `CreateKeyModal` so the rotate flow pre-fills the name. |
| **docs/API_INTEGRATIONS_PAGE.md** | This document. |

**Not changed:** API & Integrations page layout, tabs (API / OpenClaw / Skills), API key list/cards, revoke/rotate buttons, or admin. The page was already using `useWorkspaceFetcher` and `useWorkspaceFetch` for GET/POST/DELETE; only the rotate → create name pre-fill was added.

---

## 2. How workspace scoping works

- **Active workspace:** The dashboard layout resolves the active workspace from the `active_workspace_id` cookie (or the user’s first membership) and provides it via `ActiveWorkspaceProvider`. The API & Integrations page runs inside this layout.
- **All API key requests:** The page uses:
  - **useWorkspaceFetcher()** for `GET /api/v1/api-keys` (SWR).
  - **useWorkspaceFetch()** for `DELETE /api/v1/api-keys` (revoke) and for the create modal’s `POST /api/v1/api-keys`.
- **X-Tenant-Id:** Both helpers send the active workspace id as the **X-Tenant-Id** header on every request to `/api/v1/*`. The API handler uses `ctx.membership.tenantId` (from that header or session), so:
  - **GET** returns only keys for the current user in the **active workspace**.
  - **POST** creates a key in the **active workspace**.
  - **DELETE** revokes a key only if it belongs to the **active workspace** (and the current user).
- **Switching workspace:** Changing the workspace (e.g. via dashboard switcher) updates the cookie and re-renders the page; the next fetch uses the new workspace id, so the list and actions apply to the newly selected workspace.

---

## 3. How API key creation works

1. **Create new key:** User clicks “Create Key” → `CreateKeyModal` opens. User enters a name and clicks “Create Key” → **POST /api/v1/api-keys** with body `{ name, scopes? }` via `workspaceFetch` (so **X-Tenant-Id** is sent). Backend creates the key for `ctx.membership.tenantId`, returns key metadata and **raw_key** once. Modal shows the “reveal” step with the raw key and a warning; user copies and clicks “Done”. Modal closes; page calls `mutate()` so SWR refetches the key list for the active workspace.
2. **Generate new key (rotate):** User clicks “Rotate” on a key → **DELETE /api/v1/api-keys** with `{ key_id }` (revoke) via `workspaceFetch`. On success, the modal opens with the **same key name pre-filled** (`initialName={rotateName}`). User confirms or edits the name and clicks “Create Key” → same **POST** as above. New key is created for the active workspace; raw key is shown once; list is refreshed.

No raw key is ever shown in the list; only **masked** form (e.g. `zarz_live_****`) and **metadata** (created, last used, revoked) from the GET response are displayed in `ApiKeyRow`.

---

## 4. Test instructions

### Prerequisites

- Log in and open the dashboard. Ensure at least one workspace exists and the active workspace is set (cookie or first membership).
- API key backend and DB are up; `api_keys` table exists.

### 4.1 View keys (masked) and metadata

1. Go to **API & Integrations** (`/dashboard/api-keys`). Ensure the **API** tab is selected.
2. If the workspace has no keys: “No API keys yet” and “Create Your First Key” are shown.
3. If the workspace has keys: each key appears with **masked** value (e.g. `zarz_live_****`), **name**, **Created** date, and **Last used** (if any). Revoked keys show **Revoked** and revoked-at date. No full key value is visible.

### 4.2 Generate a key

1. Click **Create Key**. Enter a name (e.g. “Test key”) and click **Create Key**.
2. The modal shows the raw key once with a warning. Copy it and click **Done**.
3. The list refreshes; the new key appears with masked value and created date. Confirm the raw key does not appear in the list.

### 4.3 Revoke a key

1. On an active key, click **Revoke**, then confirm. The key moves to “Revoked” and the revoked date appears.
2. Confirm the key can no longer be used for API auth (e.g. call an authenticated endpoint with that key → 401).

### 4.4 Generate a new key (rotate)

1. On an active key, click **Rotate**, then confirm. The key is revoked and the create modal opens with the **same name** pre-filled.
2. Click **Create Key** (or edit the name and create). Copy the new raw key from the reveal step and click **Done**.
3. The list shows the old key as revoked and the new key as active with masked value. The old key no longer works; the new one does.

### 4.5 Workspace scoping

1. Create a key in workspace A (note the masked key name).
2. Switch the active workspace to B (e.g. via dashboard workspace switcher). Reload or navigate back to API & Integrations.
3. The key created in A should **not** appear in the list (list is for workspace B).
4. Switch back to A; the key should appear again. All actions (revoke, rotate) apply only to the active workspace’s keys.

### 4.6 OpenClaw and Skills unchanged

1. Switch to the **OpenClaw** tab: same placeholder content and “Connect OpenClaw” button; no backend changes.
2. Switch to the **Skills** tab: same placeholder content and “Explore Skills” button; no backend changes.

---

Summary: API keys are scoped by the active workspace via **X-Tenant-Id**; the page shows masked keys and metadata, and supports create, revoke, and rotate (revoke + create with name pre-filled) without UI redesign and without modifying admin.
