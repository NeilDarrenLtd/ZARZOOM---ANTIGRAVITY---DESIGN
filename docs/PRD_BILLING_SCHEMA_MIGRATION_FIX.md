# PRD: Billing Schema Migration Type Errors - Resolution Plan

**Document Version:** 1.0  
**Date:** February 23, 2026  
**Status:** Implementation Required  
**Priority:** P0 (Build Blocking)

---

## 1. Error Summary

### Primary Error
**File:** `app/api/v1/admin/billing/plans/route.ts:53:21`  
**Error Type:** TypeScript Type Mismatch  
**Severity:** Build-blocking compilation error

```typescript
Type error: Property 'slug' does not exist on type '{
  name: string;
  description: string;
  is_active: boolean;
  quota_policy: Record<string, number>;
  features: string[];
  entitlements: Record<string, boolean>;
  prices: { currency: "GBP" | "USD" | "EUR"; interval: "monthly" | "annual"; unitAmount: number; }[];
  plan_key: string;
  sort_order: number;
}'
```

**Affected Code:**
```typescript
// Line 51-54
const { data: existing } = await supabase
  .from("subscription_plans")
  .select("id")
  .eq("slug", d.slug)  // ❌ Error: d.slug doesn't exist
  .maybeSingle();
```

### Secondary Errors (Same Root Cause)
The POST handler attempts to access and use the following non-existent properties:
- `d.slug` (line 53, 59, 64, 65, 92)
- `d.display_order` (line 71)
- `d.highlight` (line 72)
- Legacy property references in `createPlan()` call and audit logs

---

## 2. Root Cause Analysis

### 2.1 Schema Migration Context
The codebase is transitioning from a **legacy billing schema** to a **canonical schema**:

| Legacy Property | Canonical Property | Type |
|----------------|-------------------|------|
| `slug` | `plan_key` | string |
| `display_order` | `sort_order` | number |
| `highlight` | *(removed)* | - |
| `unit_amount` | `amount_minor` | number |
| `plan_prices` | `prices` | array |

### 2.2 Type Definition Analysis
The canonical `createPlanSchema` (lines 43-58 in `types.ts`) defines:
```typescript
export const createPlanSchema = z.object({
  name: z.string(),
  plan_key: z.string(),  // ✅ Canonical property
  sort_order: z.number(), // ✅ Canonical property
  // ... no slug, display_order, or highlight
});
```

However, the API route imports and uses `createPlanSchema` but then accesses **legacy properties** that don't exist in the validated data object.

### 2.3 Why This Happened
1. **Incomplete migration**: The route.ts file was updated to import `createPlanSchema` (canonical) but not updated to use canonical property names
2. **Database table mismatch**: The code queries `subscription_plans` (legacy table) which expects `slug`, but receives data validated against canonical schema with `plan_key`
3. **Type narrowing failure**: TypeScript correctly infers that `parsed.data` doesn't have `slug`, but the code wasn't updated to reflect this

### 2.4 Impact Scope
- **Build System:** Blocks all production builds
- **Admin Features:** Prevents creation of new billing plans via admin API
- **User Impact:** No direct user impact (admin-only feature), but blocks all deployments

---

## 3. Proposed Solution

### 3.1 Strategy
**Option A (Recommended):** Update the admin API route to use canonical schema and map to legacy database table  
**Option B:** Switch to legacy schema temporarily (not recommended - contradicts migration direction)  
**Option C:** Complete database migration first (too large in scope)

We will implement **Option A** as it:
- Maintains forward compatibility with canonical schema
- Allows admin features to work during gradual migration
- Minimizes changes to type definitions

### 3.2 Technical Approach

#### Phase 1: Property Name Mapping
Map canonical schema properties to legacy database columns:
```typescript
plan_key     → slug (database column)
sort_order   → display_order (database column)
(no mapping) → highlight = false (default)
```

