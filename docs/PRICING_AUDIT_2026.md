# ZARZOOM Pricing Implementation Audit
**Date:** February 23, 2026  
**Status:** Planning Phase (No Implementation Yet)

---

## Executive Summary

This audit identifies all pricing storage locations, UI rendering points, and hardcoded assumptions across the ZARZOOM codebase. The goal is to create a migration path toward a **single canonical pricing API** (`GET /api/v1/billing/plans`) that serves as the sole source of truth.

---

## 1. Database Tables Storing Pricing

### Primary Tables

#### `subscription_plans`
**Location:** Supabase database  
**Purpose:** Master plan metadata  
**Columns:**
- `id` (uuid) - Primary key
- `name` (text) - Display name
- `slug` (text) - Unique identifier (basic, pro, advanced)
- `description` (text)
- `is_active` (boolean)
- `display_order` (integer)
- `highlight` (boolean) - For "Most Popular" badge
- `quota_policy` (jsonb) - Usage limits
- `features` (jsonb) - Feature list
- `entitlements` (jsonb) - Permission flags
- `scope` (text) - global or tenant
- `tenant_id` (uuid) - For tenant-specific plans
- `stripe_product_id` (text) - Stripe integration
- `created_at`, `updated_at`

**Current Data:** 3 active plans (Basic, Pro, Advanced)  
**Seed Script:** `scripts/seed-plans.sql`

#### `plan_prices`
**Location:** Supabase database  
**Purpose:** Multi-currency, versioned pricing  
**Columns:**
- `id` (uuid) - Primary key
- `plan_id` (uuid) - FK to subscription_plans
- `currency` (text) - GBP, USD, EUR
- `interval` (text) - monthly, annual
- `unit_amount` (integer) - Price in minor units (pence/cents)
- `is_active` (boolean)
- `effective_from` (timestamp)
- `effective_to` (timestamp) - For price versioning
- `billing_provider_price_id` (text) - Stripe price ID
- `created_by` (uuid)
- `created_at`, `updated_at`

**Current Prices:**
```
Basic:   £9.99/mo  (999),  £99.90/yr  (9990)
         $12.99/mo (1299), $129.90/yr (12990)
         €11.99/mo (1199), €119.90/yr (11990)

Pro:     £29.99/mo (2999),  £299.90/yr (29990)
         $39.99/mo (3999),  $399.90/yr (39990)
         €34.99/mo (3499),  €349.90/yr (34990)

Advanced: £59.99/mo (5999),  £599.90/yr (59990)
          $79.99/mo (7999),  $799.90/yr (79990)
          €69.99/mo (6999),  €699.90/yr (69990)
```

#### `active_plan_prices` (VIEW)
**Location:** Supabase database  
**Purpose:** Simplified query for current active prices  
**Filters:**
- `is_active = true`
- `effective_from <= now()`
- `(effective_to IS NULL OR effective_to > now())`
- Plan is active

### Supporting Tables

#### `tenant_subscriptions`
**Purpose:** Track which plan each tenant is on  
**Relevant Columns:**
- `plan_id` - Current plan
- `price_id` - Current price variant
- `status` - active, trialing, past_due, etc.
- `billing_provider_subscription_id` - Stripe subscription ID

---

## 2. i18n Files Containing Pricing Values

### `locales/en.json`

#### Lines 1071-1109: `billing.pricing` Section
**Type:** Display strings only (NO PRICE VALUES)  
**Content:**
- Interval labels: "Monthly", "Annual"
- Badge text: "Most Popular"
- CTA text: "Get Started"
- Savings label: "Save {percent}% with annual billing"
- Trial label: "{days}-day free trial"

#### Lines 1082-1107: `billing.features` Section
**Type:** Feature descriptions per plan  
**Content:**
```json
{
  "basic": {
    "socialProfiles": "Up to 3 social profiles",
    "postsPerMonth": "30 posts per month",
    "aiGeneration": "Basic AI content generation",
    ...
  },
  "pro": { ... },
  "advanced": { ... }
}
```

**Status:** ✅ **NO HARDCODED PRICES IN I18N**  
Features are duplicated between DB (quota_policy) and i18n, but prices themselves come from DB.

---

## 3. UI Locations Rendering Pricing

