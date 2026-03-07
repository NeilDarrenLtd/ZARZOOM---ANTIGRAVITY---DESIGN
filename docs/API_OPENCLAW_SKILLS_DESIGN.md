# API / OpenClaw / Skills Feature Design (ZARZOOM)

**Goal:** Each workspace can manage API keys, OpenClaw integration, and Skills configuration, with API access as the primary focus.

**Requirements (API keys):**
- API keys belong to a workspace
- Users can create and revoke keys
- Keys must never be stored in plain text
- Keys are displayed only once on creation

This document analyses the existing implementation and recommends schema, security, UI, and rollout for the full feature set.

---

## 1. Recommended schema

### 1.1 API keys (existing — keep as-is)

The current `api_keys` table already matches the requirements and is workspace-scoped. **No schema change required.**

```sql
-- Existing (scripts/004_extend_schema_multi_tenant.sql)
CREATE TABLE public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,                    -- workspace
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL,                    -- SHA-256(pepper + raw_key), never raw
  key_prefix   TEXT NOT NULL,                   -- e.g. "zarz_live_"
  scopes_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  CONSTRAINT api_keys_tenant_hash_unique UNIQUE (tenant_id, key_hash)
);
```

- **tenant_id** = workspace; all keys are scoped to a workspace.
- **key_hash** only; raw key is never persisted. Shown once in the POST response and in the create-key modal.
- **Multiple keys per workspace:** Supported; quota enforced via `max_api_keys` in plan `quota_policy`.

**Optional future columns** (only if needed later):
- `expires_at TIMESTAMPTZ` — for time-limited keys.
- `description TEXT` — optional longer description (name is already a short label).

### 1.2 OpenClaw integration (new — per workspace)

OpenClaw is the “agent automation” integration (marketing: “OpenClaw agents handle everything autonomously”). Treat it as **one configuration per workspace**: enable/disable, webhook URL, optional credentials, and which “Skills” or flows are allowed.

Recommended table:

```sql
-- New: one row per workspace
CREATE TABLE public.workspace_openclaw_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  webhook_url   TEXT,
  webhook_secret_hash TEXT,       -- hashed like API keys if you store a secret
  allowed_skills JSONB NOT NULL DEFAULT '[]'::jsonb,  -- list of skill IDs or keys
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_openclaw_tenant ON public.workspace_openclaw_config(tenant_id);
```

- **tenant_id UNIQUE:** One OpenClaw config per workspace.
- **allowed_skills:** References which Skills (by id or key) can be triggered for this workspace; empty = none until Skills exist.

### 1.3 Skills configuration (new — global definitions, per-workspace enablement)

“Skills” are discrete capabilities (e.g. “generate image”, “publish to LinkedIn”). Recommended split:

- **Global Skill definitions** (what exists in the product): e.g. `skills` table with `id`, `key`, `name`, `description`, `required_entitlement`, `api_scopes`, etc.
- **Per-workspace enablement:** Either:
  - In **plan entitlements** (e.g. “image_generate”, “social.publish”) — already in place — and/or
  - A **workspace_skills** table if you need explicit on/off per skill per workspace beyond plan:

```sql
-- Optional: only if you need explicit per-workspace skill toggles
CREATE TABLE public.workspace_skills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  skill_key  TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(tenant_id, skill_key)
);
```

Start with **entitlements + OpenClaw `allowed_skills`**; add `workspace_skills` only if you need per-skill config (e.g. custom prompts or limits) that isn’t covered by plan or OpenClaw.

### 1.4 Summary

| Area           | Table / concept                         | Scope        |
|----------------|----------------------------------------|-------------|
| API keys       | `api_keys`                             | Per workspace (tenant_id); multiple keys per user/workspace |
| OpenClaw       | `workspace_openclaw_config`            | One row per workspace |
| Skills         | Plan entitlements + `allowed_skills`; optionally `skills` + `workspace_skills` | Global definitions; per-workspace enablement / config |

---

## 2. Security approach

### 2.1 API keys (current — keep)

