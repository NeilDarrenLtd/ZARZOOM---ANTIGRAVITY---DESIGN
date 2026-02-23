# QA & Validation System

**Complete Guide to ZARZOOM Pricing Quality Assurance**

---

## Overview

This document describes the comprehensive validation system that ensures pricing integrity across database, i18n, and UI layers. The system provides multiple layers of protection with runtime warnings, CLI tools, and detailed test checklists.

---

## Quick Start

### Run All Validations

```bash
# Validate everything before deploying
npm run validate:all

# Or run individually
npm run validate:i18n   # Check for pricing in translations
npm run validate:plans  # Check DB/i18n sync
```

### Development Mode

Validations run automatically in development:
- ✅ Loads translations → checks for numeric pricing
- ✅ Fetches plans → validates DB/i18n sync
- ✅ Filters plans → warns about mismatches

---

## Validation Layers

### Layer 1: Build-Time Validation (CLI)

**Purpose:** Catch issues before deployment

**Tools:**
- `npm run validate:i18n` - Scans translation files for pricing
- `npm run validate:plans` - Checks plan/i18n synchronization

**When to run:**
- Before every commit
- In CI/CD pipeline
- Before production deploy

**Exit codes:**
- `0` = Pass
- `1` = Fail (blocks deployment)

---

### Layer 2: Runtime Validation (Development)

**Purpose:** Immediate feedback during development

**Features:**

#### A. Plan/i18n Sync Warnings

```javascript
// When plan exists in DB but missing i18n:
⚠️ [v0] PLAN MISMATCH: Plan 'premium' exists in DB but missing i18n copy
→ Add plans.premium.{displayName,shortTagline,description,bullets} to locales/en.json
  This plan will NOT be visible to users until i18n is added.
```

```javascript
// When i18n exists but plan not in DB:
⚠️ [v0] ORPHANED I18N: Translation exists for 'old-plan' but plan not found in database
→ Either create the plan in DB or remove plans.old-plan from locales/en.json
  This translation is unused and should be cleaned up.
```

#### B. Pricing in i18n Warnings

```javascript
// If numeric pricing detected in translations:
⚠️ [v0] PRICING IN I18N: Found 3 potential pricing references in en.json
→ Lines: 45, 78, 123
  Pricing must come from database only. Remove hardcoded prices.
```

**Triggers:**
- Loading i18n context (`lib/i18n/context.tsx`)
- Fetching displayable plans (`lib/billing/displayable-plans.ts`)
- Page component render (pricing/wizard)

---

### Layer 3: Display Gating (Production)

**Purpose:** Enforce strict visibility rules in production

**Rules:**
1. Plan MUST exist in database
2. Plan MUST have complete i18n copy
3. Plan MUST be active (`is_active = true`)
4. Plan MUST have prices for selected currency

**Behavior:**
- Plans failing any rule are silently hidden
- Console logs show filtering decisions
- Fallback message if no plans displayable

---

## Validation Scripts

### 1. validate-i18n.ts

**Location:** `/scripts/validate-i18n.ts`

**What it checks:**
- Currency symbols ($, £, €, ¥, etc.)
- Numeric pricing patterns (9.99, 29/month, etc.)
- Common pricing keywords

**Example output:**

```
🔍 Validating i18n files for pricing content

Checking: locales/en.json
  ✓ No pricing detected

Checking: locales/es.json
  ❌ Found 2 potential pricing references:
     Line 156: "Only $29.99 per month"
     Line 203: "Save 15% - just £25.99"

❌ Validation FAILED
Remove all pricing from translation files.
```

---

### 2. validate-plans.ts

**Location:** `/scripts/validate-plans.ts`

**What it checks:**
- DB plans without i18n copy
- i18n copy without DB plans
- Incomplete i18n (missing required keys)
- Active vs visible plan counts

**Example output:**

```
🔍 Validating Plan & i18n Sync

📊 Fetching plans from database...
✓ Found 3 plan(s) in database

📝 Loading i18n translations...
✓ Loaded translations for 2 plan(s)

🔎 Checking for mismatches...

❌ Plans in database WITHOUT i18n copy:
   • enterprise
     → Add plans.enterprise.{displayName,shortTagline,description,bullets} to locales/en.json

📈 Summary:
   Total plans:        3
   Active plans:       3
   Visible to users:   2
   Hidden (no i18n):   1

❌ Validation FAILED
Fix the errors above before deploying.
```

---

## Runtime Validation Functions

### validatePlanSync()

**Location:** `/lib/billing/validate-plan-sync.ts`

**Usage:**
```typescript
import { validatePlanSync } from '@/lib/billing/validate-plan-sync';

validatePlanSync(dbPlans, translations);
// Logs warnings to console in development
```

**What it validates:**
- Plans in DB missing i18n
- i18n entries without DB plans
- Styled console warnings with actionable fixes

---

### devCheckPricing()

**Location:** `/lib/i18n/validate-no-pricing.ts`

**Usage:**
```typescript
import { devCheckPricing } from '@/lib/i18n/validate-no-pricing';

devCheckPricing(translations, 'en');
// Warns if pricing detected in translations
```

**What it detects:**
- Currency symbols
- Price patterns (XX.XX, X.XX)
- Common pricing phrases
- Percentage discounts

