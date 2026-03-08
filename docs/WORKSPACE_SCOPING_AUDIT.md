# Workspace vs user-scoping audit

Audit of tables and models for onboarding, profile/business, brand, API settings, connected accounts, support, and dashboard preferences. Each is classified as **user-scoped** (one row or state per user) or **workspace-scoped** (one row per workspace, or per tenant_id + user_id where applicable).

---

## 1. Onboarding

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **onboarding_profiles** | **Workspace** | `tenant_id` + `user_id` (composite PK in 016). One row per workspace per user. Load/save by `tenant_id` + `user_id`. ✓ |

---

## 2. Profile / business details

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **profiles** | **User** | Auth-linked profile: `id` = auth user, `email`, `display_name`, `is_admin`, `is_suspended`, autofill flags. One row per user. Correct. |
| **onboarding_profiles** (business_name, etc.) | **Workspace** | Part of onboarding; workspace-scoped. ✓ |

---

## 3. Brand settings

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **onboarding_profiles** (brand_color_hex, logo_url) | **Workspace** | Stored in onboarding_profiles per workspace. ✓ |
| **brand-logos storage** | **Workspace** | Path should be `{tenant_id}/{user_id}/{filename}` (or `{tenant_id}/{filename}`) so each workspace has its own logos. Migration 017 adds policy; upload-logo route uses tenant_id in path when available. |

---

## 4. API settings

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **api_keys** | **Workspace** | `tenant_id` + `user_id`; RLS by tenant. ✓ |
| **provider_secrets** (admin) | **Workspace** | `tenant_id`; per-tenant provider keys. ✓ |
| **tenant_settings** (e.g. default_language) | **Workspace** | One row per tenant. GET/PUT use `tenant_id`. Migration 017 ensures table exists. ✓ |
| **app_settings** (Upload-Post API key, etc.) | **App** | Singleton (id=1). Global config. Correct. |
| **site_settings** | **App** | Key/value; admin-only. Global. Correct. |

---

## 5. Connected accounts

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **onboarding_profiles.uploadpost_profile_username** | **Workspace** | Per-workspace Upload-Post username. ✓ |
| **upload_post_mapping** | **Was user** → **Workspace** | Previously one row per user (PK `user_id`). Refactored to one row per workspace per user: add `tenant_id`, unique `(tenant_id, user_id)`. Connect-url route sends X-Tenant-Id and upserts by (tenant_id, user_id). Migration 017 + backfill. |
| **social_profiles** (social connect) | **Workspace** | Used with tenant_id in social routes. ✓ |

---

## 6. Support settings / context

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **support_settings** | **App** | Single row: support recipient email. Admin-only. Correct. |
| **support_tickets** | **User** | `user_id`; tickets belong to the user. Intentionally user-scoped (one queue per user across workspaces). No change. |
| **support_comments** | **User** (via ticket) | Via ticket ownership. No change. |
| **support_attachments** | **User** (via ticket) | Via ticket ownership. No change. |

---

## 7. Dashboard preferences

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **tenant_settings** | **Workspace** | default_language etc. per tenant. ✓ |
| **Workspace list / content_language** | **Workspace** | From onboarding_profiles per tenant in workspaces GET. ✓ |

---

## 8. Autofill / wizard

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **wizard_autofill_settings** | **App** | Singleton (id=1); admin OpenRouter prompts. Correct. |
| **wizard_autofill_audit** | **Was user** → **Workspace** | Previously `user_id` only. Add `tenant_id`; backfill from first membership. Inserts (audit log) pass tenant_id so each workspace has its own audit trail. Migration 017. |
| **profiles** (autofill_daily_count, autofill_lifetime_count, etc.) | **User** | Usage limits are per user (2/day, degrade after 10). Left as user-level; optional future table per workspace if product wants per-workspace limits. |

---

## 9. Prompt templates (admin)

| Table / model | Scope | Notes |
|---------------|--------|--------|
| **prompt_templates** | **Workspace** | tenant_id in admin prompts route. ✓ |

---

## Summary of refactors

1. **upload_post_mapping** – Add `tenant_id`; unique `(tenant_id, user_id)`; backfill; connect-url uses X-Tenant-Id and upserts by (tenant_id, user_id).
2. **wizard_autofill_audit** – Add `tenant_id`; backfill; logAutofillAudit and any insert pass tenant_id.
3. **tenant_settings** – Ensure table exists (create if not); one row per tenant.
4. **brand-logos storage** – Policy and path use `tenant_id` when available; upload-logo writes under `{tenant_id}/{filename}` or `{tenant_id}/{user_id}/{filename}`.

No shared profile/business row across workspaces: onboarding_profiles is already per (tenant_id, user_id). Updates use membership checks and workspace_id filters; duplicate/create flows (e.g. workspace create with copy onboarding) create fresh rows for the new workspace.