### A. Public Pricing Page
**File:** `app/pricing/page.tsx`  
**Data Source:** Direct Supabase query (RSC)  
**Query:**
```typescript
supabase
  .from("subscription_plans")
  .select("..., plan_prices(...)")
  .eq("is_active", true)
  .order("display_order", { ascending: true })
```

**Flow:**
1. Server component fetches plans + prices
2. Passes to `<PricingShell />` client component
3. Currency/interval selection handled client-side
4. Price lookup via `findPrice()` helper

**Components:**
- `components/pricing/pricing-shell.tsx` - Main container
- `components/pricing/plan-card.tsx` - Individual plan cards
- `components/pricing/currency-toggle.tsx` - Currency selector
- `components/pricing/interval-toggle.tsx` - Monthly/Annual toggle

**Pricing Lookup:**  
Uses `lib/billing/format.ts` helpers:
- `findPrice(prices, currency, interval)` - Finds matching price
- `formatPrice(unitAmount, currency)` - Formats with symbol
- `annualSavingsPercent()` - Calculates discount %

**Status:** ✅ **Database-driven, no hardcoded prices**

---

### B. Landing Page Pricing Section
**File:** `components/PricingSection.tsx`  
**Data Source:** Receives `plans: PlanWithPrices[]` as prop  
**Parent:** Likely `app/page.tsx` (main landing page)

**Features:**
- Hardcoded 3-plan assumption: `plans.length === 3 ? plans[1].slug : "pro"`
- Highlights middle plan when exactly 3 plans exist
- Fallback to "pro" slug otherwise

**Static Feature Maps:**
```typescript
const PLAN_FEATURES: Record<string, string[]> = {
  basic: ["billing.features.basic.socialProfiles", ...],
  pro: ["billing.features.pro.socialProfiles", ...],
  advanced: ["billing.features.advanced.socialProfiles", ...],
}
```

**Status:** ⚠️ **Assumes 3 plans, hardcoded feature i18n keys**

---

### C. Onboarding Wizard (Step 4)
**File:** `components/onboarding/Step4Plan.tsx`  
**Data Source:** ❌ **HARDCODED PRICES**

**Hardcoded Values:**
```typescript
const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  basic: { monthly: 29, annual: 290 },
  pro: { monthly: 79, annual: 790 },
  scale: { monthly: 199, annual: 1990 },
};
```

**Plan Names:**
```typescript
export const PLAN_OPTIONS = ["basic", "pro", "scale"] as const;
```

**Discrepancy:** Uses "scale" instead of "advanced" slug!

**Features:**
```typescript
const PLAN_FEATURES: Record<Plan, string[]> = {
  basic: ["onboarding.step4.features.basic.socialProfiles", ...],
  pro: ["onboarding.step4.features.pro.*", ...],
  scale: ["onboarding.step4.features.scale.*", ...],
}
```

**Currency:** Fixed to GBP (£ symbol from i18n)  
**Status:** 🚨 **FULLY HARDCODED - NOT USING DATABASE**

---

### D. Brand Basics Wizard
**File:** Not explicitly found in search  
**Likely Location:** `components/onboarding/` (other steps)  
**Status:** ℹ️ **Need to verify if pricing shown**

---

### E. Dashboard / Profile Plan Display
**File:** `app/dashboard/profile/page.tsx`  
**Search Result:** Contains "Currency" references  
**Status:** ℹ️ **Need deeper inspection - likely shows current plan**

---

## 4. Hardcoded 3-Plan Assumptions

### Direct References

1. **`components/PricingSection.tsx:65`**
   ```typescript
   const highlightSlug = plans.length === 3 ? plans[1].slug : "pro";
   ```
   **Risk:** Breaks if plans !== 3 (e.g., adding a "free" tier)

2. **`components/onboarding/Step4Plan.tsx`**
   ```typescript
   {PLAN_OPTIONS.map((plan) => ( ... ))} // Always renders 3 cards
   ```
   **Risk:** Cannot dynamically add/remove plans

3. **`lib/billing/enforce.ts:12`**
   ```typescript
   const PLAN_TIER_ORDER = ["free", "basic", "pro", "advanced", "enterprise"];
   ```
   **Risk:** Hardcoded tier hierarchy for feature gating

### Indirect References

4. **Grid Layouts:**
   ```typescript
   <div className="grid gap-4 lg:grid-cols-3">
   ```
   Used in multiple components - assumes 3 columns

