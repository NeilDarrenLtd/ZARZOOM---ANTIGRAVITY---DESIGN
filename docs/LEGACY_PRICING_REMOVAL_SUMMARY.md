# Legacy Pricing Removal Summary

## Objective

Remove all hardcoded numeric pricing from the codebase, ensuring a single source of truth in the database.

## Changes Made

### 1. Removed Hardcoded Pricing

#### Files Modified

**`app/dashboard/profile/page.tsx`**
- ❌ Removed: `PLAN_PRICES` constant with hardcoded values (£29, £79, £199)
- ✅ Added: Dynamic price loading from `GET /api/v1/billing/plans`
- ✅ Added: `planPrices` state to store fetched pricing
- ✅ Added: Graceful fallback when prices unavailable ("—" displayed)

**Before:**
```typescript
const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  basic: { monthly: 29, annual: 290 },
  pro: { monthly: 79, annual: 790 },
  scale: { monthly: 199, annual: 1990 },
};
```

**After:**
```typescript
const [planPrices, setPlanPrices] = useState<Record<string, { monthly: number; annual: number }>>({});

useEffect(() => {
  async function load() {
    const plansRes = await fetch("/api/v1/billing/plans");
    const plansBody = await plansRes.json();
    // Extract and convert prices from amountMinor to display format
    setPlanPrices(pricesMap);
  }
}, []);
```

### 2. Validation System

#### New Files Created

**`lib/i18n/validate-no-pricing.ts`** (149 lines)
- Recursive scanner for pricing patterns in translation objects
- Detects: currency symbols, price strings, decimals, pricing keywords
- `validateNoPricing()`: Check single translation object
- `validateAllLocales()`: Check all locale files
- `devCheckPricing()`: Development-only warnings

**`scripts/validate-i18n.ts`** (49 lines)
- CLI script to validate all locale files
- Exits with code 1 if pricing found (CI/CD friendly)
- Detailed error reporting with remediation steps

**Pricing Patterns Detected:**
```typescript
/\$\d+/        // $29
/£\d+/         // £79
/€\d+/         // €99
/\d+\s*\/\s*month/i  // 29/month
/\d+\.\d{2}/   // 29.99
/price.*\d+/i  // price: 29
```

### 3. Development Warnings

**`lib/i18n/context.tsx`** (Modified)
- Added import: `devCheckPricing` from validation utility
- Validates English translations on initial load (dev mode only)
- Validates dynamically loaded translations (dev mode only)
- Console warnings appear immediately when pricing detected

**Impact:**
- Developers see warnings in real-time during development
- No app crashes, just console warnings
- Encourages fixing before commit

### 4. Documentation

**`docs/NO_PRICING_IN_I18N.md`** (319 lines)
- Comprehensive policy document
- Why pricing belongs in database
- Examples of what NOT to do
- Examples of correct implementation
- Migration guide for existing projects
- Validation instructions
- CI/CD integration guide
- FAQ section

**`docs/LEGACY_PRICING_REMOVAL_SUMMARY.md`** (This file)
- Summary of all changes
- Before/after comparisons
- Verification steps
- Future maintenance guidelines

### 5. npm Scripts

**`package.json`**
- Added: `"validate:i18n": "tsx scripts/validate-i18n.ts"`

**Usage:**
```bash
npm run validate:i18n
```

## Verification

### Step 1: Check Removed Hardcoding

```bash
# Should return NO matches
grep -r "\(29\|79\|199\|290\|790\|1990\)" app/ components/ --include="*.tsx" --include="*.ts"
```

### Step 2: Run Validation Script

```bash
npm run validate:i18n
# Expected: ✅ SUCCESS: No pricing found in i18n files
```

### Step 3: Development Mode Check

```bash
npm run dev
# Check console - should see no pricing warnings
```

### Step 4: Test Profile Page

1. Navigate to `/dashboard/profile`
2. Verify plan prices load from API
3. Check Network tab: `GET /api/v1/billing/plans` called
4. Verify prices display correctly

## Current State

### ✅ Clean Files

- All locale files (`locales/*.json`) - No numeric pricing
- Profile page - Fetches prices from API
- i18n context - Validates on load

### ✅ Protection Mechanisms

1. **Development warnings** - Immediate console feedback
2. **Validation script** - Pre-commit checks
3. **CI/CD ready** - Fails build if pricing found
4. **Documentation** - Clear guidelines for developers

### ✅ Single Source of Truth

```
Database (plans + plan_prices tables)
  ↓
GET /api/v1/billing/plans API
  ↓
Components (fetch and display)
  ↓
i18n (labels and descriptions ONLY)
```

## Migration Path for Future Developers

If you find hardcoded pricing:

1. **Identify**: Run `npm run validate:i18n` or grep for numbers
2. **Remove**: Delete numeric pricing from i18n/code
3. **Fetch**: Use `GET /api/v1/billing/plans` API
4. **Format**: Use `formatPrice()` helper from `@/lib/billing/format`
5. **Verify**: Run validation again

## CI/CD Integration

Add to your pipeline:

```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: npm install

- name: Validate i18n files
  run: npm run validate:i18n

- name: Build
  run: npm run build
```

## Key Benefits

1. **Easy Price Updates**: Change in admin UI, no deployment
2. **Multi-Currency**: Database handles all currencies dynamically
3. **A/B Testing**: Test prices without code changes
4. **Regional Pricing**: Different prices per region
5. **Audit Trail**: Database logs all price changes
6. **Type Safety**: API responses are typed
7. **Error Prevention**: Validation catches mistakes early

## Files Changed Summary

### Modified
- `app/dashboard/profile/page.tsx` - Removed hardcoded prices, added API fetching
- `lib/i18n/context.tsx` - Added dev validation
- `package.json` - Added validation script

### Created
- `lib/i18n/validate-no-pricing.ts` - Validation logic
- `scripts/validate-i18n.ts` - CLI validation script
- `docs/NO_PRICING_IN_I18N.md` - Policy documentation
- `docs/LEGACY_PRICING_REMOVAL_SUMMARY.md` - This summary

### Verified Clean
- `locales/en.json` - No pricing found
- All other locale files - No pricing found

## Maintenance

### Weekly
- None required (automated validation)

### On New Locale Addition
- Validation runs automatically in dev mode
- Run `npm run validate:i18n` before merging

### On New Feature
- If displaying prices: Use API, not hardcoding
- If mentioning prices: Use i18n templates with DB values
- Never put numbers in translation files

## Support

Questions? Check these docs:
- `docs/NO_PRICING_IN_I18N.md` - Detailed policy
- `docs/PRICING_IMPLEMENTATION_SUMMARY.md` - Full pricing system
- `docs/API_PLANS_ENDPOINT.md` - API documentation
- `docs/I18N_PLAN_COPY_GUIDE.md` - i18n structure

## Conclusion

All numeric pricing has been removed from the codebase. The system now:
- ✅ Fetches pricing from database via API
- ✅ Validates i18n files automatically
- ✅ Warns developers in real-time
- ✅ Fails CI/CD if pricing detected
- ✅ Documents the policy clearly

The single source of truth is the database, ensuring consistency and flexibility across the entire pricing system.
