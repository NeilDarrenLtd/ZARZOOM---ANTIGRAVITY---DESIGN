# NO PRICING IN I18N

## Policy

**Numeric pricing is BANNED from all i18n translation files.**

All pricing must come from the database via the canonical API: `GET /api/v1/billing/plans`

## Why?

1. **Single Source of Truth**: Pricing lives in the database, not in code or translation files
2. **Easy Updates**: Change prices in admin UI, no code deployment needed
3. **Multi-Currency Support**: Database handles all currencies dynamically
4. **A/B Testing**: Can test different pricing without touching translations
5. **Regional Pricing**: Different prices for different regions without i18n chaos
6. **Audit Trail**: Database tracks pricing changes, translations don't

## What NOT to Do

❌ **NEVER** put prices in translation files:

```json
{
  "pricing": {
    "basic": "$29/month",
    "pro": "£79 per month",
    "enterprise": "Contact us for pricing starting at $199"
  }
}
```

❌ **NEVER** use translation keys with hardcoded amounts:

```json
{
  "plans": {
    "basic": {
      "price": "29.99",
      "displayPrice": "$29.99/mo"
    }
  }
}
```

## What to Do Instead

✅ **Fetch pricing from the API:**

```typescript
// In your component
const [plans, setPlans] = useState([]);

useEffect(() => {
  fetch('/api/v1/billing/plans')
    .then(res => res.json())
    .then(data => setPlans(data.plans));
}, []);

// Render prices dynamically
{plans.map(plan => (
  <div key={plan.planKey}>
    <h3>{t(`plans.${plan.planKey}.displayName`)}</h3>
    <p>{formatPrice(plan.prices[0].amountMinor, plan.prices[0].currency)}</p>
  </div>
))}
```

✅ **Store only labels and descriptions in i18n:**

```json
{
  "plans": {
    "basic": {
      "displayName": "Basic",
      "shortTagline": "Perfect for getting started",
      "description": "Essential features for individuals",
      "bullets": [
        "Up to 3 social profiles",
        "30 posts per month",
        "Basic AI generation"
      ]
    }
  }
}
```

## Validation

### Development Mode

Automatic validation runs when you load translations in dev mode:

```bash
npm run dev
# Console will warn if pricing detected in i18n
```

### Manual Validation

Run the validator script:

```bash
npm run validate:i18n
```

This script:
- Scans all locale files for numeric pricing
- Reports any violations with file, key, and value
- Exits with error code 1 if issues found (for CI/CD)

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Validate i18n files
  run: npm run validate:i18n
```

## Validation Patterns

The validator detects:

- Currency symbols with numbers: `$29`, `£79`, `€99`
- Price strings: `29/month`, `79 per year`
- Decimal prices: `29.99`, `79.95`
- Price keywords with numbers: `price: 29`, `cost 79`

## Migration Guide

If you have existing pricing in i18n:

### Step 1: Identify All Pricing

Run the validator to find all violations:

```bash
npm run validate:i18n
```

### Step 2: Remove Pricing from i18n

Delete all numeric pricing from locale files:

```diff
  "plans": {
    "basic": {
      "displayName": "Basic",
-     "price": "$29/month",
-     "annualPrice": "$290/year"
    }
  }
```

### Step 3: Update Components

Replace hardcoded pricing with API calls:

```diff
- const price = t('plans.basic.price');
+ const [plans, setPlans] = useState([]);
+ useEffect(() => {
+   fetch('/api/v1/billing/plans')
+     .then(res => res.json())
+     .then(data => setPlans(data.plans));
+ }, []);
+ const basicPlan = plans.find(p => p.planKey === 'basic');
+ const price = formatPrice(basicPlan?.prices[0].amountMinor, 'USD');
```

### Step 4: Use Helper Utilities

Use the provided helpers:

```typescript
import { getDisplayablePlans } from '@/lib/billing/displayable-plans';
import { formatPrice } from '@/lib/billing/format';

const plans = await getDisplayablePlans(t);
plans.forEach(plan => {
  console.log(plan.copy.displayName); // From i18n
  console.log(formatPrice(plan.prices[0].amountMinor, plan.prices[0].currency)); // From DB
});
```

### Step 5: Verify

Run validation again:

```bash
npm run validate:i18n
# Should pass with no issues
```

## File Structure

```
lib/i18n/
  ├── validate-no-pricing.ts    # Validation logic
  └── context.tsx                # Auto-validates in dev mode

scripts/
  └── validate-i18n.ts           # CLI validation script

locales/
  ├── en.json                    # NO PRICING HERE
  ├── es.json                    # NO PRICING HERE
  └── ...                        # NO PRICING HERE

Database Tables:
  ├── plans                      # Plan definitions
  └── plan_prices                # Pricing data (source of truth)
```

## API Reference

### GET /api/v1/billing/plans

Returns all active plans with prices in all currencies:

```json
{
  "plans": [
    {
      "planKey": "basic",
      "name": "Basic",
      "description": "...",
      "sortOrder": 1,
      "prices": [
        {
          "currency": "USD",
          "interval": "monthly",
          "amountMinor": 2900
        },
        {
          "currency": "GBP",
          "interval": "monthly",
          "amountMinor": 2300
        }
      ]
    }
  ]
}
```

### Helper Functions

```typescript
// Format minor units to display string
formatPrice(2900, 'USD') // "$29.00"
formatPrice(2300, 'GBP') // "£23.00"

// Get displayable plans (DB + i18n)
const plans = await getDisplayablePlans(t);
// Only returns plans with both DB record AND i18n copy

// Validate translations
devCheckPricing(translations, 'en');
// Warns in console if pricing found
```

## FAQ

### Why can't I just put prices in i18n?

Because i18n files are for **language**, not **business logic**. Pricing is business logic that changes frequently and needs to be managed separately.

### What about "Free" or "Contact us"?

Those are fine! They're not numeric prices:

```json
{
  "pricing": {
    "freeTier": "Free forever",
    "enterprise": "Contact us for custom pricing"
  }
}
```

### Can I mention pricing in copy?

Yes, but don't include actual numbers:

```json
{
  "marketing": {
    "tagline": "Affordable pricing for teams of any size",
    "cta": "See pricing"
  }
}
```

### What if I need to show a discount percentage?

Store the percentage in the database, not i18n:

```typescript
// Database: discount_percent = 15
const discount = plan.discountPercent; // From DB
const message = t('pricing.savePercent', { percent: discount });
// i18n: "Save {percent}% with annual billing"
```

## Enforcement

- ✅ Dev mode: Console warnings
- ✅ Script: `npm run validate:i18n`
- ✅ CI/CD: Fails build if pricing found
- ✅ Code review: Reject PRs with i18n pricing

## Support

Questions? Check:
- `docs/PRICING_IMPLEMENTATION_SUMMARY.md`
- `docs/API_PLANS_ENDPOINT.md`
- `docs/I18N_PLAN_COPY_GUIDE.md`