---

## Integration Points

### Where Validations Run

1. **i18n Context Load** (`lib/i18n/context.tsx`)
   - Validates translations on import
   - Runs `devCheckPricing()` in dev mode

2. **Displayable Plans** (`lib/billing/displayable-plans.ts`)
   - Validates plan/i18n sync
   - Runs `validatePlanSync()` before filtering

3. **Pricing Page** (`app/pricing/page.tsx`)
   - Fetches displayable plans
   - Shows fallback if none available

4. **Admin Dashboard** (`app/admin/billing-v2/page.tsx`)
   - Shows i18n warnings
   - Highlights incomplete plans

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Validate Pricing System

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate i18n
        run: npm run validate:i18n
      
      - name: Validate plans
        run: npm run validate:plans
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_KEY }}
```

---

### Pre-commit Hook

**File:** `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pricing validations..."

npm run validate:i18n || exit 1
npm run validate:plans || exit 1

echo "✅ All validations passed"
```

---

## Test Checklist

See `/docs/pricing-qa.md` for comprehensive test procedures covering:

- ✅ Plan visibility gating
- ✅ Multi-currency support
- ✅ Plan activation/deactivation
- ✅ Edge cases (empty DB, missing prices)
- ✅ Admin warnings
- ✅ Discount configuration
- ✅ Currency geolocation
- ✅ Performance & caching

---

## Common Scenarios

### Scenario 1: Adding a New Plan

**Steps:**
1. Create plan in admin UI (`/admin/billing-v2/plans/new`)
2. Note the warning: "Missing i18n - plan will not be visible"
3. Add i18n copy to `locales/en.json`:
   ```json
   {
     "plans": {
       "your-plan-key": {
         "displayName": "...",
         "shortTagline": "...",
         "description": "...",
         "bullets": ["..."]
       }
     }
   }
   ```
4. Run `npm run validate:plans`
5. Refresh pricing page → plan appears

---

### Scenario 2: Removing a Plan

**Option A: Soft Delete (Recommended)**
1. Go to admin dashboard
2. Toggle plan to inactive
3. Plan disappears from public pages
4. Data preserved for historical records

**Option B: Hard Delete**
1. Delete plan from database
2. Run `npm run validate:plans`
3. Warning appears about orphaned i18n
4. Remove i18n entry from `locales/en.json`
5. Run validation again → passes

---

### Scenario 3: Adding New Currency

**Steps:**
1. Edit plan in admin
2. Add price for new currency (e.g., CAD)
3. Save changes
4. Visit pricing page → CAD appears in toggle
5. No code changes needed (dynamic)

---

## Troubleshooting

### Warning: Plan not visible

**Check:**
1. Is plan active? (`is_active = true` in DB)
2. Does i18n exist? (Check `locales/en.json`)
3. Is i18n complete? (displayName, shortTagline, description, bullets)
4. Does price exist for selected currency?

**Fix:** Address whichever check fails

---

### Error: Validation script fails

**Common causes:**
1. Missing Supabase credentials
2. Network connection to database
3. Malformed JSON in locale files

**Fix:** Check environment variables and JSON syntax

---

### Warning: Orphaned i18n

**Meaning:** Translation exists but plan not in database

**Fix Options:**
1. Create the missing plan in database
2. Remove the unused translation entry

---

## Best Practices

### For Developers

✅ **DO:**
- Run `npm run validate:all` before committing
- Check console warnings in development
- Add i18n immediately after creating plan
- Test currency switching with real data

❌ **DON'T:**
- Hardcode prices anywhere in code
- Add numeric pricing to translation files
- Skip validation before deploying
- Create plans without i18n copy

---

### For Admins

✅ **DO:**
- Add i18n copy before activating plans
- Test plan visibility on staging
- Use soft delete (inactive) vs hard delete
- Add all currency prices at once

❌ **DON'T:**
- Activate plans without i18n
- Delete plans that have active subscriptions
- Add prices with amount_minor = 0
- Use invalid plan_key format (must be lowercase slug)

---

## Monitoring

### Production Monitoring

Watch for these patterns in logs:

```javascript
// Good - plans loading correctly
[v0] Pricing page: displaying 3 plans
[v0] Final displayable plans: 3

// Warning - plans being filtered
[v0] Hiding plan advanced - no USD monthly price available
[v0] Plan NOT displayable: premium - missing i18n keys

// Error - no plans available
[v0] Pricing page: displaying 0 plans
// User sees fallback message
```

---

## Summary

The validation system provides:

1. **Build-time checks** via npm scripts
2. **Runtime warnings** in development mode
3. **Display gating** in production
4. **Admin warnings** for missing i18n
5. **Comprehensive test checklist**

This multi-layered approach ensures pricing integrity and prevents common configuration errors.

---

## Related Documentation

- `/docs/pricing-qa.md` - Detailed test checklist
- `/docs/PRICING_SCHEMA_MIGRATION.md` - Database schema
- `/docs/I18N_PLAN_COPY_GUIDE.md` - i18n structure
- `/docs/NO_PRICING_IN_I18N.md` - Pricing policy
- `/docs/PLAN_DISPLAY_GATING.md` - Display rules

---

**Last Updated:** 2026-02-23  
**Version:** 2.0
