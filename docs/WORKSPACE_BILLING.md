# Workspace-Level Billing (ZARZOOM)

Each workspace has its own subscription state. Workspace A may be paid, workspace B unpaid; users can switch between them. Billing is keyed by `workspace_id` (stored as `tenant_id` in the database).

---

## 1. Files changed

| File | Change |
|------|--------|
| `lib/workspace/active.ts` | Added `getActiveWorkspaceIdFromCookie()` for client-side reading of `active_workspace_id` so pricing/checkout can send `X-Tenant-Id` when present. |
| `components/pricing/PricingPageClient.tsx` | When calling `POST /api/v1/billing/checkout`, sends `X-Tenant-Id` header when the active workspace cookie is set (so subscription applies to the current workspace). |
| `components/pricing/pricing-shell.tsx` | Same: checkout request includes `X-Tenant-Id` when cookie is set. |
| `docs/WORKSPACE_BILLING.md` | This document (architecture, mapping, testing). |

No changes were made to:

- Stripe integration (checkout, portal, webhooks)
- Pricing page layout or design
- Database schema (`tenant_subscriptions` was already per-tenant)
- Billing API route logic (they already use `ctx.membership.tenantId`, which is derived from `X-Tenant-Id` or first membership)

---

## 2. Billing architecture

- **Tenant = workspace.** In code and DB, “tenant” and “workspace” are the same; `tenant_id` is the workspace id.

- **One subscription per workspace.**  
  - Table: `tenant_subscriptions` with unique `tenant_id` (one row per workspace).  
  - Stripe Checkout and Customer Portal are created with `metadata.tenant_id` and/or `client_reference_id` so webhooks and portal return sessions are tied to the correct workspace.

- **Resolution of “current” workspace for billing:**
  - **Dashboard:** All API calls that use `useWorkspaceFetch()` send `X-Tenant-Id` (from `active_workspace_id` cookie). So GET subscription, POST checkout, POST portal all run in the context of the **active workspace**.
  - **Public pricing page:** When the user has an `active_workspace_id` cookie (e.g. from a previous dashboard visit), the pricing components send `X-Tenant-Id` on checkout so the new subscription is attached to that workspace. If the cookie is missing, the API falls back to the user’s first membership (unchanged behaviour for existing users).

- **APIs:**
  - `POST /api/v1/billing/checkout` – Uses `ctx.membership.tenantId`; creates Stripe session and upserts `tenant_subscriptions` for that tenant.
  - `GET /api/v1/billing/subscriptions` – Returns subscription for `ctx.membership.tenantId` (active workspace when `X-Tenant-Id` is sent).
  - `POST /api/v1/billing/portal` – Creates Stripe portal for `ctx.membership.tenantId`.
  - `POST /api/v1/billing/webhook` – Updates `tenant_subscriptions` by Stripe subscription id; row already has `tenant_id`; `invalidateEntitlements(tenant_id)` is called per tenant.

- **Entitlements:** Cached and evaluated per `tenantId`; any code that checks plan/entitlements uses the active workspace’s subscription when called with that workspace’s id.

---

## 3. How subscriptions map to workspaces

| Concept | Mapping |
|--------|---------|
| **Workspace id** | Same as `tenant_id` in `tenant_memberships` and `tenant_subscriptions`. |
| **Subscription row** | One row per workspace in `tenant_subscriptions`; `tenant_id` = workspace id. |
| **Stripe** | Checkout/portal metadata and DB store `tenant_id`; webhooks update the row by `billing_provider_subscription_id` (row already has correct `tenant_id`). |
| **Active workspace** | Stored in cookie `active_workspace_id`; sent as `X-Tenant-Id` on API requests from dashboard and (when cookie is set) from the public pricing page. |
| **Switching workspaces** | User switches via dashboard; cookie and UI update; subsequent billing API calls use the new workspace’s id and thus that workspace’s subscription. |

Result: workspace A can have an active subscription while workspace B has none; switching to B shows B’s (e.g. unpaid) state; switching back to A shows A’s paid state.

---

## 4. Testing steps

1. **Existing user, single workspace**
   - Log in, open dashboard, go to profile/pricing.
   - Subscribe (or open portal). Confirm one workspace shows as paid and behaviour is unchanged.

2. **Two workspaces, pay for one**
   - Create or use a second workspace; switch to workspace A.
   - Subscribe (from dashboard or from pricing page after having opened dashboard so cookie is set).
   - Confirm workspace A is paid (e.g. subscription/entitlements for A).
   - Switch to workspace B; confirm B shows no/separate subscription (unpaid).
   - Switch back to A; confirm A still shows paid.

3. **Pay for second workspace**
   - In workspace B, start checkout and complete payment for B.
   - Confirm B now has its own subscription; A still has its subscription.
   - Switch between A and B and confirm each shows its own plan/status.

4. **Portal per workspace**
   - From workspace A, open “Manage billing” (or equivalent) and confirm portal opens for A’s subscription.
   - From workspace B, open manage billing; confirm portal is for B (or “no subscription” if B is unpaid).

5. **Public pricing page and cookie**
   - Log in, open dashboard (so `active_workspace_id` is set), then navigate to `/[locale]/pricing`.
   - Choose a plan and complete checkout; confirm the subscription is attached to the workspace you had active in the dashboard (check in dashboard after switching workspaces).

6. **No cookie (e.g. incognito or cleared cookie)**
   - On public pricing page without cookie, subscribe; confirm subscription is applied to the user’s first workspace (legacy behaviour).

These steps verify workspace-scoped billing without changing existing Stripe integration or redesigning pricing pages.
