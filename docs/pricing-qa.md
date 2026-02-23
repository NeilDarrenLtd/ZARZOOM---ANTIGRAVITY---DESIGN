# Pricing System QA & Validation Guide

**Version:** 2.0  
**Last Updated:** 2026-02-23  
**Status:** Production Ready

---

## Overview

This document provides comprehensive quality assurance procedures for the ZARZOOM pricing system. It covers all critical user flows, edge cases, and validation checks to ensure the pricing infrastructure works correctly across database, i18n, and UI layers.

---

## Quick Reference

### Core Requirements

✅ Plans MUST exist in database AND have complete i18n copy to display  
✅ Pricing comes from database only (never hardcoded)  
✅ Currency switching must work for all available currencies  
✅ Plans without prices in selected currency are hidden  
✅ Inactive plans do not appear on public pages  
✅ Admin sees warnings for plans missing i18n copy

---

## Test Checklist

### 1. Plan Visibility - Database + i18n Gate

#### Test 1.1: New Plan Without i18n (MUST BE INVISIBLE)

**Setup:**
1. Admin creates new plan via `/admin/billing-v2/plans/new`
   - Plan key: `test-plan`
   - Name: `Test Plan`
   - Add GBP monthly price: 999 pence (£9.99)
   - Set active: `true`
2. Do NOT add i18n copy to `locales/en.json`

**Expected Behavior:**
- [ ] Plan appears in admin list at `/admin/billing-v2`
- [ ] Admin sees ⚠️ warning: "Missing i18n copy - plan will not be visible to users"
- [ ] Plan does NOT appear on `/pricing`
- [ ] Plan does NOT appear in onboarding wizard Step 4
- [ ] Console shows: `[v0] Hiding plan test-plan - missing required i18n copy`

**Why:** Prevents launching plans with no marketing copy

---

#### Test 1.2: Add i18n Copy (PLAN BECOMES VISIBLE)

**Setup:**
1. Add to `locales/en.json`:
```json
{
  "plans": {
    "test-plan": {
      "displayName": "Test Plan",
      "shortTagline": "For testing purposes",
      "description": "A plan used for QA validation",
      "bullets": [
        "Test feature 1",
        "Test feature 2",
        "Test feature 3"
      ],
      "cta": "Choose Test Plan"
    }
  }
}
```
2. Refresh pricing page

**Expected Behavior:**
- [ ] Plan now appears on `/pricing`
- [ ] Plan appears in wizard Step 4
- [ ] Admin warning ⚠️ disappears
- [ ] Console shows: `[v0] Pricing page: displaying X plans` (includes test-plan)
- [ ] All i18n text displays correctly

**Why:** Confirms i18n gate works correctly

---

### 2. Multi-Currency Support

#### Test 2.1: Add EUR Currency

**Setup:**
1. Edit `test-plan` in admin
2. Add EUR monthly price: 1099 (€10.99)
3. Add EUR annual price: 10990 (€109.90)
4. Save changes

**Expected Behavior:**
- [ ] EUR appears in currency toggle on `/pricing`
- [ ] Switch to EUR shows €10.99/month
- [ ] Switch back to GBP shows £9.99/month
- [ ] localStorage saves currency preference
- [ ] Refresh page maintains currency selection

**Why:** Multi-currency must work seamlessly

---

#### Test 2.2: Currency Without Plan Price (PLAN HIDES)

**Setup:**
1. Create plan `advanced` with only GBP pricing
2. Do NOT add USD prices
3. Ensure i18n copy exists for `advanced`
4. Visit `/pricing` and switch to USD

**Expected Behavior:**
- [ ] `advanced` plan disappears when USD selected
- [ ] Other plans with USD pricing remain visible
- [ ] Console shows: `[v0] Hiding plan advanced - no USD monthly price available`
- [ ] No broken UI or empty cards

**Why:** Prevents showing plans without valid pricing

---

### 3. Plan Activation / Deactivation

#### Test 3.1: Deactivate Active Plan

**Setup:**
1. Go to `/admin/billing-v2`
2. Toggle OFF the active status for `test-plan`
3. Visit `/pricing` as regular user

**Expected Behavior:**
- [ ] Plan disappears from `/pricing` immediately
- [ ] Plan disappears from wizard Step 4
- [ ] Admin can still see it (marked inactive)
- [ ] Console shows: `[v0] Pricing page: displaying X plans` (decreased count)