5. **Database Seed Script:**
   ```sql
   -- Always seeds exactly 3 plans
   INSERT INTO subscription_plans VALUES (...Basic...), (...Pro...), (...Advanced...);
   ```

---

## 5. Currency Logic

### Supported Currencies
**Definition:** `lib/billing/types.ts`
```typescript
export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
```

### Currency Formatting
**File:** `lib/billing/format.ts`
```typescript
const CURRENCY_CONFIG: Record<Currency, { symbol: string; locale: string }> = {
  GBP: { symbol: "£", locale: "en-GB" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
};

function formatPrice(unitAmount: number, currency: Currency): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(unitAmount / 100);
}
```

### Currency Selection
**Mechanism:** Client-side localStorage  
**Key:** `"zarzoom_currency"`  
**Flow:**
1. User selects currency in `<CurrencyToggle />`
2. Saved to localStorage
3. Rehydrated on mount
4. Filters available prices

**Fallback Chain:**
1. Try selected currency + interval
2. If not found, try GBP + same interval
3. Show "Contact us" if no price exists

**Status:** ✅ **Well-structured, extensible**

---

## 6. Existing API Routes

### Public Endpoint
**Route:** `GET /api/v1/billing/plans`  
**File:** `app/api/v1/billing/plans/route.ts`  
**Auth:** None (public)  
**Response:**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Basic",
      "slug": "basic",
      "description": "...",
      "plan_prices": [
        { "currency": "GBP", "interval": "monthly", "unit_amount": 999, ... }
      ]
    }
  ]
}
```

**Data Source:** `lib/billing/queries.ts::getPlans({ status: "active" })`  
**Status:** ✅ **Already exists and works correctly**

### Admin Endpoints
**Route:** `GET /api/v1/admin/billing/plans`  
**File:** `app/api/v1/admin/billing/plans/route.ts`  
**Auth:** Admin role required  
**Features:**
- Query param: `?status=active|archived`
- Full CRUD: GET, POST, PATCH, DELETE

**Route:** `POST /api/v1/admin/billing/plans`  
**Features:**
- Create new plan with prices
- Validation via Zod schema
- Audit logging

**Route:** `POST /api/v1/admin/billing/plans/[planId]/prices`  
**Features:**
- Version a price (sets effective_to on old, creates new)
- Never overwrites existing prices

---

## 7. Checkout Flow

**File:** `app/api/v1/billing/checkout/route.ts`  
**Input:**
```json
{
  "plan_code": "basic",
  "currency": "GBP",
  "interval": "month"
}
```

**Process:**
1. Resolve plan by `slug = plan_code`
2. Query `active_plan_prices` view for matching price
3. Validate `stripe_product_id` and `billing_provider_price_id` exist
4. Create/retrieve Stripe customer
5. Create Stripe Checkout Session
6. Upsert `tenant_subscriptions` row with status "incomplete"
7. Return `{ url }` for redirect

**Status:** ✅ **Uses database-driven pricing**

---

## 8. File Map - Current Implementation

### Database Layer
```
scripts/
├── seed-plans.sql                      # Seeds 3 plans + 18 prices (3×3×2)
└── 004_extend_schema_multi_tenant.sql  # Schema with versioning support
```

### Type Definitions
```
lib/billing/
├── types.ts        # Currency, Interval, PlanRow, PriceRow types
├── queries.ts      # getPlans, createPlan, versionPrice, etc.
├── format.ts       # formatPrice, findPrice, annualSavingsPercent
└── enforce.ts      # Feature gating (PLAN_TIER_ORDER hardcoded)
```

### Public Pricing UI
```
app/pricing/page.tsx                       # RSC: fetches DB directly
components/pricing/
├── pricing-shell.tsx                      # Client: currency/interval state
├── plan-card.tsx                          # Renders single plan
├── currency-toggle.tsx                    # Currency selector
└── interval-toggle.tsx                    # Monthly/Annual toggle
```

### Landing Page
```
app/page.tsx                               # Likely passes plans to PricingSection
components/PricingSection.tsx              # ⚠️ Hardcoded 3-plan assumption
```

### Onboarding Wizard
```
components/onboarding/
├── Step4Plan.tsx                          # 🚨 HARDCODED PRICES
└── ...                                    # Other steps (need audit)

