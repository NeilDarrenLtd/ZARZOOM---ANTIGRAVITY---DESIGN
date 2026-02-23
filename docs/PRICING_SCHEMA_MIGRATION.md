# Pricing Schema Migration Guide

## Overview

This document outlines the migration from the legacy `subscription_plans` and `plan_prices` tables to the new canonical `plans` table structure introduced in **Migration 005**.

**Migration Script:** `/scripts/005_refactor_pricing_schema.sql`
**TypeScript Types:** `/lib/billing/types.ts`

---

## Schema Changes

### New Tables

#### `plans` (Canonical)
Replaces `subscription_plans` with simplified, clearer naming:

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| `id` | UUID | Primary key | Same as before |
| `plan_key` | TEXT | **New**: Lowercase slug | Replaces `slug` |
| `name` | TEXT | Display name | Same as before |
| `description` | TEXT | Plan description | Same as before |
| `is_active` | BOOLEAN | Active flag | Same as before |
| `sort_order` | INTEGER | **New**: Display order | Replaces `display_order` |
| `entitlements` | JSONB | Feature flags | Same as before |
| `quota_policy` | JSONB | Usage limits | Same as before |
| `features` | JSONB | Feature list (string[]) | Same as before |
| `created_at` | TIMESTAMPTZ | Creation timestamp | Same as before |
| `updated_at` | TIMESTAMPTZ | Update timestamp | Same as before |

**Removed columns from legacy table:**
- `scope` - Not needed for initial implementation
- `tenant_id` - Not needed for initial implementation  
- `highlight` - Can be derived from UI/display logic
- `stripe_product_id` - Moved to separate provider mapping table (future)

#### `plan_prices` (Updated)
Column naming standardized:

| Column | Type | Change | Notes |
|--------|------|--------|-------|
| `amount_minor` | INTEGER | **Renamed** from `unit_amount` | More explicit naming (pence/cents) |

All other columns remain the same.

---

## Migration Strategy

### Phase 1: Data Migration (Automatic)
The migration script automatically:
1. ✅ Creates `plans` table with proper indexes
2. ✅ Migrates all data from `subscription_plans` → `plans`
3. ✅ Renames `unit_amount` → `amount_minor` in `plan_prices`
4. ✅ Updates foreign key constraints
5. ✅ Creates `active_plan_prices` view
6. ✅ Marks `subscription_plans` as deprecated (table kept for safety)

### Phase 2: Code Migration (Manual)
Update all code references from legacy types to canonical types.

---

## TypeScript Type Mapping

### Before (Legacy)
```typescript
import { PlanRow, PlanPriceRow } from '@/lib/billing/types';

interface PlanRow {
  slug: string;
  display_order: number;
  // ...
}

interface PlanPriceRow {
  unit_amount: number;
  // ...
}
```

### After (Canonical)
```typescript
import { Plan, PlanPrice } from '@/lib/billing/types';

interface Plan {
  plan_key: string;  // lowercase slug
  sort_order: number;
  // ...
}

interface PlanPrice {
  amount_minor: number;  // pence/cents
  // ...
}
```

---

## Admin Panel Mapping

### Database Query Updates

#### Before (Legacy)
```typescript
const plans = await supabase
  .from('subscription_plans')
  .select('*, plan_prices(*)')
  .order('display_order');
```

#### After (Canonical)
```typescript
const plans = await supabase
  .from('plans')
  .select('*, plan_prices(*)')
  .order('sort_order');
```

### Field Mapping for Forms

When building admin forms, map legacy fields to new fields:

| Legacy Field | Canonical Field | Input Type | Validation |
|--------------|----------------|------------|------------|
| `slug` | `plan_key` | text | lowercase, alphanumeric + `-_` |
| `display_order` | `sort_order` | number | integer >= 0 |
| `plan_prices.unit_amount` | `plan_prices.amount_minor` | number | integer >= 0 |

### API Response Transformation

For backward compatibility, the API can transform responses:

```typescript
// Internal (database)
const plan: Plan = {
  plan_key: 'pro',
  sort_order: 2,
  // ...
};

// External (API response for legacy clients)
const apiResponse = {
  slug: plan.plan_key,
  display_order: plan.sort_order,
  // ...
};
```

---

## Code Locations to Update

### High Priority (Core Functionality)

1. **`/app/api/v1/billing/plans/route.ts`**
   - Update to query `plans` table instead of `subscription_plans`
   - Use `Plan` and `PlanPrice` types
   - Map to `plan_key` and `amount_minor`

2. **`/lib/billing/queries.ts`**
   - Update all Supabase queries to use `plans` table
   - Update field names in `.select()`, `.order()`, etc.

3. **`/components/onboarding/Step4Plan.tsx`**
   - ⚠️ **CRITICAL**: Currently has hardcoded prices that don't match DB
   - Update to fetch from `GET /api/v1/billing/plans`
   - Use `amount_minor` instead of `unit_amount`