**Why:** Allows removing plans from sale without deleting data

---

#### Test 3.2: Reactivate Plan

**Setup:**
1. Toggle ON the active status for `test-plan`
2. Refresh `/pricing`

**Expected Behavior:**
- [ ] Plan reappears on pricing page
- [ ] All pricing and copy intact
- [ ] Sort order maintained

**Why:** Confirms activation/deactivation is reversible

---

### 4. Edge Cases

#### Test 4.1: Empty Database (FALLBACK MESSAGE)

**Setup:**
1. Deactivate ALL plans in admin
2. Visit `/pricing` as user

**Expected Behavior:**
- [ ] Amber fallback message displays:
  - Title: "Pricing Temporarily Unavailable"
  - Message: "We're currently updating our pricing plans..."
- [ ] No broken UI or errors
- [ ] Console shows: `[v0] Pricing page: displaying 0 plans`

**Why:** Graceful handling when no plans available

---

#### Test 4.2: Plan in DB but No i18n (DEV WARNING)

**Setup:**
1. Run in development mode
2. Create plan `orphan-plan` in database
3. Do NOT add i18n copy

**Expected Behavior:**
- [ ] Browser console shows:
  ```
  ⚠️ [v0] PLAN MISMATCH: Plan 'orphan-plan' exists in DB but missing i18n copy
  → Add plans.orphan-plan.{displayName,shortTagline,description,bullets} to locales/en.json
  ```
- [ ] Plan does not display (validation working)

**Why:** Helps developers catch config errors

---

#### Test 4.3: i18n Without DB Entry (DEV WARNING)

**Setup:**
1. Add to `locales/en.json`:
```json
{
  "plans": {
    "ghost-plan": {
      "displayName": "Ghost Plan",
      "shortTagline": "Doesn't exist",
      "description": "This plan is not in the database",
      "bullets": ["Feature 1"]
    }
  }
}
```
2. Do NOT create `ghost-plan` in database
3. Visit `/pricing` in development

**Expected Behavior:**
- [ ] Console shows:
  ```
  ⚠️ [v0] ORPHANED I18N: Translation exists for 'ghost-plan' but plan not found in database
  → Either create the plan in DB or remove the i18n entry
  ```
- [ ] Plan does not display (correctly filtered)

**Why:** Prevents stale translations cluttering codebase

---

### 5. Admin Interface

#### Test 5.1: Admin Warning for Missing i18n

**Setup:**
1. Visit `/admin/billing-v2`
2. View plan list

**Expected Behavior:**
- [ ] Plans WITH complete i18n show ✅ "i18n Complete"
- [ ] Plans WITHOUT i18n show ⚠️ "Missing i18n - Not visible to users"
- [ ] Warning is visually distinct (amber/yellow)
- [ ] Click warning shows required keys

**Why:** Admins need clear visibility into plan status

---

#### Test 5.2: Plan Creation Validation

**Setup:**
1. Visit `/admin/billing-v2/plans/new`
2. Try to create plan with:
   - Invalid plan_key: `Test Plan` (spaces)
   - Price: 0 or negative

**Expected Behavior:**
- [ ] plan_key validation shows: "Must be lowercase alphanumeric with dashes/underscores"
- [ ] Price validation shows: "Must be greater than 0"
- [ ] Form cannot submit until fixed
- [ ] Console shows validation errors

**Why:** Prevents invalid data entry

---

#### Test 5.3: Discount Configuration

**Setup:**
1. Create plan with discount settings:
   - Discount percent: 15
   - Max ads per week: 7
2. Save and view on pricing page

**Expected Behavior:**
- [ ] Discount toggle appears on pricing page
- [ ] Toggle ON shows 15% discount applied
- [ ] Price changes from original to discounted (green text)
- [ ] Shows "Advertising partnership discount applied"
- [ ] Discount persists to localStorage

**Why:** Validates discount feature works end-to-end

---

### 6. Currency Geolocation

#### Test 6.1: Default Currency Detection

**Setup:**
1. Clear localStorage
2. Visit `/pricing` for first time
3. Check detected currency

**Expected Behavior:**
- [ ] Currency auto-detected based on IP/locale
- [ ] Falls back to USD if detection fails
- [ ] Console shows: `[v0] Initialized pricing with currency: XXX`
- [ ] User can manually override