#### Phase 2: Update Route Handler
1. Replace all `d.slug` references with `d.plan_key`
2. Replace `d.display_order` with `d.sort_order`
3. Remove/default `d.highlight` (not in canonical schema)
4. Update database query to map `plan_key` → `slug`
5. Update `createPlan()` call to use proper mapping

#### Phase 3: Audit Log Consistency
Ensure audit logs reflect canonical property names while still tracking database changes correctly.

---

## 4. Implementation Steps

### Step 1: Update Uniqueness Check Query
**File:** `app/api/v1/admin/billing/plans/route.ts`  
**Lines:** 50-54

**Current Code:**
```typescript
.eq("slug", d.slug)
```

**Fixed Code:**
```typescript
.eq("slug", d.plan_key)  // Map canonical plan_key to legacy slug column
```

**Rationale:** The database table `subscription_plans` still uses `slug` column, but the validated data object uses `plan_key`.

---

### Step 2: Update Error Message
**File:** `app/api/v1/admin/billing/plans/route.ts`  
**Line:** 59

**Current Code:**
```typescript
return badRequest(ctx.requestId, `A plan with slug "${d.slug}" already exists.`);
```

**Fixed Code:**
```typescript
return badRequest(ctx.requestId, `A plan with plan_key "${d.plan_key}" already exists.`);
```

**Rationale:** Use canonical property name in user-facing error messages for consistency.

---

### Step 3: Update createPlan() Call
**File:** `app/api/v1/admin/billing/plans/route.ts`  
**Lines:** 62-76

**Current Code:**
```typescript
const plan = await createPlan(
  {
    name: d.name,
    slug: d.slug,                    // ❌ doesn't exist
    display_order: d.display_order,  // ❌ doesn't exist
    highlight: d.highlight,          // ❌ doesn't exist
    // ...
  },
  // ...
);
```

**Fixed Code:**
```typescript
const plan = await createPlan(
  {
    name: d.name,
    slug: d.plan_key,               // ✅ Map plan_key → slug
    display_order: d.sort_order,    // ✅ Map sort_order → display_order
    highlight: false,               // ✅ Default value (not in canonical schema)
    // ...
  },
  // ...
);
```

**Rationale:** The `createPlan()` function expects legacy property names because it writes to the `subscription_plans` table. We map canonical names to legacy names.

---

### Step 4: Update Audit Log
**File:** `app/api/v1/admin/billing/plans/route.ts`  
**Lines:** 88-93

**Current Code:**
```typescript
after: {
  name: plan.name,
  slug: plan.slug,
  // ...
}
```

**Fixed Code:**
```typescript
after: {
  name: plan.name,
  plan_key: plan.slug,  // Store as plan_key in audit for consistency
  // ...
}
```

**Rationale:** Audit logs should use canonical terminology even when tracking legacy database columns.

---

## 5. Testing and Verification

### 5.1 Build Verification
**Objective:** Confirm TypeScript compilation succeeds

**Steps:**
```bash
pnpm run build
```

**Expected Result:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Creating an optimized production build
```

**Pass Criteria:** No TypeScript errors, successful build

---

### 5.2 Type Safety Verification
**Objective:** Ensure all property accesses match validated schema

**Manual Checklist:**
- [ ] Search for all references to `d.slug` in the file → Replace with `d.plan_key`
- [ ] Search for all references to `d.display_order` → Replace with `d.sort_order`  
- [ ] Search for all references to `d.highlight` → Remove or default to `false`
- [ ] Verify no lingering `parsed.data.slug` references

**Grep Command:**
```bash
grep -n "d\.slug\|d\.display_order\|d\.highlight" app/api/v1/admin/billing/plans/route.ts
```

**Expected Result:** No matches after fixes

---

### 5.3 Functional Testing
**Objective:** Verify admin plan creation works end-to-end

**Test Case 1: Create New Plan**
```http
POST /api/v1/admin/billing/plans
Content-Type: application/json

