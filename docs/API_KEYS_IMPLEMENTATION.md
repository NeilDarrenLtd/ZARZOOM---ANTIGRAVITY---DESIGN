# Secure Workspace-Level API Keys — Implementation

Workspace-scoped API keys: create, revoke, regenerate. Keys are linked to `workspace_id` (stored as `tenant_id`), never stored in plaintext, and the raw key is shown only once.

---

## 1. Files changed

| File | Change |
|------|--------|
| **lib/api-keys/validate.ts** | Lookup by `key_hash` instead of `key_prefix` + limit(100). Single indexed query; production-safe at scale. Removed unused `timingSafeEqual` import. |
| **app/api/v1/api-keys/regenerate/route.ts** | New POST handler: revoke key by `key_id`, create new key with same name/scopes, return new key metadata + `raw_key` once. |
| **docs/API_KEYS_IMPLEMENTATION.md** | This document. |

**Not changed (as requested):** No UI changes. Existing `app/api/v1/api-keys/route.ts` (GET/POST/DELETE), `lib/api-keys/generate.ts`, dashboard api-keys page, and create-key modal are unchanged.

---

## 2. Schema additions

The `api_keys` table is defined in **scripts/004_extend_schema_multi_tenant.sql**. No new schema file was added; ensure that migration has been applied.

**Table: `public.api_keys`**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key. |
| tenant_id | UUID | Workspace (workspace_id). Keys are scoped to one workspace. |
| user_id | UUID | User who created the key (FK auth.users). |
| name | TEXT | Display name (e.g. "Production key"). |
| key_hash | TEXT | **Only stored form.** SHA-256(API_KEY_PEPPER + raw_key). Never store plaintext. |
| key_prefix | TEXT | e.g. `zarz_live_` for display in lists. |
| scopes_json | JSONB | Optional scopes; default `{}`. |
| created_at | TIMESTAMPTZ | Set on insert. |
| last_used_at | TIMESTAMPTZ | Updated on successful validation (fire-and-forget). |
| revoked_at | TIMESTAMPTZ | Set when revoked; non-null = revoked. |

**Constraints**

- `UNIQUE (tenant_id, key_hash)` — same hash cannot be reused in the same tenant.
- RLS: users read/update own keys; tenant admins can read/update all keys in the tenant. Service role used for server-side validation.

**Indexes**

- `api_keys_tenant_user_idx` — (tenant_id, user_id)
- `api_keys_key_hash_idx` — (key_hash) — used for validation lookup.

---

## 3. How key generation works

1. **Random material:** 32 bytes (256 bits) from a cryptographically secure RNG (`crypto.randomBytes(32)`), encoded as hex → 64-char string.
2. **Format:** `zarz_live_` + hex string (e.g. `zarz_live_a1b2c3...`). Prefix identifies ZARZOOM live keys.
3. **Hash for storage:** `key_hash = SHA-256(API_KEY_PEPPER + raw_key)`.
   - `API_KEY_PEPPER` is a server-side secret (env). If the DB is leaked, hashes cannot be reversed or brute-forced without the pepper.
4. **What is stored:** Only `key_hash`, `key_prefix`, and metadata (name, tenant_id, user_id, scopes_json, timestamps). The raw key is **never** written to the DB.
5. **What is returned once:** On create (POST) and on regenerate (POST …/regenerate), the response includes `raw_key`. The UI or client must store it; it is never returned again by any endpoint. GET list returns only `prefix` (e.g. `zarz_live_****`).

**Code:** `lib/api-keys/generate.ts` — `generateApiKey()`, `hashApiKey(rawKey)`.

---

## 4. How revoke and regenerate work

### Revoke (DELETE /api/v1/api-keys)

- Body: `{ "key_id": "<uuid>" }`.
- Resolve workspace and user from session (X-Tenant-Id + auth).
- Ensure the key exists, belongs to that tenant and the current user (or tenant admin).
- Set `revoked_at = now()`; do not delete the row (audit trail).
- Audit log: `api_key_revoked`.
- Response: key id, name, status `revoked`, `revoked_at`. No key material.

