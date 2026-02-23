# GET /api/v1/billing/plans

**Canonical Public Pricing API**

Returns all active subscription plans with their prices across all supported currencies and billing intervals.

## Endpoint

```
GET /api/v1/billing/plans
```

## Authentication

**No authentication required.** This is a public endpoint.

## Caching

- **Cache Duration**: 120 seconds (2 minutes)
- **Headers**: `Cache-Control: public, max-age=120, stale-while-revalidate=60`
- Safe to cache on the client side

## Response Format

### Success (200 OK)

```json
{
  "plans": [
    {
      "planKey": "basic",
      "name": "Basic",
      "description": "Essential features to launch your social media presence",
      "sortOrder": 1,
      "isActive": true,
      "entitlements": {
        "ai_content_generation": true,
        "post_scheduling": true,
        "analytics_dashboard": false,
        "api_access": false
      },
      "quotaPolicy": {
        "social_profiles": 3,
        "posts_per_month": 30,
        "team_members": 1
      },
      "features": [
        "Up to 3 social profiles",
        "30 posts per month",
        "Basic AI content generation",
        "Post scheduling",
        "Email support"
      ],
      "prices": [
        {
          "id": "uuid-here",
          "currency": "GBP",
          "interval": "month",
          "amountMinor": 999,
          "isActive": true,
          "billingProviderId": "price_stripe_id"
        },
        {
          "id": "uuid-here",
          "currency": "GBP",
          "interval": "year",
          "amountMinor": 9990,
          "isActive": true,
          "billingProviderId": "price_stripe_id"
        },
        {
          "id": "uuid-here",
          "currency": "USD",
          "interval": "month",
          "amountMinor": 1299,
          "isActive": true,
          "billingProviderId": "price_stripe_id"
        }
      ]
    },
    {
      "planKey": "pro",
      "name": "Pro",
      "description": "Advanced features for growing businesses",
      "sortOrder": 2,
      "isActive": true,
      "entitlements": {
        "ai_content_generation": true,
        "post_scheduling": true,
        "analytics_dashboard": true,
        "api_access": false
      },
      "quotaPolicy": {
        "social_profiles": 10,
        "posts_per_month": 150,
        "team_members": 3
      },
      "features": [
        "Up to 10 social profiles",
        "150 posts per month",
        "Advanced AI content generation",
        "Smart scheduling",
        "Analytics dashboard",
        "Priority support"
      ],
      "prices": [...]
    }
  ]
}
```

### Error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to fetch pricing plans",
    "requestId": "uuid-here"
  }
}
```

## Field Definitions

### Plan Object

| Field | Type | Description |
|-------|------|-------------|
| `planKey` | string | Unique lowercase identifier (e.g., "basic", "pro", "advanced") |
| `name` | string | Display name for the plan |
| `description` | string \| null | Marketing description |
| `sortOrder` | number | Display order (lower = shown first) |
| `isActive` | boolean | Whether plan is currently available |
| `entitlements` | object | Feature flags (boolean values) |
| `quotaPolicy` | object | Usage limits (numeric values) |
| `features` | string[] | UI-friendly feature list |
| `prices` | Price[] | All available prices |

### Price Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique price identifier (UUID) |
| `currency` | string | ISO 4217 currency code ("GBP", "USD", "EUR") |
| `interval` | string | Billing interval ("month" or "year") |
| `amountMinor` | number | Price in **minor currency units** (pence/cents) |
| `isActive` | boolean | Whether this price is currently available |
| `billingProviderId` | string \| null | External billing provider ID (e.g., Stripe price ID) |

## Important Notes

### Currency Handling

⚠️ **Prices are in MINOR units**:
- GBP: £9.99 = `999` (pence)
- USD: $12.99 = `1299` (cents)
- EUR: €9.99 = `999` (cents)

To display:
```typescript
const displayPrice = amountMinor / 100;  // 999 → 9.99
```

### Plan Keys

Plan keys are **lowercase slugs**:
- ✅ Correct: `"basic"`, `"pro"`, `"advanced"`
- ❌ Wrong: `"Basic"`, `"PRO"`, `"scale"`

### Entitlements vs Features

- **`entitlements`**: Boolean flags checked in code (`canAccessFeature()`)
- **`features`**: Human-readable strings shown in UI pricing tables

### Quota Policy

Numeric limits enforced by the system:
```json
{
  "social_profiles": 3,
  "posts_per_month": 30,
  "team_members": 1,
  "api_calls_per_day": 100
}
```

## Usage Examples

### Fetch Plans (JavaScript/TypeScript)

```typescript
const response = await fetch('/api/v1/billing/plans');
const data = await response.json();