- **Storage:** Only `key_hash` is stored. Hash = `SHA-256(API_KEY_PEPPER + raw_key)` (see `lib/api-keys/generate.ts`). No plaintext or reversible cipher.
- **Show once:** Raw key returned only in POST create response; UI shows it in a single “reveal” step with a warning, then never again (see `CreateKeyModal`).
- **Validation:** Constant-time comparison of hashes in `validate.ts` to avoid timing leaks. Lookup by `key_prefix` then match hash; revoked keys excluded.
- **Auth pipeline:** `Authorization: Bearer <key>` → `validateZarzApiKey()` → `ApiKeyIdentity` (tenantId, userId, scopes). Request is then scoped to that workspace.
- **RLS:** Users see only their own keys; tenant admins can read/update all keys in the tenant. Service role for server-side validation.

**Recommendations:**
- Keep **API_KEY_PEPPER** required in production (env); rotate only with a planned key-rotation flow (revoke old keys, re-create).
- **Idempotency:** Already in place for create (POST) to avoid duplicate keys on retries; idempotency payload does not store `raw_key`.
- **Audit:** `api_key_created` and `api_key_revoked` are already logged; continue to log key creation/revocation and optionally last_used_at changes for security reviews.

### 2.2 OpenClaw

- **Webhook secret:** If you store a secret for inbound OpenClaw webhooks, store only a hash (same pattern as API keys). Never log or return the raw secret.
- **Outbound:** Use API keys (workspace-scoped) or short-lived tokens when ZARZOOM calls OpenClaw; avoid storing third-party secrets in plaintext.
- **allowed_skills:** Validate that values in `allowed_skills` exist in your Skills catalog and that the workspace’s plan allows them (entitlement check) before enabling.

### 2.3 Skills

- **Authorization:** When executing a Skill (via API or OpenClaw), check (1) API key or session → tenant, (2) tenant’s plan entitlements, (3) if using OpenClaw, that the skill is in `allowed_skills` for that tenant.
- **Scopes:** Existing `scopes_json` on API keys can map to allowed Skills or endpoints; enforce in the API handler (e.g. require scope `images:generate` for image generation).

### 2.4 Multiple keys

- **Multiple keys per workspace:** Already supported and recommended (different keys for different environments or services; revoke one without affecting others). Quota `max_api_keys` (per plan) limits count.
- **No sharing across workspaces:** Keys are bound to a single `tenant_id`; switching workspace implies different keys/subscription.

---

## 3. UI structure recommendation

### 3.1 Primary focus: API access

- **API Keys** stays the main surface: create, list, revoke, rotate; show prefix + last used; never show full key after creation.
- Current location: **`/dashboard/api-keys`**. Keep it as the primary “API access” page and ensure it’s easy to find (e.g. from dashboard home and/or a persistent nav).

### 3.2 Grouping: “API & Integrations” or “Developer”

Introduce a clear grouping so API Keys, OpenClaw, and Skills live in one mental model:

- **Option A — Single page with tabs:**
  - **`/dashboard/api`** or **`/dashboard/developer`**
  - Tabs: **API Keys** | **OpenClaw** | **Skills**
  - API Keys tab: current api-keys page content (or embed same component).
  - OpenClaw tab: enable/disable, webhook URL, webhook secret (masked), `allowed_skills` multi-select.
  - Skills tab: read-only list of available skills + per-workspace toggles if you add `workspace_skills`.

- **Option B — Separate pages, shared section:**
  - **`/dashboard/api-keys`** (current)
  - **`/dashboard/openclaw`** (new)
  - **`/dashboard/skills`** (new, or “Skills & automation”)
  - Dashboard home has one card: **“API & Integrations”** with short description and links to these three. Same nav/sidebar section for all three.

Recommendation: **Option B** for clarity and to avoid one heavy page. Use a shared section in the dashboard nav (or dashboard home) named **“API & Integrations”** with links to API Keys, OpenClaw, and Skills.

### 3.3 Workspace context

