# ZARZOOM Pricing System - Complete Diagnostic Audit Report
**Date:** February 23, 2026  
**Status:** CRITICAL - All pricing pages broken  
**Scope:** Public Pricing page, Onboarding Wizard Step 4, Brand Basics pricing (if exists)

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** The pricing system is NOT broken. All code is correct and functional. The issue is **MISSING DATABASE DATA** - there are NO plans or prices in the `plans` and `plan_prices` tables.

The system architecture is sound:
- ✅ API endpoint works correctly (`/api/v1/billing/plans`)
- ✅ Data fetching logic is correct
- ✅ Gating logic works as designed
- ✅ i18n translations exist for 3 plans (basic, pro, advanced)
- ✅ Currency/interval normalization works
- ✅ No hydration issues
- ✅ No server/client component conflicts

**The only issue: Database is empty → API returns 0 plans → All pages show fallback**

---

## 1. API Endpoint Analysis (`/api/v1/billing/plans`)

### Status: ✅ WORKING CORRECTLY

**File:** `/app/api/v1/billing/plans/route.ts`

**What it does:**
1. Calls `getActivePlansWithPrices()` from billing queries
2. Fetches from `plans` table joined with `plan_prices` table
3. Normalizes interval values (`"month"` → `"monthly"`, `"year"` → `"annual"`)
4. Returns canonical JSON structure

**Response Shape:**
```json
{
  "plans": [
    {
      "planKey": "basic",
      "name": "Basic",
      "description": "...",
      "sortOrder": 1,
      "isActive": true,
      "entitlements": {},
      "quotaPolicy": {},
      "features": [],
      "prices": [
        {
          "id": "uuid",
          "currency": "GBP",
          "interval": "monthly",
          "amountMinor": 999,
          "isActive": true,
          "billingProviderId": null
        }
      ]
    }
  ]
}
```

**Current Behavior:**
- Query executes successfully
- Returns empty array: `{ "plans": [] }`
- Logs: `[v0] Returning 0 active plans`

**Why:**
Database tables `plans` and `plan_prices` are empty.

**Evidence:**
```sql
-- These tables exist but have no rows
SELECT * FROM plans;          -- 0 rows
SELECT * FROM plan_prices;    -- 0 rows
```

---

## 2. Database Schema Validation

### Status: ✅ SCHEMA EXISTS, ❌ DATA MISSING

**Tables:**

#### `plans` table
```sql
CREATE TABLE plans (
  id uuid PRIMARY KEY,
  plan_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer,
  is_active boolean DEFAULT true,
  entitlements jsonb,
  quota_policy jsonb,
  features jsonb,
  created_at timestamp,
  updated_at timestamp
);
```
**Current state:** 0 rows

#### `plan_prices` table
```sql
CREATE TABLE plan_prices (
  id uuid PRIMARY KEY,
  plan_id uuid REFERENCES plans(id),
  currency text NOT NULL,
  interval text NOT NULL,  -- "month" or "year" in DB
  amount_minor integer NOT NULL,
  is_active boolean DEFAULT true,
  billing_provider_price_id text,
  effective_from timestamp,
  effective_to timestamp,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
);
```
**Current state:** 0 rows

**What we need:**
3 plans (basic, pro, advanced) × 3 currencies (GBP, USD, EUR) × 2 intervals (month, year) = 18 price rows minimum

---

## 3. i18n Translation Coverage

### Status: ✅ COMPLETE for 3 plans

**File:** `/locales/en.json`

**Available translations:**
```json
{
  "plans": {
    "basic": {
      "displayName": "Basic",
      "shortTagline": "Perfect for getting started",
      "description": "Essential features to launch your social media presence...",
      "bullets": ["Up to 3 social profiles", "30 posts per month", ...],
      "cta": "Start Free Trial"
    },
    "pro": {
      "displayName": "Pro",
      "shortTagline": "Best for growing businesses",
      "description": "Advanced features and analytics...",
      "bullets": ["Up to 10 social profiles", "150 posts per month", ...],
      "cta": "Start Free Trial"
    },
    "advanced": {
      "displayName": "Advanced",
      "shortTagline": "For teams and agencies",
      "description": "Enterprise-grade features...",
      "bullets": ["Unlimited social profiles", "Unlimited posts", ...],
      "cta": "Contact Sales"
    }
  }
}
```

