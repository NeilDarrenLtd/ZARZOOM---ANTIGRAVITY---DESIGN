# Workspace System – Root Causes and Fix Plan

## 1. Root causes

### 1.1 Workspace name and business name are not synced
- **Where:** `tenants.name` and `onboarding_profiles.business_name` are stored and updated independently.
- **Comment in code:** `app/api/v1/onboarding/route.ts` states they are independent; product requirement is they must be the same.
- **Broken behaviour:** Changing business name in Profile does not update workspace name; renaming workspace does not update business name.

### 1.2 Pre-filled workspace copies entire profile including state
- **Where:** `app/api/v1/workspaces/route.ts` POST handler, when `copy_onboarding_from_workspace_id` is set.
- **Broken:** Copies full `onboarding_profiles` row (minus tenant_id, user_id, timestamps). So it copies `onboarding_status`, `onboarding_step`, `business_name` from source, and connection state (`socials_connected`, `uploadpost_profile_username`).
- **Required:** Copy only brand/profile fields. New workspace must have `business_name = new name`, `onboarding_status = "not_started"`, `onboarding_step = 1`, and no integrations/state.

### 1.3 No sync when business name or workspace name changes
- **PUT /api/v1/onboarding:** Updates only `onboarding_profiles`. Does not update `tenants.name`.
- **PATCH /api/v1/workspaces/[workspaceId]:** Updates only `tenants.name`. Does not update `onboarding_profiles.business_name`.

### 1.4 Legacy code paths use user_id only
- **Where:** `app/api/v1/onboarding/route.ts` has legacy branches that query/update by `user_id` only when schema lacks `tenant_id`. Those paths can mix workspaces if multiple profiles exist.

## 2. Files and functions to change

| File | Change |
|------|--------|
| `app/api/v1/onboarding/route.ts` | After successful PUT, if `business_name` changed, update `tenants.name` for this tenant (admin client). |
| `app/api/v1/workspaces/[workspaceId]/route.ts` | After PATCH rename, update `onboarding_profiles.business_name` for this tenant (all rows for tenant_id). |
| `app/api/v1/workspaces/route.ts` | Pre-filled path: copy only brand/profile fields; set `business_name = name`, `onboarding_status = "not_started"`, `onboarding_step = 1`; do not copy state/integrations. |

## 3. Brand-only fields for pre-filled copy

Copy: business_description, website_url, content_language, auto_publish, article_styles, article_style_links, brand_color_hex, logo_url, goals, website_or_landing_url, product_or_sales_url, selected_plan, discount_opt_in, approval_preference, additional_notes.

Do not copy: onboarding_status, onboarding_step, business_name, onboarding_completed_at, uploadpost_profile_username, socials_connected, tenant_id, user_id, created_at, updated_at, autofill_*.

## 4. Fix summary

1. **Sync on profile save:** In PUT /api/v1/onboarding, after updating onboarding_profiles, if payload contains business_name, update tenants.name for tenant_id (admin).
2. **Sync on workspace rename:** In PATCH /api/v1/workspaces/[id], after updating tenants.name, update onboarding_profiles.business_name for that tenant_id (all rows).
3. **Pre-filled creation:** Build insert from source profile using only the brand fields list; set tenant_id, user_id, business_name=name, onboarding_status=not_started, onboarding_step=1.
4. **Default profile on first GET:** When creating a new onboarding profile for a workspace, set business_name from tenants.name and onboarding_step = 1.

## 5. Manual QA steps (acceptance tests)

- **Test 1 – Blank workspace A:** Create workspace "Alpha" (blank). Wizard starts at step 1; business name = "Alpha".
- **Test 2 – Blank workspace B:** Create workspace "Beta" (blank). Wizard starts fresh; no Alpha data visible.
- **Test 3 – Business name → workspace name:** In Beta, edit business name (Profile/Brand). Workspace name updates to match; Alpha unchanged.
- **Test 4 – Pre-filled workspace C:** Create "Gamma" (pre-filled from Alpha). Gamma has only profile/brand copied; API keys, connected accounts, support, onboarding state empty; onboarding step 1, status not_started.
- **Test 5 – Edit Gamma:** Change Gamma’s profile; confirm Alpha unchanged.
- **Test 6 – Banner per workspace:** Complete onboarding in Alpha; leave Beta incomplete. Dashboard banner shows per workspace (e.g. no banner in Alpha, banner in Beta).