lib/validation/onboarding.ts               # Validation schemas
```

### API Routes
```
app/api/v1/billing/
├── plans/route.ts                         # Public: GET plans
├── checkout/route.ts                      # POST: Create checkout session
└── ...

app/api/v1/admin/billing/plans/
├── route.ts                               # Admin: CRUD plans
├── [planId]/route.ts                      # Admin: Update single plan
└── [planId]/prices/route.ts               # Admin: Version prices
```

### i18n
```
locales/en.json
└── billing.pricing.*                      # Display strings (no prices)
└── billing.features.*                     # Feature descriptions
```

---

## 9. Refactoring Plan - Toward Single API

### Goal
**All UI components fetch pricing from `GET /api/v1/billing/plans` instead of:**
- Hardcoded constants
- Direct Supabase queries in RSC
- Local state

### Phase 1: Fix Onboarding Wizard (High Priority)

#### Problem
`Step4Plan.tsx` uses hardcoded prices that:
- Don't match database (29 vs 9.99, 79 vs 29.99, etc.)
- Use wrong slug ("scale" vs "advanced")
- Only show GBP
- Cannot be updated without code deploy

#### Solution
```typescript
// components/onboarding/Step4Plan.tsx

// BEFORE (hardcoded)
const PLAN_PRICES = {
  basic: { monthly: 29, annual: 290 },
  pro: { monthly: 79, annual: 790 },
  scale: { monthly: 199, annual: 1990 },
};

// AFTER (API-driven)
const [plans, setPlans] = useState<PlanWithPrices[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/v1/billing/plans')
    .then(r => r.json())
    .then(data => {
      setPlans(data.plans);
      setLoading(false);
    });
}, []);

// Render dynamically based on API response
const price = findPrice(plan.plan_prices, currency, interval);
```

**Benefits:**
- Prices stay in sync with DB
- Supports multi-currency in wizard
- Can add/remove plans without code changes

**Migration Steps:**
1. Update `Step4Plan.tsx` to fetch from API
2. Remove `PLAN_PRICES` constant
3. Remove `PLAN_OPTIONS` from `lib/validation/onboarding.ts`
4. Update Zod schema to accept any plan slug
5. Change "scale" references to "advanced"
6. Add loading state + error handling
7. Update i18n keys from `onboarding.step4.features.scale.*` to `.advanced.*`

---

### Phase 2: Standardize Landing Page

#### Problem
`PricingSection.tsx` receives plans as props from `app/page.tsx`, which likely does its own Supabase query.

#### Solution
```typescript
// app/page.tsx (RSC)

// BEFORE (probably)
const supabase = await createAdminClient();
const { data: plans } = await supabase
  .from('subscription_plans')
  .select('..., plan_prices(...)');

// AFTER (use shared query helper)
import { getPlans } from '@/lib/billing/queries';
const plans = await getPlans({ status: 'active' });
```

**Benefits:**
- Consistent query logic
- Easier to test
- Centralizes filtering

**Migration Steps:**
1. Audit `app/page.tsx` to confirm it fetches plans
2. Replace direct query with `getPlans()`
3. No change needed in `PricingSection.tsx` (already accepts plans prop)

---

### Phase 3: Remove 3-Plan Assumptions

#### Problem
`highlightSlug = plans.length === 3 ? plans[1].slug : "pro"` breaks with ≠3 plans.

#### Solution
```typescript
// BEFORE
const highlightSlug = plans.length === 3 ? plans[1].slug : "pro";

// AFTER (use DB flag)
const highlightedPlan = plans.find(p => p.highlight);
const highlightSlug = highlightedPlan?.slug ?? plans[0]?.slug;
```

**Benefits:**
- Admin can mark any plan as "Most Popular"
- Supports 2, 3, 4+ plans
- No magic numbers

**Migration Steps:**
1. Update `components/PricingSection.tsx` line 65
2. Update `components/onboarding/Step4Plan.tsx` to use `plan.highlight`
3. Test with 2 plans and 4 plans

---

### Phase 4: Consolidate Feature Lists

#### Problem
Features exist in 3 places:
1. `subscription_plans.features` (jsonb in DB)
2. `locales/en.json` (i18n keys)
3. Hardcoded `PLAN_FEATURES` objects in UI components

#### Solution
**Option A: Store features in DB, fetch via API**
```sql
-- Already in DB
UPDATE subscription_plans
SET features = '[
  "Up to 3 social profiles",
  "30 posts per month",
  "Basic AI content generation"
]'::jsonb
WHERE slug = 'basic';
```

**Option B: Keep i18n, reference by key**
```typescript
// Store i18n keys in DB
features: ["billing.features.basic.socialProfiles", ...]

