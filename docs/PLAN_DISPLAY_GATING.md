# Plan Display Gating Implementation

## Overview

This document describes the strict two-gate system for displaying pricing plans throughout the application.

## Gating Rules

A plan is **displayable** if and only if:

1. ✅ **Database Gate**: Plan exists in the database via `GET /api/v1/billing/plans`
2. ✅ **i18n Gate**: Plan has complete translation copy via `hasPlanCopy(planKey, t)`

If either gate fails, the plan is **NOT displayed** to users.

## Architecture

### Core Utility

**File**: `/lib/billing/displayable-plans.ts`

```typescript
// Server-side (for Server Components)
const displayablePlans = await getDisplayablePlans(t);

// Client-side (for Client Components)
const displayablePlans = await getDisplayablePlansClient(t);
```

Both functions return `DisplayablePlan[]` which combines:
- Database fields (planKey, prices, entitlements, etc.)
- i18n copy (displayName, shortTagline, description, bullets, cta)

### Required i18n Structure

For each plan in `/locales/en.json`:

```json
{
  "plans": {
    "basic": {
      "displayName": "Basic",
      "shortTagline": "Perfect for getting started",
      "description": "Essential features...",
      "bullets": [
        "Feature 1",
        "Feature 2"
      ],
      "cta": "Start Free Trial" // optional
    }
  }
}
```

**Required keys**: `displayName`, `shortTagline`, `description`, `bullets`
**Optional keys**: `cta`

## Implementation Locations

### 1. Pricing Page (`/pricing`)

**File**: `/app/pricing/page.tsx`

```typescript
const displayablePlans = await getDisplayablePlans(t);

if (displayablePlans.length === 0) {
  // Show fallback UI
  return <PricingFallback />;
}

return <PricingShell plans={displayablePlans} />;
```

**Fallback Behavior**: Shows amber alert box with message from `pricing.fallback.{title,message}`

### 2. Onboarding Wizard Step 4

**File**: `/components/onboarding/Step4Plan.tsx`

```typescript
useEffect(() => {
  const plans = await getDisplayablePlansClient(t);
  setPlans(plans);
}, [t]);

if (plans.length === 0) {
  // Show fallback UI
  return <PlansFallback />;
}
```

**Fallback Behavior**: Shows amber alert box, prevents plan selection

### 3. Profile/Brand Settings

**File**: Uses pricing page data (already gated)

The plan selection in Brand Settings uses the same pricing infrastructure, so it inherits the gating automatically.

## Fallback UI

When no displayable plans exist, show:

```jsx
<div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
  <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
  <h3 className="text-lg font-semibold">
    {t("pricing.fallback.title")}
  </h3>
  <p className="text-sm text-gray-600">
    {t("pricing.fallback.message")}
  </p>
</div>
```

## Debug Logging

All gating operations log to console with `[v0]` prefix:

```
[v0] Fetching plans from: http://localhost:3000/api/v1/billing/plans
[v0] Fetched 3 plans from API
[v0] Checking 3 plans for i18n completeness
[v0] ✓ Plan displayable: basic
[v0] ✓ Plan displayable: pro
[v0] ✗ Plan NOT displayable: enterprise - missing i18n keys: ['bullets']
[v0] Final displayable plans: 2
```

## Adding a New Plan

To add a new plan that will display:

### Step 1: Add to Database

Execute SQL migration:

```sql
INSERT INTO public.plans (
  plan_key, name, description, sort_order, is_active
) VALUES (
  'enterprise', 'Enterprise', 'Custom solutions...', 4, true
);

-- Add prices
INSERT INTO public.plan_prices (
  plan_id, currency, interval, amount_minor, is_active
) VALUES
  ((SELECT id FROM plans WHERE plan_key = 'enterprise'), 'GBP', 'monthly', 29900, true),
  ((SELECT id FROM plans WHERE plan_key = 'enterprise'), 'GBP', 'annual', 299900, true);
```

### Step 2: Add i18n Copy

In `/locales/en.json`:

```json
{
  "plans": {
    "enterprise": {
      "displayName": "Enterprise",
      "shortTagline": "For large teams",
      "description": "Custom solutions for enterprise needs",
      "bullets": [
        "Unlimited everything",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantee"
      ],
      "cta": "Contact Sales"
    }
  }
}
```

### Step 3: Verify

Plan will automatically appear when both gates pass. Check console for:

```
[v0] ✓ Plan displayable: enterprise
```

## Testing Scenarios

### Scenario 1: Plan in DB but missing i18n

**Result**: Plan NOT displayed
**Log**: `✗ Plan NOT displayable: planKey - missing i18n keys: ['displayName', ...]`

### Scenario 2: Plan in i18n but not in DB

**Result**: Plan NOT displayed (never fetched from API)

### Scenario 3: Plan exists but i18n incomplete

**Result**: Plan NOT displayed
**Log**: `✗ Plan NOT displayable: planKey - missing i18n keys: ['bullets']`

### Scenario 4: Both gates pass

**Result**: Plan displayed
**Log**: `✓ Plan displayable: planKey`

### Scenario 5: No plans pass both gates

**Result**: Fallback UI shown
**User sees**: "Pricing Temporarily Unavailable" message

## Benefits

1. **Type Safety**: DisplayablePlan type ensures all required fields present
2. **i18n Enforcement**: Can't show plans without proper translations
3. **Gradual Rollout**: Add i18n for new locales without changing code
4. **Fail-Safe**: Missing data = graceful fallback, never broken UI
5. **Debugging**: Clear console logs show exactly why plans are/aren't shown

## API Contract

The system relies on:

**Endpoint**: `GET /api/v1/billing/plans`

**Response Shape**:
```json
{
  "plans": [
    {
      "planKey": "basic",
      "name": "Basic",
      "sortOrder": 1,
      "prices": [
        {
          "currency": "GBP",
          "interval": "monthly",
          "amountMinor": 2900
        }
      ]
    }
  ]
}
```

## Related Files

- `/lib/billing/displayable-plans.ts` - Core gating utility
- `/lib/i18n/plan-copy.ts` - i18n validation helpers
- `/lib/billing/api-types.ts` - TypeScript types
- `/app/api/v1/billing/plans/route.ts` - API endpoint
- `/app/pricing/page.tsx` - Pricing page (server-side)
- `/components/onboarding/Step4Plan.tsx` - Wizard (client-side)
- `/locales/en.json` - English translations

## Maintenance

When maintaining this system:

1. **Never bypass the gates** - Always use `getDisplayablePlans()` or `getDisplayablePlansClient()`
2. **Keep i18n in sync** - When adding DB plans, add i18n copy immediately
3. **Test both gates** - Verify plans appear/disappear correctly
4. **Monitor logs** - Watch for "NOT displayable" warnings in production
5. **Update fallback** - Keep fallback message helpful and actionable