- All three areas are **workspace-scoped**. Use the existing workspace switcher; ensure:
  - API Keys list/create/revoke use `workspaceFetch` (already do).
  - OpenClaw and Skills pages use the same pattern (same `X-Tenant-Id` / active workspace).
- Show the current workspace name on each page so it’s obvious which workspace’s keys/config are being edited.

### 3.4 Copy and discoverability

- On the API Keys page, keep the “How to call the API” snippet and link to full API docs.
- Add a short line: “Use these keys for the ZARZOOM API and for OpenClaw integrations” so the link to OpenClaw is clear.
- OpenClaw page: explain that enabling OpenClaw allows agent-driven automation for this workspace and that Skills control which actions are allowed.

---

## 4. Rollout plan

### Phase 1 — API keys (done)

- [x] Schema: `api_keys` with `tenant_id`, hash-only storage, show-once creation.
- [x] Security: pepper, constant-time compare, revoke, audit.
- [x] API: GET list, POST create (return raw once), DELETE revoke; quota `max_api_keys`.
- [x] UI: `/dashboard/api-keys`, create modal with reveal step, revoke/rotate.
- [x] Auth: API key auth in handler; request scoped to workspace.

**No schema or security redesign needed;** current implementation meets the stated requirements.

### Phase 2 — OpenClaw integration

1. **Schema:** Add `workspace_openclaw_config` (and migrations).
2. **API:**  
   - `GET/PATCH /api/v1/workspace/openclaw` (or `/api/v1/openclaw/config`) — read/update config for `ctx.membership.tenantId`.  
   - Validate `allowed_skills` against plan and Skills catalog.
3. **UI:** Add **`/dashboard/openclaw`** (or under `/dashboard/api/openclaw`). Form: enable, webhook URL, webhook secret (masked, optional), multi-select for allowed Skills (if Skills exist).
4. **Docs:** Document how OpenClaw agents authenticate (e.g. workspace API key) and which endpoints they can call.

### Phase 3 — Skills configuration

1. **Define Skills:** List of skill keys and names (e.g. in code or `skills` table). Map to existing entitlements where applicable.
2. **Use in OpenClaw:** Restrict `allowed_skills` to this list; enforce in OpenClaw webhook or API when triggering actions.
3. **UI:** **`/dashboard/skills`** — list available Skills; show which are enabled for the current plan; if you add `workspace_skills`, show per-workspace toggles and optional config.
4. **API:** If needed, `GET /api/v1/skills` (catalog) and `GET/PATCH /api/v1/workspace/skills` for per-workspace enablement/config.

### Phase 4 — Polish and docs

- Add **“API & Integrations”** to dashboard home and/or nav with links to API Keys, OpenClaw, Skills.
- Ensure workspace switcher is prominent on all three.
- Document workspace-scoped billing + API keys + OpenClaw in one “Workspace API & automation” section in product docs.

---

## 5. Summary

| Output                  | Recommendation |
|-------------------------|----------------|
| **Schema**              | Keep `api_keys` as-is. Add `workspace_openclaw_config` (one per workspace). Skills: use entitlements + `allowed_skills` first; add `skills` / `workspace_skills` only if you need explicit per-skill config. |
| **Security**            | Keys: hash-only (SHA-256 + pepper), show once, constant-time compare, revoke, audit. OpenClaw/Skills: no plaintext secrets; validate Skills and plan before enabling. Multiple keys per workspace supported; quota enforced. |
| **UI**                  | Keep API Keys as primary at `/dashboard/api-keys`. Add `/dashboard/openclaw` and `/dashboard/skills`. Group under “API & Integrations” on dashboard/nav; all workspace-scoped with visible workspace context. |
| **Rollout**             | Phase 1 API keys (done). Phase 2 OpenClaw config + API + UI. Phase 3 Skills catalog + per-workspace enablement. Phase 4 nav, copy, and docs. |

This keeps the existing API key implementation intact, extends the model for OpenClaw and Skills without redesigning pricing or billing, and gives a clear path to ship each piece.