4. **`/components/pricing/pricing-shell.tsx`**
   - Update prop types to use `Plan[]` instead of `PlanRow[]`
   - Update field access: `plan.plan_key`, `plan.sort_order`

5. **`/components/pricing/plan-card.tsx`**
   - Update price display to use `price.amount_minor`
   - Format using `formatPrice(amount_minor, currency)`

### Medium Priority (Display/UI)

6. **`/app/pricing/page.tsx`**
   - Update query to fetch from `plans` table
   - Update sort to use `sort_order`

7. **`/components/PricingSection.tsx`**
   - Update types and field access

8. **`/app/admin/billing/page.tsx`**
   - Update admin panel to query/edit `plans` table
   - Update form fields to use `plan_key` and `sort_order`

### Low Priority (Enforcement/Utilities)

9. **`/lib/billing/enforce.ts`**
   - Update quota enforcement to use `Plan` type

10. **`/lib/billing/format.ts`**
    - Update formatters to handle `amount_minor`

---

## Testing Checklist

### Database Migration
- [ ] Run migration script: `psql -f scripts/005_refactor_pricing_schema.sql`
- [ ] Verify `plans` table created with 3 seed plans
- [ ] Verify `plan_prices` has 18 rows (3 plans × 3 currencies × 2 intervals)
- [ ] Verify `active_plan_prices` view returns correct data
- [ ] Verify foreign keys point to `plans` table

### API Endpoints
- [ ] `GET /api/v1/billing/plans` returns plans with `plan_key`
- [ ] Prices include `amount_minor` field
- [ ] Plans sorted by `sort_order`
- [ ] Only `is_active=true` plans returned

### UI Components
- [ ] Pricing page displays all 3 plans correctly
- [ ] Prices formatted correctly (£9.99, not £999)
- [ ] Onboarding wizard shows correct prices from API
- [ ] Admin panel can create/edit plans with new fields

### Type Safety
- [ ] TypeScript compilation passes with no errors
- [ ] No references to deprecated `PlanRow` in new code
- [ ] IDE autocomplete shows `plan_key` not `slug`

---

## Rollback Plan

If issues arise, the migration can be rolled back:

1. **Database rollback:**
   ```sql
   BEGIN;
   
   -- Restore FK to subscription_plans
   ALTER TABLE tenant_subscriptions 
     DROP CONSTRAINT IF EXISTS tenant_subscriptions_plan_id_fkey;
   
   ALTER TABLE tenant_subscriptions
     ADD CONSTRAINT tenant_subscriptions_plan_id_fkey
     FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);
   
   -- Revert plan_prices FK
   ALTER TABLE plan_prices 
     DROP CONSTRAINT IF EXISTS plan_prices_plan_id_fkey_new;
   
   ALTER TABLE plan_prices
     ADD CONSTRAINT plan_prices_plan_id_fkey
     FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);
   
   -- Rename amount_minor back to unit_amount
   ALTER TABLE plan_prices RENAME COLUMN amount_minor TO unit_amount;
   
   COMMIT;
   ```

2. **Code rollback:**
   - Revert Git commit
   - Redeploy previous version

---

## Support for Unlimited Plans/Currencies

The new schema natively supports:

✅ **Unlimited plans**: Just insert new rows into `plans` table
✅ **Unlimited currencies**: Just add new rows to `plan_prices` with different `currency` values
✅ **Active/inactive flags**: Use `is_active` on both tables to hide plans/prices without deleting
✅ **Price history**: Use `effective_from`/`effective_to` for time-based pricing
✅ **Performance**: Indexed on common query patterns

### Example: Adding a New Plan

```sql
-- 1. Insert plan
INSERT INTO plans (plan_key, name, description, sort_order, is_active, entitlements, quota_policy, features)
VALUES (
  'enterprise',
  'Enterprise',
  'Custom solution for large teams.',
  4,
  true,
  '{"social_publish": true, "research_social": true, ...}'::jsonb,
  '{"posts_published_count": 9999, ...}'::jsonb,
  '["Everything in Advanced", "Dedicated support", ...]'::jsonb
);

-- 2. Add prices (supports any currency)
INSERT INTO plan_prices (plan_id, currency, interval, amount_minor, is_active)
SELECT p.id, v.currency, v.interval, v.amount_minor, true
FROM plans p
CROSS JOIN (VALUES
  ('GBP', 'monthly', 19999),
  ('USD', 'monthly', 24999),
  ('EUR', 'monthly', 22999),
  ('JPY', 'monthly', 2999999)  -- New currency!
) AS v(currency, interval, amount_minor)
WHERE p.plan_key = 'enterprise';
```

---

## Contact

For questions or issues during migration:
- Check the audit document: `/docs/PRICING_AUDIT_2026.md`
- Review the migration script: `/scripts/005_refactor_pricing_schema.sql`
- See TypeScript types: `/lib/billing/types.ts`