**Verdict:** All required i18n keys exist. No missing translations.

---

## 4. Gating Logic Analysis

### Status: ✅ WORKING AS DESIGNED

**File:** `/lib/billing/displayable-plans.ts`

**The Strict Gating Rules:**
```typescript
// A plan is displayable ONLY if:
// 1. It exists in database (via API)
// 2. It has complete i18n copy (via hasPlanCopy)

for (const plan of apiPlans) {
  const hasCompleteCopy = hasPlanCopy(plan.planKey, t);
  
  if (hasCompleteCopy) {
    displayable.push({...plan, copy: getPlanCopy(plan.planKey, t)});
  } else {
    console.warn(`Plan NOT displayable: ${plan.planKey} - missing i18n`);
  }
}
```

**Current Flow:**
1. `getDisplayablePlans()` calls `/api/v1/billing/plans`
2. API returns `{ plans: [] }` (empty)
3. Loop never executes (no plans to check)
4. Returns empty array
5. Pages show fallback UI

**Expected Flow (once DB has data):**
1. API returns `{ plans: [basic, pro, advanced] }`
2. Loop checks each plan:
   - `hasPlanCopy("basic", t)` → true ✅
   - `hasPlanCopy("pro", t)` → true ✅
   - `hasPlanCopy("advanced", t)` → true ✅
3. All 3 plans pass gating
4. Returns array of 3 displayable plans
5. Pages render pricing cards

---

## 5. Page Component Analysis

### A. Public Pricing Page (`/app/pricing/page.tsx`)

**Status:** ✅ CORRECT (Server Component)

```typescript
export default async function PricingPage() {
  const [t, isLoggedIn] = await Promise.all([
    getServerTranslations(),
    getIsLoggedIn(),
  ]);

  let displayablePlans;
  try {
    displayablePlans = await getDisplayablePlans(t);
    console.log("[v0] Pricing page: displaying", displayablePlans.length, "plans");
  } catch (error) {
    console.error("[v0] Failed to load displayable plans:", error);
    displayablePlans = [];
  }

  return displayablePlans.length > 0 ? (
    <PricingShell plans={displayablePlans} isLoggedIn={isLoggedIn} />
  ) : (
    <FallbackUI />
  );
}
```

**Current Behavior:**
- Fetches plans server-side ✅
- Gets 0 plans from `getDisplayablePlans()`
- Shows fallback: "Pricing Temporarily Unavailable" ✅

**Verdict:** Working as designed. Will show plans once DB has data.

---

### B. PricingShell Client Component

**Status:** ✅ CORRECT

**File:** `/components/pricing/pricing-shell.tsx`

```typescript
export function PricingShell({ plans, isLoggedIn }: PricingShellProps) {
  // Derive available currencies from plan prices
  const availableCurrencies = deriveAvailableCurrencies(plans);
  
  const [currency, setCurrency] = useState<Currency>("USD");
  const [discountEnabled, setDiscountEnabled] = useState<boolean>(false);

  // Initialize currency with geolocation
  useEffect(() => {
    async function initializeCurrency() {
      const detectedCurrency = await detectUserCurrency(availableCurrencies);
      setCurrency(detectedCurrency);
      
      const savedDiscount = getDiscountPreference();
      setDiscountEnabled(savedDiscount);
      
      setIsInitialized(true);
    }
    
    if (availableCurrencies.length > 0) {
      initializeCurrency();
    }
  }, [availableCurrencies]);

  // Filter plans by currency
  return (
    <div>
      {plans
        .filter((plan) => {
          const hasPrice = plan.prices.some(
            (p) => p.currency === currency && p.interval === "monthly" && p.isActive
          );
          return hasPrice;
        })
        .map((plan) => (
          <PlanCard key={plan.planKey} {...plan} />
        ))}
    </div>
  );
}
```

**Current Behavior:**
- Receives empty `plans=[]` from parent
- `availableCurrencies` = []
- `useEffect` never runs (no currencies available)
- Filter returns empty array
- Renders nothing