console.log(`Found ${data.plans.length} plans`);

// Get basic plan
const basic = data.plans.find(p => p.planKey === 'basic');
console.log(basic.name); // "Basic"

// Get GBP monthly price
const monthlyPrice = basic.prices.find(
  p => p.currency === 'GBP' && p.interval === 'month'
);
console.log(`£${monthlyPrice.amountMinor / 100}/mo`); // "£9.99/mo"
```

### Using Type-Safe Helpers

```typescript
import type { GetPlansResponse, ApiPlan } from '@/lib/billing/api-types';
import { getMonthlyPrice, calculateAnnualSavings } from '@/lib/billing/api-types';

const response = await fetch('/api/v1/billing/plans');
const data: GetPlansResponse = await response.json();

const proPlan = data.plans.find(p => p.planKey === 'pro')!;

// Get monthly price in GBP
const price = getMonthlyPrice(proPlan, 'GBP');
if (price) {
  console.log(`£${price.amountMinor / 100}/mo`);
}

// Calculate annual savings
const savings = calculateAnnualSavings(proPlan, 'GBP');
if (savings) {
  console.log(`Save ${savings}% with annual billing`);
}
```

### React Hook

```typescript
import useSWR from 'swr';
import type { GetPlansResponse } from '@/lib/billing/api-types';

function usePlans() {
  return useSWR<GetPlansResponse>(
    '/api/v1/billing/plans',
    (url) => fetch(url).then(r => r.json()),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000, // 2 minutes
    }
  );
}

// Usage
function PricingTable() {
  const { data, error, isLoading } = usePlans();

  if (isLoading) return <Spinner />;
  if (error) return <Error />;

  return (
    <div>
      {data.plans.map(plan => (
        <PlanCard key={plan.planKey} plan={plan} />
      ))}
    </div>
  );
}
```

## Migration from Legacy API

If you're migrating from the old `/api/v1/billing/plans` that used `subscription_plans`:

### Old Structure → New Structure

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `slug` | `planKey` | Now lowercase only |
| `display_order` | `sortOrder` | Renamed for consistency |
| `highlight` | ❌ Removed | Use `sortOrder` to determine featured plan |
| `unit_amount` | `amountMinor` | **Same value**, different name |
| `plan_prices` | `prices` | Flattened structure |

### Code Changes

**Before:**
```typescript
const plans = await getPlans({ status: 'active' });
const basic = plans.find(p => p.slug === 'basic');
const price = basic.plan_prices.find(p => p.currency === 'GBP');
console.log(price.unit_amount); // 999
```

**After:**
```typescript
const response = await fetch('/api/v1/billing/plans');
const { plans } = await response.json();
const basic = plans.find(p => p.planKey === 'basic');
const price = basic.prices.find(p => p.currency === 'GBP');
console.log(price.amountMinor); // 999
```

## Testing

### Manual Test

```bash
curl https://your-domain.com/api/v1/billing/plans | jq
```

### Expected Output

You should see:
- 3 plans (basic, pro, advanced) by default
- Each plan has multiple prices (GBP/USD/EUR × month/year)
- All `amountMinor` values are integers
- All `planKey` values are lowercase
- Plans sorted by `sortOrder` (ascending)

### Validation Checklist

- [ ] All plans have unique `planKey` values
- [ ] All prices have valid currency codes ("GBP", "USD", "EUR")
- [ ] All prices have valid intervals ("month", "year")
- [ ] All `amountMinor` values are positive integers
- [ ] Plans are sorted by `sortOrder`
- [ ] Response is cached (check `Cache-Control` header)
- [ ] No authentication required (no 401 errors)

## Common Issues

### Empty Plans Array

**Problem**: `{"plans": []}`

**Causes**:
1. No active plans in database
2. Database migration not run
3. Plans table empty

**Solution**: Run seed script:
```bash
psql $DATABASE_URL -f scripts/005_refactor_pricing_schema.sql
```

### Missing Prices

**Problem**: Plans returned but `prices: []`

**Causes**:
1. No active prices in `plan_prices` table
2. `effective_from` date in future
3. `effective_to` date in past

**Solution**: Check price dates and `is_active` status.

### Wrong Price Values

**Problem**: Prices showing as 99900 instead of 999

**Cause**: Using old `unit_amount` field instead of `amountMinor`

**Solution**: Update to new schema and API structure.

## See Also

- [Plan Copy i18n Guide](./I18N_PLAN_COPY_GUIDE.md) - For marketing text
- [Pricing Schema Migration](./PRICING_SCHEMA_MIGRATION.md) - Database changes
- [API Types](../lib/billing/api-types.ts) - TypeScript definitions