// UI resolves via t()
{plan.features.map(key => (
  <li key={key}>{t(key)}</li>
))}
```

**Recommendation:** Option A for simplicity (avoid i18n key coupling).

**Migration Steps:**
1. Audit all `PLAN_FEATURES` constants
2. Verify `subscription_plans.features` are populated
3. Remove hardcoded feature arrays
4. Render `plan.features` directly from API response

---

### Phase 5: Migrate Pricing Page to API (Optional)

#### Current State
`app/pricing/page.tsx` is a Server Component that queries Supabase directly.

#### Consideration
**Pros of keeping direct query:**
- Faster (no API roundtrip)
- Can use edge caching
- Simpler for static page

**Pros of using API:**
- Consistent with client components
- Easier to add middleware (rate limiting, caching headers)
- Testable via HTTP

**Recommendation:** Keep RSC query for `/pricing`, but ensure it uses `lib/billing/queries.ts::getPlans()` for consistency.

---

### Phase 6: Update Feature Gating

#### Problem
`lib/billing/enforce.ts` has hardcoded tier order:
```typescript
const PLAN_TIER_ORDER = ["free", "basic", "pro", "advanced", "enterprise"];
```

#### Solution
Store tier/priority in DB:
```sql
ALTER TABLE subscription_plans ADD COLUMN tier_level INTEGER;

UPDATE subscription_plans SET tier_level = 1 WHERE slug = 'basic';
UPDATE subscription_plans SET tier_level = 2 WHERE slug = 'pro';
UPDATE subscription_plans SET tier_level = 3 WHERE slug = 'advanced';
```

Then compare numerically instead of array index.

**Migration Steps:**
1. Add `tier_level` column to schema
2. Update seed script
3. Modify `lib/billing/enforce.ts` to use numeric comparison
4. Remove `PLAN_TIER_ORDER` constant

---

## 10. Migration Risks & Notes

### High Risk

1. **Onboarding Price Mismatch**
   - Wizard shows wrong prices (29 vs 9.99)
   - Users may expect different pricing upon checkout
   - **Impact:** Revenue loss, user confusion
   - **Mitigation:** Fix immediately (Phase 1)

2. **"Scale" vs "Advanced" Slug**
   - Onboarding saves `selected_plan: "scale"` to DB
   - Checkout API expects "basic", "pro", "advanced"
   - **Impact:** Checkout will fail for wizard users
   - **Mitigation:** Data migration + code update

3. **3-Plan Grid Layouts**
   - CSS `grid-cols-3` breaks with 4+ plans
   - **Impact:** UI layout issues
   - **Mitigation:** Use responsive grids (`md:grid-cols-2 lg:grid-cols-3`)

### Medium Risk

4. **Currency Fallback Logic**
   - If price missing, falls back to GBP
   - **Impact:** User sees unexpected currency
   - **Mitigation:** Show "Contact us" instead of fallback

5. **Price Versioning**
   - `effective_from`/`effective_to` not yet utilized
   - **Impact:** Cannot schedule price changes
   - **Mitigation:** Document before use

### Low Risk

6. **i18n Feature Keys**
   - Changing from `billing.features.scale.*` to `.advanced.*`
   - **Impact:** Missing translations in non-English locales
   - **Mitigation:** Update all locale files

7. **Stripe Product/Price IDs**
   - Some prices have `pending_*` provider IDs
   - **Impact:** Checkout will fail until synced
   - **Mitigation:** Admin must sync with Stripe first

---

## 11. Data Migration Required

### Onboarding Profile Cleanup
```sql
-- Find users who selected "scale" plan
SELECT user_id, selected_plan, created_at
FROM onboarding_profiles
WHERE selected_plan = 'scale';

-- Migrate to "advanced"
UPDATE onboarding_profiles
SET selected_plan = 'advanced'
WHERE selected_plan = 'scale';
```

### Validation Schema Update
```typescript
// lib/validation/onboarding.ts

// BEFORE
export const PLAN_OPTIONS = ["basic", "pro", "scale"] as const;