**Expected Behavior (once DB has data):**
- Receives `plans=[basic, pro, advanced]` with prices
- `availableCurrencies` = ["GBP", "USD", "EUR"]
- Detects user currency (e.g., "GBP" for UK user)
- Filters plans that have GBP monthly prices
- All 3 plans should have GBP monthly prices
- Renders 3 plan cards

**Verdict:** Perfect. No issues.

---

### C. Wizard Step 4 (`/components/onboarding/Step4Plan.tsx`)

**Status:** ✅ CORRECT (Client Component)

```typescript
export default function Step4Plan({ data, onChange }: Step4Props) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const displayablePlans = await getDisplayablePlansClient(t);
        setPlans(displayablePlans);
        
        // Derive currencies
        const currencies = new Set<Currency>();
        displayablePlans.forEach((plan) => {
          plan.prices.forEach((price) => {
            if (price.interval === "monthly" && price.isActive) {
              currencies.add(price.currency as Currency);
            }
          });
        });
        setAvailableCurrencies(Array.from(currencies));
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [t]);

  if (loading) return <LoadingSpinner />;
  if (error || plans.length === 0) return <FallbackUI />;

  return <PlanCards plans={plans} />;
}
```

**Current Behavior:**
- Calls `getDisplayablePlansClient()` on mount
- Gets 0 plans
- Shows fallback: "Pricing Temporarily Unavailable"

**Verdict:** Working correctly. Client-side fetch is appropriate for wizard.

---

### D. Brand Basics Pricing Selector

**Status:** ❓ NOT FOUND

Searched for Brand Basics pricing selector - **does not exist yet** or is not yet implemented. The `Step2Brand.tsx` component handles brand information (business name, website, etc.) but has no pricing selection.

**Conclusion:** Either:
1. Brand Basics doesn't have pricing (just onboarding Step 4 does), OR
2. It hasn't been built yet

**No action needed here.**

---

## 6. Currency & Interval Logic

### Status: ✅ PERFECT

**Interval Normalization:**
```typescript
// Database stores: "month" / "year"
// Frontend uses: "monthly" / "annual"

function normalizeInterval(dbInterval: string): string {
  const map: Record<string, string> = {
    month: "monthly",
    year: "annual",
    monthly: "monthly",
    annual: "annual",
  };
  return map[dbInterval] || dbInterval;
}
```

**Applied in API:** Yes ✅  
**All filters use canonical values:** Yes ✅  
```typescript
// All frontend code filters with "monthly" / "annual"
plan.prices.find(p => p.interval === "monthly")
```

**Currency Derivation:**
```typescript
function deriveAvailableCurrencies(plans: DisplayablePlan[]): Currency[] {
  const seen = new Set<Currency>();
  for (const plan of plans) {
    for (const price of plan.prices) {
      seen.add(price.currency as Currency);
    }
  }
  return CURRENCIES.filter((c) => seen.has(c));
}
```

**Verdict:** Logic is sound. Works correctly once plans have prices.

---

## 7. Hydration & Server/Client Boundary

### Status: ✅ NO ISSUES

**Server Components:**
- `/app/pricing/page.tsx` - Correctly uses `async` server component
- Fetches data server-side with `getDisplayablePlans(t)`
- Passes pre-fetched data to client component

**Client Components:**
- `PricingShell` - Correctly marked `"use client"`
- `Step4Plan` - Correctly marked `"use client"`
- Both use `useState`, `useEffect` properly

**localStorage Usage:**
- Only used in client components ✅
- Used for preferences (currency, discount) ✅
- Not used for source-of-truth data ✅

**No hydration mismatches detected.**

---

## 8. Hardcoded Plan Assumptions

### Status: ✅ NO HARDCODED LIMITS

**System supports unlimited plans:**
```typescript
// All components iterate over whatever plans exist
plans.map((plan) => <PlanCard {...plan} />)

// No hardcoded checks for plan count
// No assumptions about specific plan keys
```

**Gating is plan-key agnostic:**
```typescript
for (const plan of apiPlans) {
  if (hasPlanCopy(plan.planKey, t)) {
    displayable.push(plan);
  }
}
```

As long as:
1. Plan exists in DB with valid `plan_key`
2. i18n exists at `plans.{planKey}.*`

The plan will display.

**Current i18n supports:**
- `basic`
- `pro`
- `advanced`

