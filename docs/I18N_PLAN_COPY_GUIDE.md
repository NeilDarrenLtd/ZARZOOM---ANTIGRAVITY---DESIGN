# Plan Copy i18n Guide

## Overview

This guide explains how to use the standardized i18n structure for plan marketing copy in ZARZOOM.

**Key principle**: Plan copy (display text) is **separate** from pricing data (numbers). i18n contains marketing text only; pricing comes from the database.

## Structure

### Required Keys

Every plan must have these keys to be considered "complete":

```json
{
  "plans": {
    "{planKey}": {
      "displayName": "Plan Name",
      "shortTagline": "Brief tagline",
      "description": "Longer description of the plan's value",
      "bullets": [
        "Feature 1",
        "Feature 2",
        "Feature 3"
      ],
      "cta": "Button text (optional)"
    }
  }
}
```

### Rules

1. **No numeric pricing** in i18n files
2. **Plan is visible** only if all required keys exist
3. **CTA is optional** - can differ by plan (e.g., "Contact Sales" for enterprise)
4. **Bullets are arrays** - can have any number of items
5. **Use `plan_key`** from database as the i18n key

## Usage Examples

### 1. Basic Usage - Check if Plan Has Copy

```tsx
import { useI18n } from '@/lib/i18n';
import { hasPlanCopy } from '@/lib/i18n/plan-copy.index';

export function PlanCard({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  
  // Don't show plans without i18n copy
  if (!hasPlanCopy(plan.plan_key, t)) {
    console.warn(`Missing i18n copy for plan: ${plan.plan_key}`);
    return null;
  }
  
  return <div>Plan exists!</div>;
}
```

### 2. Get Complete Plan Copy

```tsx
import { useI18n } from '@/lib/i18n';
import { getPlanCopy } from '@/lib/i18n/plan-copy.index';

export function PlanCard({ plan, price }: { plan: Plan; price: PlanPrice }) {
  const { t } = useI18n();
  const copy = getPlanCopy(plan.plan_key, t);
  
  return (
    <div className="plan-card">
      <h3>{copy.displayName}</h3>
      <p className="tagline">{copy.shortTagline}</p>
      <p className="description">{copy.description}</p>
      
      {/* Price comes from database, not i18n */}
      <div className="price">
        {formatPrice(price.amount_minor, price.currency)}
      </div>
      
      <ul>
        {copy.bullets.map((bullet, i) => (
          <li key={i}>{bullet}</li>
        ))}
      </ul>
      
      {copy.cta && (
        <button>{copy.cta}</button>
      )}
    </div>
  );
}
```

### 3. Filter Plans by Available Copy

```tsx
import { useI18n } from '@/lib/i18n';
import { getAvailablePlanKeys } from '@/lib/i18n/plan-copy.index';

export function PricingPage({ plans }: { plans: Plan[] }) {
  const { t } = useI18n();
  
  // Get all plan keys that have complete i18n copy
  const allKeys = plans.map(p => p.plan_key);
  const availableKeys = getAvailablePlanKeys(allKeys, t);
  
  // Filter to only show plans with translations
  const visiblePlans = plans.filter(p => 
    availableKeys.includes(p.plan_key)
  );
  
  return (
    <div>
      {visiblePlans.map(plan => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
```

### 4. Get Individual Copy Values

```tsx
import { useI18n } from '@/lib/i18n';
import { getPlanCopyValue } from '@/lib/i18n/plan-copy.index';

export function PlanBadge({ planKey }: { planKey: string }) {
  const { t } = useI18n();
  
  const name = getPlanCopyValue(planKey, 'displayName', t, planKey);
  const tagline = getPlanCopyValue(planKey, 'shortTagline', t);
  
  return (
    <div>
      <span className="name">{name}</span>
      {tagline && <span className="tagline">{tagline}</span>}
    </div>
  );
}
```

## Adding a New Plan

### Step 1: Add to Database

Create the plan with a unique `plan_key`:

```sql
INSERT INTO plans (plan_key, name, ...) 
VALUES ('enterprise', 'Enterprise', ...);
```

### Step 2: Add i18n Copy

Update `locales/en.json`:

```json
{
  "plans": {
    "basic": { ... },
    "pro": { ... },
    "advanced": { ... },
    "enterprise": {
      "displayName": "Enterprise",
      "shortTagline": "For large organizations",
      "description": "Custom solutions with dedicated support and unlimited everything.",
      "bullets": [
        "Unlimited everything",
        "Custom integrations",
        "Dedicated account team",
        "SLA guarantees",
        "Custom contracts"
      ],
      "cta": "Contact Sales"
    }
  }
}
```

### Step 3: Done!

Your code will automatically:
- ✅ Show the new plan in the UI (if `hasPlanCopy` is used)
- ✅ Display the correct marketing copy
- ✅ Handle it like any other plan

No code changes needed in components that use the helper functions!

## Adding Translations

### Step 1: Copy Structure to New Locale

Create `locales/es.json` with the same structure:

```json
{
  "plans": {
    "basic": {
      "displayName": "Básico",
      "shortTagline": "Perfecto para empezar",
      "description": "Características esenciales...",
      "bullets": [
        "Hasta 3 perfiles sociales",
        "30 publicaciones por mes",
        "Generación de contenido IA básica",
        "Programación de publicaciones",
        "Soporte por correo electrónico"
      ],
      "cta": "Comenzar Prueba Gratuita"
    }
  }
}
```