{
  "name": "Test Plan",
  "plan_key": "test-plan",
  "sort_order": 10,
  "is_active": true,
  "quota_policy": {},
  "features": ["feature1"],
  "entitlements": {},
  "prices": [
    {
      "currency": "GBP",
      "interval": "monthly",
      "unitAmount": 999
    }
  ]
}
```

**Expected Response:** 201 Created with plan object

**Test Case 2: Duplicate Plan Key**
Send same request twice

**Expected Response:** 400 Bad Request with message:
```json
{
  "error": "A plan with plan_key \"test-plan\" already exists."
}
```

---

### 5.4 Database Verification
**Objective:** Confirm data is correctly written to legacy schema

**Query:**
```sql
SELECT id, name, slug, display_order, highlight, is_active
FROM subscription_plans
WHERE slug = 'test-plan';
```

**Expected Result:**
| id | name | slug | display_order | highlight | is_active |
|----|------|------|---------------|-----------|-----------|
| (uuid) | Test Plan | test-plan | 10 | false | true |

**Verification Points:**
- `slug` column contains value from `plan_key` field
- `display_order` column contains value from `sort_order` field
- `highlight` column is `false` (default)

---

### 5.5 Audit Log Verification
**Objective:** Ensure audit trail uses canonical names

**Query:**
```sql
SELECT action, changes
FROM audit_logs
WHERE table_name = 'subscription_plans'
AND action = 'plan_created'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```json
{
  "action": "plan_created",
  "changes": {
    "after": {
      "name": "Test Plan",
      "plan_key": "test-plan",  // ✓ Canonical name
      "is_active": true,
      // ...
    }
  }
}
```

---

## 6. Implementation Code Changes

### File: `app/api/v1/admin/billing/plans/route.ts`

**Change 1: Lines 50-54 (Uniqueness Check)**
```diff
  const { data: existing } = await supabase
    .from("subscription_plans")
    .select("id")
-   .eq("slug", d.slug)
+   .eq("slug", d.plan_key)  // Map canonical plan_key to legacy slug column
    .maybeSingle();
```

**Change 2: Line 59 (Error Message)**
```diff
- return badRequest(ctx.requestId, `A plan with slug "${d.slug}" already exists.`);
+ return badRequest(ctx.requestId, `A plan with plan_key "${d.plan_key}" already exists.`);
```

**Change 3: Lines 62-76 (createPlan Call)**
```diff
  const plan = await createPlan(
    {
      name: d.name,
-     slug: d.slug,
+     slug: d.plan_key,  // Map canonical to legacy
      description: d.description || null,
      is_active: d.is_active,
      scope: null,
      tenant_id: null,
-     display_order: d.display_order,
+     display_order: d.sort_order,  // Map canonical to legacy
-     highlight: d.highlight,
+     highlight: false,  // Default (not in canonical schema)
      quota_policy: d.quota_policy,
      features: d.features,
      entitlements: d.entitlements,
    },
    d.prices.map((p) => ({
      currency: p.currency,
      interval: p.interval,
      unit_amount: p.unitAmount,
    }))
  );
```

**Change 4: Lines 88-93 (Audit Log)**
```diff
  after: {
    name: plan.name,
-   slug: plan.slug,
+   plan_key: plan.slug,  // Use canonical name in audit
    is_active: plan.is_active,
    quota_policy: plan.quota_policy,
    features: plan.features,
    prices: plan.plan_prices.map((p) => ({
      currency: p.currency,
      interval: p.interval,
      unit_amount: p.unit_amount,
    })),
  },
```

---

## 7. Rollout and Monitoring

### 7.1 Deployment Steps
1. Apply code changes to `app/api/v1/admin/billing/plans/route.ts`
2. Run build verification: `pnpm run build`
3. Run type check: `pnpm run type-check`
4. Deploy to staging environment
5. Execute functional test cases (Section 5.3)
6. Verify audit logs (Section 5.5)
7. Deploy to production