After revoke, that key can no longer be used for authentication.

### Regenerate (POST /api/v1/api-keys/regenerate)

- Body: `{ "key_id": "<uuid>" }`.
- Load the key by id, tenant_id, and user_id; must be active (`revoked_at` null). Return 404 or 400 if not found or already revoked.
- Enforce `max_api_keys` quota (after revoke, creating one new key keeps count unchanged).
- **Revoke** the old key: set `revoked_at = now()`. Log `api_key_revoked` with reason `regenerate`.
- **Create** a new key with the same `name` and `scopes_json` (new id, new random key, new hash). Log `api_key_created` with `regenerated_from: key_id`.
- Response: new key metadata + **`raw_key`** (shown once), `revoked_key_id`, and a warning to store the new key.

Regenerate = revoke old + create new in one call; the new key is returned only in this response.

---

## 5. Test instructions

### Prerequisites

- Applied migration that creates `api_keys` (e.g. **scripts/004_extend_schema_multi_tenant.sql**).
- `API_KEY_PEPPER` set in env (required in production; can be empty in dev).
- Authenticated user with at least one workspace (tenant). Use session cookies and `X-Tenant-Id` for workspace scope.

### 5.1 Create key (raw key only once)

1. **POST** `/api/v1/api-keys` with session auth and `X-Tenant-Id` (or rely on first membership).
   - Body: `{ "name": "Test key", "scopes": {} }`.
   - Expect **201**. Response must include `key` (id, name, prefix, scopes, created_at, status) and **`raw_key`** (full key string).
2. Copy `raw_key`. Then call **GET** `/api/v1/api-keys`. Confirm the key appears with same id/name/prefix and **no** `raw_key` or full secret.
3. Call **GET** again or list in UI: raw key must never appear again.

### 5.2 Authenticate with key

1. **GET** an endpoint that accepts API key auth (e.g. a protected API route) with header:
   - `Authorization: Bearer <raw_key>`.
2. Expect **200** (or the normal success for that endpoint). The request is resolved to the key’s workspace and user.
3. Call with invalid or revoked key: expect **401**.

### 5.3 Revoke

1. **DELETE** `/api/v1/api-keys` with body `{ "key_id": "<id of a key you own>" }` (session auth + same workspace).
2. Expect **200** and response with `status: "revoked"`, `revoked_at` set.
3. Call the same protected endpoint with that key again: expect **401**.
4. **DELETE** again with same `key_id`: expect **200** with message that key was already revoked.

### 5.4 Regenerate

1. Create a key and note its `key_id` and `raw_key`.
2. **POST** `/api/v1/api-keys/regenerate` with body `{ "key_id": "<id>" }` (session auth + same workspace).
3. Expect **201**. Response must include a **new** `key.id`, new `created_at`, **`raw_key`** (new value), and `revoked_key_id` equal to the old id.
4. Authenticate with the **old** raw key: expect **401**.
5. Authenticate with the **new** raw key: expect success.
6. Call **POST** `/api/v1/api-keys/regenerate` again with the **same** (now revoked) `key_id`: expect **400** (already revoked).

### 5.5 Workspace isolation

1. Create a key in workspace A (set `X-Tenant-Id` to A’s id when creating).
2. Switch to workspace B (e.g. change `X-Tenant-Id`). **GET** `/api/v1/api-keys`: the key created in A must not appear (or must not be usable in B’s context; keys are listed per workspace).
3. Using the raw key from A, call an API that uses that key for auth: the request must be scoped to workspace A (tenant_id from the key), not B.

### 5.6 Quota and security

1. Enforce `max_api_keys` for the workspace’s plan. Create keys until you hit the limit; next create should fail with quota exceeded (e.g. 402).
2. Confirm no endpoint ever returns `raw_key` except the create and regenerate responses. Search responses and UI for any plaintext key storage or display after first show.

These steps cover create, show-once, revoke, regenerate, auth, workspace scope, and basic security expectations.