### Step 2: That's It!

The helpers automatically work with all locales. When a user switches language, they'll see translated copy.

## Error Handling

### Graceful Degradation

```tsx
import { hasPlanCopy, getPlanCopy } from '@/lib/i18n/plan-copy.index';

export function PlanCard({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  
  // Check before using
  if (!hasPlanCopy(plan.plan_key, t)) {
    // Fallback: show minimal info
    return (
      <div>
        <h3>{plan.name}</h3>
        <p>Details coming soon</p>
      </div>
    );
  }
  
  // Safe to get copy
  const copy = getPlanCopy(plan.plan_key, t);
  return <FullPlanCard copy={copy} plan={plan} />;
}
```

### Try-Catch Pattern

```tsx
export function PlanCard({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  
  try {
    const copy = getPlanCopy(plan.plan_key, t);
    return <FullPlanCard copy={copy} />;
  } catch (error) {
    console.error('Missing plan copy:', error);
    return <MinimalPlanCard plan={plan} />;
  }
}
```

## API Reference

### `hasPlanCopy(planKey, t): boolean`

Check if complete plan copy exists.

**Parameters:**
- `planKey` (string) - The plan identifier (e.g., 'basic')
- `t` (function) - Translation function from `useI18n()`

**Returns:** `true` if all required keys exist

**Example:**
```tsx
if (hasPlanCopy('pro', t)) {
  // Safe to display
}
```

---

### `getPlanCopy(planKey, t): PlanCopy`

Get complete plan copy object.

**Parameters:**
- `planKey` (string) - The plan identifier
- `t` (function) - Translation function

**Returns:** Object with `{ displayName, shortTagline, description, bullets, cta? }`

**Throws:** Error if required keys are missing

**Example:**
```tsx
const copy = getPlanCopy('basic', t);
console.log(copy.displayName); // "Basic"
console.log(copy.bullets); // ["Feature 1", "Feature 2"]
```

---

### `getAvailablePlanKeys(allKeys, t): string[]`

Filter to only plan keys with complete copy.

**Parameters:**
- `allKeys` (string[]) - All possible plan keys
- `t` (function) - Translation function

**Returns:** Array of plan keys that have complete copy

**Example:**
```tsx
const available = getAvailablePlanKeys(['basic', 'pro', 'enterprise'], t);
// Returns: ['basic', 'pro'] if 'enterprise' copy is missing
```

---

### `getPlanCopyValue(planKey, copyKey, t, fallback?): string`

Get a single copy value with fallback.

**Parameters:**
- `planKey` (string) - The plan identifier
- `copyKey` (string) - The key to get (e.g., 'displayName')
- `t` (function) - Translation function
- `fallback` (string, optional) - Fallback value

**Returns:** The translated value or fallback

**Example:**
```tsx
const name = getPlanCopyValue('pro', 'displayName', t, 'Pro Plan');
```

---

### `hasPlanCopyKey(planKey, copyKey, t): boolean`

Check if a specific key exists.

**Parameters:**
- `planKey` (string) - The plan identifier
- `copyKey` (string) - The key to check
- `t` (function) - Translation function

**Returns:** `true` if key exists and has a value

**Example:**
```tsx
if (hasPlanCopyKey('advanced', 'cta', t)) {
  const ctaText = getPlanCopyValue('advanced', 'cta', t);
}
```

## Best Practices

### ✅ DO

- Use `hasPlanCopy()` before rendering plans
- Store only marketing text in i18n, not prices
- Use `plan_key` from database as i18n key
- Provide fallbacks for missing translations
- Keep bullets concise and scannable
- Make CTAs action-oriented

### ❌ DON'T

- Don't put prices in i18n (e.g., `"£9.99"`)
- Don't assume all plans have copy
- Don't hardcode plan keys in components
- Don't mix pricing logic with copy logic
- Don't use `t()` directly for plan copy (use helpers)

## Migration from Old System

If you have components using the old `features.basic.*` structure:

### Before
```tsx
const feature1 = t('features.basic.socialProfiles');
const feature2 = t('features.basic.postsPerMonth');
```

### After
```tsx
const copy = getPlanCopy('basic', t);
const bullets = copy.bullets; // All features as array
```

The old `features.*` keys are kept for backward compatibility but should be migrated to use the new `plans.*` structure and helper functions.

## Troubleshooting

### Plan Not Showing

**Problem:** Plan exists in database but doesn't appear in UI

**Solution:** Check if i18n copy exists:
```tsx
console.log('Has copy?', hasPlanCopy(plan.plan_key, t));
```

Add missing keys to `locales/en.json`.

---

### Translation Keys Showing Instead of Text

**Problem:** Seeing "plans.basic.displayName" instead of "Basic"

**Solution:** Translation is missing or key is wrong:
1. Check spelling of `plan_key` in database
2. Ensure `locales/en.json` has matching key
3. Restart dev server to reload translations

---

### Bullets Not Appearing

**Problem:** Bullets array is empty

**Solution:** Check array structure in JSON:
```json
"bullets": [
  "Feature 1",
  "Feature 2"
]
```

Not:
```json
"bullets": {
  "0": "Feature 1",
  "1": "Feature 2"
}
```

## Support

For questions or issues:
1. Check this guide
2. Review examples in `/lib/i18n/plan-copy.ts`
3. Look at existing plan implementations
4. Check the type definitions in `plan-copy.types.ts`