// AFTER (remove constant, validate against DB)
export const planSlugSchema = z.string().min(1, "Plan slug required");
```

---

## 12. Testing Checklist

### Before Refactoring
- [ ] Document current prices in wizard vs. checkout
- [ ] List all components rendering pricing
- [ ] Verify Stripe product/price IDs exist
- [ ] Export current onboarding_profiles data

### After Phase 1 (Onboarding)
- [ ] Wizard shows correct DB prices
- [ ] Currency toggle works in wizard
- [ ] All 3 plans render from API
- [ ] Loading states work
- [ ] Error handling works (API down)
- [ ] Selected plan persists in form state

### After Phase 2 (Landing Page)
- [ ] Landing page uses `getPlans()`
- [ ] No direct Supabase queries in `app/page.tsx`

### After Phase 3 (3-Plan Fix)
- [ ] Add 4th plan to DB (e.g., "free" tier)
- [ ] Verify UI doesn't break
- [ ] Verify highlight badge works
- [ ] Test with 2 plans

### After Phase 4 (Features)
- [ ] Features render from `plan.features` array
- [ ] No hardcoded `PLAN_FEATURES` objects
- [ ] i18n keys removed or migrated

### Final Integration Test
- [ ] Complete onboarding with each plan
- [ ] Verify checkout session created
- [ ] Confirm Stripe subscription matches selected plan
- [ ] Check tenant_subscriptions row
- [ ] Verify pricing page reflects DB changes
- [ ] Test currency switching
- [ ] Test annual/monthly toggle

---

## 13. Recommended Implementation Order

1. **Phase 1** - Onboarding Wizard (1-2 days)
   - Highest risk, user-facing
   - Fixes price mismatch
   - Enables multi-currency in wizard

2. **Phase 3** - Remove 3-Plan Assumptions (0.5 days)
   - Low effort, high flexibility gain
   - Required before adding more plans

3. **Phase 2** - Landing Page Standardization (0.5 days)
   - Low risk, improves consistency

4. **Phase 4** - Feature Consolidation (1 day)
   - Medium effort
   - Reduces maintenance burden

5. **Phase 6** - Feature Gating Update (1 day)
   - Lower priority
   - Can be done after core pricing is unified

6. **Phase 5** - Consider API migration (optional)
   - Only if adding middleware/caching
   - Not critical for consistency

**Total Estimated Time:** 3-5 days

---

## 14. Success Metrics

### Code Quality
- [ ] Zero hardcoded prices in UI components
- [ ] Zero `plans.length === 3` checks
- [ ] Single source of truth: `GET /api/v1/billing/plans`
- [ ] All features from `plan.features` in DB

### Flexibility
- [ ] Can add/remove plans via admin UI (no code deploy)
- [ ] Can change prices via admin UI
- [ ] Can add new currencies without code changes
- [ ] Can schedule price changes via `effective_from`/`effective_to`

### User Experience
- [ ] Wizard prices match checkout prices
- [ ] Multi-currency support in all UIs
- [ ] "Most Popular" badge configurable
- [ ] Clear messaging when price unavailable

---

## 15. Open Questions

1. **Does `app/dashboard/profile/page.tsx` show pricing?**  
   Need to inspect to see if it renders current plan/prices.

2. **Are there other wizard steps with hardcoded plan data?**  
   Full audit of `components/onboarding/` needed.

3. **Should we support tenant-specific pricing?**  
   Schema supports it (`scope`, `tenant_id`), but no UI yet.

4. **What happens to existing onboarding profiles with `selected_plan: "scale"`?**  
   Data migration required before Phase 1.

5. **Should annual savings badge pull from DB calculation?**  
   Currently calculated client-side. Could store in DB for consistency.

---

## 16. Conclusion

The ZARZOOM pricing system has a **solid foundation** with:
- ✅ Multi-currency, versioned database schema
- ✅ Public API endpoint already exists
- ✅ Well-structured formatting utilities
- ✅ Stripe integration working

**Critical issues to address:**
- 🚨 Onboarding wizard has wrong hardcoded prices
- ⚠️ "scale" vs "advanced" slug mismatch
- ⚠️ Hardcoded 3-plan assumptions in multiple places

**Recommended next step:**  
Implement **Phase 1 (Onboarding)** immediately to fix price mismatch, then **Phase 3** to future-proof against plan additions. Other phases can follow incrementally.

---

**End of Audit Report**
