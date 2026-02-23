# Pricing System Migration - Complete

## What Was Built

A centralized, clean pricing system with zero duplication and consistent behavior across all pages.

### Core System (`lib/pricing/`)

1. **fetchPlans.ts** - Single source of truth for fetching pricing data
   - Client-side `fetchPlans()` for CSR/browser
   - Server-side `fetchPlansServer()` for RSC
   - Handles errors gracefully, returns empty array on failure
   - Typed with `GetPlansResponse`

2. **getDisplayablePlans.ts** - DB + i18n gating logic
   - Enforces that plans must exist in BOTH database AND i18n files
   - Enriches plans with translated copy (name, description, features)
   - Filters out plans with no active prices
   - Returns `DisplayablePlan[]` sorted by `sortOrder`
   - Development warnings for missing translations

3. **getPriceForSelection.ts** - Price selection logic
   - `getPriceForSelection(plan, currency, interval)` - Returns matching price or null
   - `hasPriceForSelection()` - Boolean check
   - `getAvailableCurrencies()` - Get all currencies for a plan
   - `getAvailableIntervals()` - Get all intervals for a plan/currency

4. **index.ts** - Clean exports for all pricing utilities

### Components (`components/pricing/`)

1. **PricingProvider.tsx** - Client-side state management
   - Fetches plans on mount
   - Manages currency/interval selection
   - Provides `usePricing()` hook for children
   - Handles loading states
   - Wraps all pricing UI

2. **CurrencyToggle.tsx** - Currency selector
   - GBP, USD, EUR options
   - Updates via `usePricing()`
   - Clean, accessible toggle UI

3. **IntervalToggle.tsx** - Billing interval selector
   - Monthly vs Annual
   - Shows "Save 20%" badge on annual
   - Updates via `usePricing()`

4. **PlanCard.tsx** - Individual plan display
   - Takes `DisplayablePlan`, `currency`, `interval`
   - Gets price via `getPriceForSelection()`
   - Returns `null` if no matching price
   - Clean card UI with features list
   - "Most Popular" badge support
   - `onChoosePlan` callback

5. **PricingGrid.tsx** - Grid layout for plans
   - Uses `usePricing()` for plans/currency/interval
   - Loading spinner
   - Empty state fallback
   - Dynamic grid columns (1-3 plans)
   - Marks middle plan as popular

### Updated Pages

1. **app/pricing/page.tsx** - Public pricing page
   - Uses `PricingProvider` wrapper
   - Clean, simple implementation
   - No direct API calls
   - No Supabase imports

2. **components/onboarding/Step4Plan.tsx** - Onboarding wizard
   - Uses `PricingProvider` wrapper
   - Maintains discount toggle logic (15% off)
   - Currency auto-detection from geolocation
   - Integrates with onboarding state
   - No direct API calls
   - No Supabase imports

## Legacy Files to Remove

These files are now obsolete and can be safely deleted:

1. ~~`lib/billing/displayable-plans.ts`~~ - Replaced by `lib/pricing/getDisplayablePlans.ts`
2. ~~`components/pricing/pricing-shell.tsx`~~ - Replaced by `PricingGrid.tsx`
3. ~~`components/pricing/plan-card.tsx`~~ (old version) - Replaced by `PlanCard.tsx`
4. ~~`components/pricing/currency-toggle.tsx`~~ (old version) - Replaced by `CurrencyToggle.tsx`
5. ~~`components/pricing/discount-toggle.tsx`~~ - KEEP (used by Step4Plan only)

## Key Improvements

### Before (Legacy System)
- ❌ Duplicated gating logic in multiple files
- ❌ Components fetching from Supabase directly
- ❌ Inconsistent error handling
- ❌ Price selection logic duplicated
- ❌ Currency/interval state duplicated
- ❌ No single source of truth

### After (New System)
- ✅ Single gating function (`getDisplayablePlans`)
- ✅ All data fetched via `/api/v1/billing/plans`
- ✅ Consistent error handling throughout
- ✅ Single price selection function (`getPriceForSelection`)
- ✅ Centralized state in `PricingProvider`
- ✅ Clear separation of concerns

## Usage Examples

### Simple Pricing Page
```tsx
import { PricingProvider } from "@/components/pricing/PricingProvider";
import { CurrencyToggle } from "@/components/pricing/CurrencyToggle";
import { IntervalToggle } from "@/components/pricing/IntervalToggle";
import { PricingGrid } from "@/components/pricing/PricingGrid";

export default function PricingPage() {
  return (
    <PricingProvider defaultCurrency="GBP" defaultInterval="monthly">
      <CurrencyToggle />
      <IntervalToggle />
      <PricingGrid onChoosePlan={(planKey, priceId) => {
        // Handle plan selection
      }} />
    </PricingProvider>
  );
}
```

### Custom Implementation
```tsx
import { fetchPlans, getDisplayablePlans, getPriceForSelection } from "@/lib/pricing";
import { useI18n } from "@/lib/i18n";

export default async function CustomPricing() {
  const { t } = useI18n();
  const response = await fetchPlans();
  const plans = getDisplayablePlans(response.plans, t);
  
  // Find specific plan and price
  const proPlan = plans.find(p => p.planKey === "pro");
  const gbpMonthly = proPlan ? getPriceForSelection(proPlan, "GBP", "monthly") : null;
  
  return <div>{/* Custom UI */}</div>;
}
```

## Requirements Met

✅ No component fetches directly from Supabase  
✅ All components use shared pricing logic  
✅ No duplicated gating logic anywhere  
✅ No numeric pricing in i18n files  
✅ No hardcoded plan count  
✅ Clean, maintainable architecture  
✅ Fully typed with TypeScript  
✅ Graceful error handling  
✅ Loading states  
✅ Empty state fallbacks  

## Database Requirements

The system expects the following data structure:

- **Table: `plans`** with columns: `id`, `plan_key`, `name`, `description`, `sort_order`, `is_active`, `entitlements`, `quota_policy`, `features`
- **Table: `plan_prices`** with columns: `id`, `plan_id`, `currency`, `interval`, `amount_minor`, `is_active`
- **View: `active_plan_prices`** joining plans + prices, filtering `is_active = true`

The API endpoint `/api/v1/billing/plans` normalizes `interval` values from DB format (`"month"/"year"`) to canonical format (`"monthly"/"annual"`).

## i18n Requirements

For each plan, translations must exist:

```json
{
  "plans": {
    "basic": {
      "name": "Basic",
      "description": "Perfect for getting started",
      "features": {
        "0": "Feature 1",
        "1": "Feature 2",
        "2": "Feature 3"
      }
    }
  }
}
```

Plans without i18n translations are automatically filtered out with dev console warnings.

## Testing Checklist

- [ ] `/pricing` page loads without errors
- [ ] Currency toggle works (GBP, USD, EUR)
- [ ] Interval toggle works (Monthly, Annual)
- [ ] All plans display correctly
- [ ] Features list populates from i18n
- [ ] Prices format correctly for each currency
- [ ] "Choose Plan" button works
- [ ] Empty state shows when DB is empty
- [ ] Loading spinner shows during fetch
- [ ] Step4Plan in onboarding works
- [ ] Discount toggle works in onboarding
- [ ] Currency auto-detection works
- [ ] No console errors
- [ ] No hydration warnings

## Migration Complete ✅

The pricing system has been successfully rebuilt with a clean, centralized architecture. All components now use the shared pricing utilities, eliminating duplication and ensuring consistent behavior across the application.