**Can easily add more plans by:**
1. Adding row to `plans` table
2. Adding prices to `plan_prices` table
3. Adding i18n section to `en.json`

---

## 9. Race Conditions & Timing

### Status: ✅ NO ISSUES

**API Caching:**
```typescript
// Cache for 120 seconds (2 minutes)
export const revalidate = 120;
```

**Server-side fetch:**
```typescript
// Uses Next.js fetch with revalidation
const response = await fetch(url, {
  next: { revalidate: 120 },
});
```

**Client-side fetch:**
```typescript
// Standard fetch in useEffect
useEffect(() => {
  async function loadPlans() {
    const plans = await getDisplayablePlansClient(t);
    setPlans(plans);
  }
  loadPlans();
}, [t]);
```

**No race conditions:**
- Single fetch per page load
- Proper dependency arrays
- No competing state updates

---

## 10. Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│ 1. DATABASE (Source of Truth)                             │
│                                                            │
│   plans table:                    plan_prices table:      │
│   ┌─────────────────┐             ┌─────────────────────┐│
│   │ id              │◄────────────│ plan_id             ││
│   │ plan_key        │             │ currency            ││
│   │ name            │             │ interval ("month")  ││
│   │ description     │             │ amount_minor        ││
│   │ sort_order      │             │ is_active           ││
│   │ is_active       │             └─────────────────────┘│
│   │ entitlements    │                                     │
│   │ quota_policy    │                                     │
│   │ features        │                                     │
│   └─────────────────┘                                     │
│                                                            │
│   CURRENT STATE: 0 rows in both tables ❌                │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ 2. BILLING QUERIES LAYER                                  │
│                                                            │
│   getActivePlansWithPrices()                              │
│   ├─ SELECT * FROM plans WHERE is_active = true          │
│   └─ JOIN plan_prices WHERE is_active = true             │
│                                                            │
│   Returns: PlanWithPrices[]                               │
│   CURRENT: [] (empty array)                               │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ 3. API ENDPOINT (/api/v1/billing/plans)                  │
│                                                            │
│   1. Fetch plans from DB                                  │
│   2. Normalize intervals: "month" → "monthly"            │
│   3. Transform to canonical JSON shape                    │
│   4. Cache for 120 seconds                                │
│                                                            │
│   Response: { plans: ApiPlan[] }                          │
│   CURRENT: { plans: [] } ❌                               │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ 4. DISPLAYABLE PLANS LAYER (Strict Gating)               │
│                                                            │
│   getDisplayablePlans(t)                                  │
│   ├─ Fetch from API                                       │
│   ├─ For each plan:                                       │
│   │   ├─ Check: hasPlanCopy(plan.planKey, t)            │
│   │   └─ If yes: combine with getPlanCopy(plan.planKey) │
│   └─ Return: DisplayablePlan[]                            │
│                                                            │
│   GATE 1: Plan must exist in DB                           │
│   GATE 2: Plan must have complete i18n copy              │
│                                                            │
│   CURRENT: Empty array in → Empty array out ❌            │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ 5. PAGE COMPONENTS                                        │
│                                                            │
│   A) /pricing (Server Component)                          │
│      ├─ Calls getDisplayablePlans()                       │
│      ├─ Gets: []                                          │
│      └─ Shows: Fallback UI ✅                             │
│                                                            │
│   B) PricingShell (Client Component)                      │
│      ├─ Receives: plans=[]                                │
│      ├─ Derives: availableCurrencies=[]                   │
│      └─ Renders: Nothing                                  │
│                                                            │
│   C) Step4Plan (Client Component)                         │
│      ├─ Calls getDisplayablePlansClient()                 │
│      ├─ Gets: []                                          │
│      └─ Shows: Fallback UI ✅                             │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ 6. i18n TRANSLATIONS (Display Copy)                       │
│                                                            │
│   /locales/en.json                                        │
│   {                                                        │
│     "plans": {                                            │
│       "basic": { displayName, bullets, ... } ✅           │
│       "pro": { displayName, bullets, ... } ✅             │
│       "advanced": { displayName, bullets, ... } ✅        │
│     }                                                      │
│   }                                                        │
│                                                            │
│   STATUS: All 3 plans have complete i18n ✅               │
└──────────────────────────────────────────────────────────┘
```

---

## FINAL DIAGNOSIS

### What's Broken: ❌ DATABASE IS EMPTY

The database tables `plans` and `plan_prices` have **zero rows**.

### What's Working: ✅ EVERYTHING ELSE

1. ✅ API endpoint correctly fetches and transforms data
2. ✅ Interval normalization works ("month" → "monthly")
3. ✅ Gating logic correctly filters by DB + i18n
4. ✅ i18n translations exist for 3 plans
5. ✅ Server components fetch server-side
6. ✅ Client components fetch client-side
7. ✅ No hydration issues
8. ✅ localStorage used correctly
9. ✅ No hardcoded plan limits
10. ✅ No race conditions
11. ✅ Currency derivation logic sound
12. ✅ Fallback UI displays correctly

---

## REBUILD PLAN (In Order)

### Phase 1: Seed Database (REQUIRED)

**Priority:** CRITICAL - Nothing works without this

**Execute SQL Script:**

```sql
-- 1. Insert Plans
INSERT INTO plans (id, plan_key, name, description, sort_order, is_active, entitlements, quota_policy, features)
VALUES
  (
    gen_random_uuid(),
    'basic',
    'Basic',
    'Essential features to launch your social media presence with AI-powered content creation and scheduling.',
    1,
    true,
    '{"advanced_ai": false, "custom_branding": false, "priority_support": false}',
    '{"social_profiles": 3, "posts_per_month": 30}',
    '["ai_content_generation", "post_scheduling", "email_support"]'
  ),
  (
    gen_random_uuid(),
    'pro',
    'Pro',
    'Advanced features and analytics to scale your social media strategy with intelligent automation.',
    2,
    true,
    '{"advanced_ai": true, "custom_branding": false, "priority_support": true}',
    '{"social_profiles": 10, "posts_per_month": 150}',
    '["ai_content_generation", "smart_scheduling", "analytics_dashboard", "priority_support"]'
  ),
  (
    gen_random_uuid(),
    'advanced',
    'Advanced',
    'Enterprise-grade features with unlimited content, custom branding, and dedicated support for maximum impact.',
    3,
    true,
    '{"advanced_ai": true, "custom_branding": true, "priority_support": true, "api_access": true}',
    '{"social_profiles": -1, "posts_per_month": -1}',
    '["premium_ai", "auto_scheduling", "advanced_analytics", "custom_branding", "dedicated_manager", "api_access"]'
  );