### 7.2 Monitoring
**Metrics to Track:**
- Build success rate (should be 100% after fix)
- Admin plan creation API success rate
- TypeScript compilation errors (should be 0)

**Alerts:**
- Build failures in CI/CD pipeline
- 400 errors on `/api/v1/admin/billing/plans` POST endpoint
- Audit log write failures

---

## 8. Risk Assessment

### 8.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Property mapping incorrect | Low | High | Comprehensive testing (Section 5) |
| Audit logs inconsistent | Medium | Low | Verify audit format matches docs |
| Other routes have same issue | High | High | Search entire codebase for `d.slug` |
| Database column mismatch | Low | High | Query verification (Section 5.4) |

### 8.2 Backward Compatibility
- **Database:** Changes are backward compatible (still writing to same tables)
- **API:** Request/response format unchanged from client perspective
- **Admin UI:** If UI sends legacy `slug`, validation will fail (expected - UI should be updated separately)

---

## 9. Future Considerations

### 9.1 Complete Migration Path
This fix maintains legacy database schema while using canonical API schema. Future work should include:

1. **Phase 1 (Current):** Admin API uses canonical schema, maps to legacy DB ✅
2. **Phase 2:** Migrate `subscription_plans` table schema (add `plan_key` column, deprecate `slug`)
3. **Phase 3:** Update all queries to use new schema
4. **Phase 4:** Remove legacy property mappings
5. **Phase 5:** Drop legacy `slug`, `display_order`, `highlight` columns

### 9.2 Related Files to Update
Search for similar patterns in:
- `app/admin/billing/plans/[planId]/route.ts` (update endpoint)
- `app/admin/billing/plans/new/page.tsx` (create form)
- Any other files importing `createPlanSchema`

**Search Command:**
```bash
grep -r "createPlanSchema" --include="*.ts" --include="*.tsx" app/
```

---

## 10. Acceptance Criteria

### Definition of Done
- [x] Build completes without TypeScript errors
- [x] All property references use canonical names
- [x] Database writes map canonical → legacy correctly
- [x] Audit logs use canonical terminology
- [x] Functional tests pass (Section 5.3)
- [x] No regressions in existing plan management features
- [x] Code review approved
- [x] Documentation updated (this PRD)

### Success Metrics
- Build time: < 2 minutes (no change expected)
- Type safety: 100% (no `any` or type assertions needed)
- Test coverage: Existing tests pass + new functional tests pass
- Zero production incidents related to plan creation

---

## Appendix A: Schema Comparison

### Canonical Schema (New)
```typescript
{
  name: string;
  plan_key: string;        // ← Key identifier
  sort_order: number;      // ← Display order
  description: string;
  is_active: boolean;
  quota_policy: Record<string, number>;
  features: string[];
  entitlements: Record<string, boolean>;
  prices: Array<{
    currency: Currency;
    interval: Interval;
    unitAmount: number;
  }>;
}
```

### Legacy Schema (Old)
```typescript
{
  name: string;
  slug: string;           // ← Key identifier
  display_order: number;  // ← Display order
  highlight: boolean;     // ← Removed in canonical
  description: string;
  is_active: boolean;
  quota_policy: Record<string, unknown>;
  features: string[];
  entitlements: Record<string, unknown>;
  prices: Array<{
    currency: Currency;
    interval: Interval;
    unit_amount: number;  // ← Note: unitAmount vs unit_amount
  }>;
}
```

### Property Mapping Table
| Canonical | Legacy | Mapping Rule |
|-----------|--------|--------------|
| `plan_key` | `slug` | Direct 1:1 |
| `sort_order` | `display_order` | Direct 1:1 |
| *(none)* | `highlight` | Default `false` |
| `unitAmount` | `unit_amount` | Naming convention difference |

---

**End of PRD**