**Why:** Good UX with sensible defaults

---

### 7. Performance & Caching

#### Test 7.1: API Response Time

**Setup:**
1. Open browser DevTools Network tab
2. Visit `/pricing`
3. Check `/api/v1/billing/plans` request

**Expected Behavior:**
- [ ] Response time < 500ms
- [ ] Status: 200 OK
- [ ] Cache headers present: `Cache-Control: public, max-age=120`
- [ ] Subsequent requests served from cache

**Why:** Fast page loads improve conversion

---

#### Test 7.2: Plan Filtering Performance

**Setup:**
1. Create 10+ plans with various currencies
2. Switch between currencies rapidly
3. Monitor console for lag

**Expected Behavior:**
- [ ] Currency switch is instant
- [ ] No visible re-rendering delay
- [ ] Console shows filtering logs
- [ ] No React warnings

**Why:** Smooth UX for currency switching

---

## Validation Scripts

### Runtime Validation (Development Mode)

The following validations run automatically in development:

```typescript
// lib/billing/displayable-plans.ts - validates plan visibility
✓ Checks DB plans have i18n copy
✓ Warns if i18n exists but no DB entry
✓ Filters plans correctly
```

```typescript
// lib/i18n/validate-no-pricing.ts - validates no pricing in i18n
✓ Scans translations for numeric pricing
✓ Warns if currency symbols or prices found
✓ Prevents hardcoded pricing
```

### Manual Validation Commands

```bash
# Validate i18n files don't contain pricing
npm run validate:i18n

# Check plan/i18n sync
npm run validate:plans

# Run all validations
npm run validate:all
```

---

## Common Issues & Fixes

### Issue: Plan not showing on pricing page

**Diagnosis:**
1. Check if plan exists in database: `/admin/billing-v2`
2. Check if plan is active: Look for toggle
3. Check if i18n exists: Look for ⚠️ warning
4. Check console: Look for `[v0] Hiding plan...` messages

**Fix:**
- If missing i18n: Add to `locales/en.json` under `plans.{plan_key}`
- If inactive: Toggle status in admin
- If no price for currency: Add price or switch currency

---

### Issue: Currency not appearing in toggle

**Diagnosis:**
1. Check if ANY plan has prices in that currency
2. Look in database: `plan_prices` table
3. Check console for derived currencies

**Fix:**
- Add prices for that currency to at least one active plan
- Currency will auto-appear in toggle

---

### Issue: Discount not applying

**Diagnosis:**
1. Check localStorage: `zarzoom_discount_enabled`
2. Check discount settings in `quota_policy` field
3. Check console: Look for discount calculation logs

**Fix:**
- Clear localStorage and toggle discount again
- Verify discount percent stored in plan's `quota_policy.discount_percent`
- Check max_ads stored in `quota_policy.max_ads_per_week`

---

## Regression Testing

Before each release, verify:

- [ ] All tests in sections 1-7 pass
- [ ] No console errors on `/pricing`
- [ ] Admin can create/edit plans
- [ ] Pricing displays correctly in all currencies
- [ ] Discount toggle works
- [ ] Wizard Step 4 shows plans
- [ ] Fallback message works with empty DB

---

## Continuous Integration

### Pre-commit Checks

```bash
# Add to .husky/pre-commit
npm run validate:i18n
npm run lint
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
- name: Validate Pricing System
  run: |
    npm run validate:i18n
    npm run validate:plans
    npm run test:pricing
```

---

## Success Criteria

A passing QA means:

✅ All checklist items marked complete  
✅ No console errors in development or production  
✅ Admin warnings display correctly  
✅ Runtime validations catch mismatches  
✅ Users see only valid, properly priced plans  
✅ Pricing changes reflect immediately  
✅ Multi-currency works flawlessly

---

## Support & Troubleshooting

**Documentation:**
- `/docs/PRICING_SCHEMA_MIGRATION.md` - Database schema
- `/docs/I18N_PLAN_COPY_GUIDE.md` - i18n structure
- `/docs/NO_PRICING_IN_I18N.md` - Pricing policy
- `/docs/PLAN_DISPLAY_GATING.md` - Display rules

**Contact:**
- Technical issues: Check console for `[v0]` debug logs
- Database issues: Review Supabase logs
- Translation issues: Validate with `npm run validate:i18n`

---

**End of QA Guide**