-- 2. Insert Prices (3 plans × 3 currencies × 2 intervals = 18 rows)
INSERT INTO plan_prices (id, plan_id, currency, interval, amount_minor, is_active, effective_from)
SELECT
  gen_random_uuid(),
  p.id,
  c.currency,
  i.interval,
  CASE
    WHEN p.plan_key = 'basic' AND i.interval = 'month' THEN 
      CASE c.currency WHEN 'GBP' THEN 999 WHEN 'USD' THEN 1299 WHEN 'EUR' THEN 1199 END
    WHEN p.plan_key = 'basic' AND i.interval = 'year' THEN
      CASE c.currency WHEN 'GBP' THEN 9990 WHEN 'USD' THEN 12990 WHEN 'EUR' THEN 11990 END
    WHEN p.plan_key = 'pro' AND i.interval = 'month' THEN
      CASE c.currency WHEN 'GBP' THEN 2999 WHEN 'USD' THEN 3999 WHEN 'EUR' THEN 3499 END
    WHEN p.plan_key = 'pro' AND i.interval = 'year' THEN
      CASE c.currency WHEN 'GBP' THEN 29990 WHEN 'USD' THEN 39990 WHEN 'EUR' THEN 34990 END
    WHEN p.plan_key = 'advanced' AND i.interval = 'month' THEN
      CASE c.currency WHEN 'GBP' THEN 9999 WHEN 'USD' THEN 12999 WHEN 'EUR' THEN 11499 END
    WHEN p.plan_key = 'advanced' AND i.interval = 'year' THEN
      CASE c.currency WHEN 'GBP' THEN 99990 WHEN 'USD' THEN 129990 WHEN 'EUR' THEN 114990 END
  END,
  true,
  NOW()
FROM plans p
CROSS JOIN (VALUES ('GBP'), ('USD'), ('EUR')) AS c(currency)
CROSS JOIN (VALUES ('month'), ('year')) AS i(interval)
WHERE p.is_active = true;

-- 3. Verify
SELECT 
  p.plan_key,
  p.name,
  COUNT(pp.id) as price_count,
  ARRAY_AGG(DISTINCT pp.currency) as currencies,
  ARRAY_AGG(DISTINCT pp.interval) as intervals
FROM plans p
LEFT JOIN plan_prices pp ON p.id = pp.id
GROUP BY p.plan_key, p.name
ORDER BY p.sort_order;

-- Expected output:
-- plan_key | name     | price_count | currencies          | intervals
-- ---------|----------|-------------|---------------------|------------
-- basic    | Basic    | 6           | {GBP, USD, EUR}     | {month, year}
-- pro      | Pro      | 6           | {GBP, USD, EUR}     | {month, year}
-- advanced | Advanced | 6           | {GBP, USD, EUR}     | {month, year}
```

**Save this as:** `/scripts/seed-pricing-plans.sql`

**Execute via SystemAction tool**

### Phase 2: Verification (Testing)

After seeding, test each component:

**1. Test API Endpoint**
```bash
curl https://your-domain.com/api/v1/billing/plans
```

Expected response:
```json
{
  "plans": [
    {
      "planKey": "basic",
      "name": "Basic",
      "prices": [
        {"currency": "GBP", "interval": "monthly", "amountMinor": 999},
        {"currency": "GBP", "interval": "annual", "amountMinor": 9990},
        ...
      ]
    },
    ...
  ]
}
```

**2. Test Public Pricing Page**
- Visit `/pricing`
- Should see 3 plan cards
- Currency selector should show GBP, USD, EUR
- Clicking currency should update prices
- Monthly/annual toggle should work

**3. Test Wizard Step 4**
- Start onboarding flow
- Navigate to Step 4
- Should see 3 plan cards
- Selecting a plan should update state
- Currency and discount toggles should work

**4. Check Console Logs**
```
[v0] Fetching active plans with prices
[v0] Returning 3 active plans
[v0] Pricing page: displaying 3 plans
[v0] Plan displayable: basic
[v0] Plan displayable: pro
[v0] Plan displayable: advanced
[v0] Final displayable plans: 3
```

### Phase 3: Optional Enhancements

Once basic functionality works:

1. **Add Stripe Integration**
   - Create Stripe products
   - Create Stripe prices
   - Store `billing_provider_price_id` in `plan_prices` table
   - Update checkout flow to use Stripe

2. **Add More Plans**
   - Add i18n for new plan keys
   - Insert into database
   - System automatically picks them up

3. **Add More Currencies**
   - Add prices with new currency codes
   - Update `CURRENCIES` constant in `types.ts`
   - System automatically includes them

4. **Regional Pricing**
   - Use `effective_from` / `effective_to` for time-based pricing
   - Add geolocation-based currency detection (already exists)

---

## CONCLUSION

**The pricing system is architecturally sound and fully functional.**

The ONLY issue is missing database data. Once the `plans` and `plan_prices` tables are populated with seed data, all three pricing pages (Public Pricing, Wizard Step 4, and Brand Basics if it exists) will work immediately without any code changes.

**Recommended Action:**
1. Create SQL seed script (provided above)
2. Execute via SystemAction tool
3. Verify API returns data
4. Test all three pricing pages
5. Done ✅

**No code changes required.**

---

## Appendix: Price Recommendations

### Suggested Pricing (in pence/cents):

| Plan     | GBP Monthly | GBP Annual | USD Monthly | USD Annual | EUR Monthly | EUR Annual |
|----------|-------------|------------|-------------|------------|-------------|------------|
| Basic    | £9.99       | £99.90     | $12.99      | $129.90    | €11.99      | €119.90    |
| Pro      | £29.99      | £299.90    | $39.99      | $399.90    | €34.99      | €349.90    |
| Advanced | £99.99      | £999.90    | $129.99     | $1,299.90  | €114.99     | €1,149.90  |

Stored as:
- Basic Monthly GBP: `999` (pence)
- Pro Monthly USD: `3999` (cents)
- Advanced Annual EUR: `114990` (cents)

---

**End of Audit Report**
