# Currency & Discount System Documentation

## Overview

The ZARZOOM pricing system now features:
- **Dynamic multi-currency support** - Truth lives in the database
- **Geolocation-based currency detection** - Auto-detects user's preferred currency
- **Advertising partnership discount** - 15% discount for allowing promotional posts
- **Monthly-only billing** - Simplified from monthly/annual toggle
- **Smart plan filtering** - Hides plans without prices in selected currency

---

## Architecture

### Components

#### 1. **CurrencyToggle** (`components/pricing/currency-toggle.tsx`)
- Displays all available currencies from database
- Supports unlimited currencies (GBP, USD, EUR, CAD, AUD, JPY, INR, etc.)
- Dynamic currency metadata with symbols and full names
- Persists selection to localStorage

#### 2. **DiscountToggle** (`components/pricing/discount-toggle.tsx`)
- Toggle for advertising partnership discount
- Displays discount percentage and max ads per week
- Visual feedback when active
- Persists preference to localStorage

#### 3. **PricingShell** (`components/pricing/pricing-shell.tsx`)
- Main pricing container
- Manages currency state with geolocation detection
- Manages discount state
- Filters plans based on currency availability
- Passes discount to PlanCard for calculation

#### 4. **PlanCard** (`components/pricing/plan-card.tsx`)
- Displays individual plan with pricing
- Calculates and shows discounted price
- Shows original price with strikethrough when discount active
- Visual indicators for savings

### Utilities

#### 5. **Geolocation** (`lib/pricing/geolocation.ts`)
- Multi-strategy currency detection:
  1. localStorage (user preference)
  2. Timezone detection
  3. Browser locale
  4. Number format detection
  5. USD fallback
- Saves/loads currency preference
- Saves/loads discount preference

---

## Configuration

### Discount Settings

Located in `components/pricing/pricing-shell.tsx`:

```typescript
const DISCOUNT_PERCENT = 15; // 15% discount
const MAX_ADS_PER_WEEK = 7; // Once per day
```

To change discount:
1. Update `DISCOUNT_PERCENT` constant
2. Update `MAX_ADS_PER_WEEK` constant
3. Both values are automatically used throughout the system

### Adding New Currencies

**Database-first approach:**

1. Add price records to `plan_prices` table with new currency:
```sql
INSERT INTO plan_prices (plan_id, currency, interval, amount_minor, is_active)
VALUES 
  ('plan-id', 'AUD', 'monthly', 1499, true); -- A$14.99
```

2. Add currency metadata to `components/pricing/currency-toggle.tsx`:
```typescript
const CURRENCY_LABELS = {
  // ... existing
  AUD: { symbol: "A$", label: "AUD", name: "Australian Dollar" },
};
```

3. Currency automatically appears in selector if plans have prices

### Geolocation Country Mapping

Located in `lib/pricing/geolocation.ts`:

```typescript
const CURRENCY_MAP: Record<string, Currency> = {
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  // Add more countries
  AU: "AUD",
  CA: "CAD",
};
```

---

## User Experience

### First Visit Flow

1. User lands on pricing page
2. System detects currency via geolocation (timezone → locale → USD fallback)
3. Currency selector shows detected currency
4. Discount toggle loads from localStorage (default: OFF)
5. Plans display in detected currency
6. Plans without prices in selected currency are hidden

### Currency Change Flow

1. User clicks different currency in toggle
2. Currency saved to localStorage
3. Plans re-render with new prices
4. Plans without new currency disappear
5. If all plans hidden, fallback message shown

### Discount Flow

1. User enables advertising discount toggle
2. Preference saved to localStorage
3. All plan prices recalculate with 15% discount
4. Original prices shown with strikethrough
5. Green "Save 15%" badges appear
6. Discount persists across sessions

---

## API Integration

### GET /api/v1/billing/plans

Returns all active plans with all prices:

```json
{
  "plans": [
    {
      "planKey": "basic",
      "name": "Basic",
      "prices": [
        { "currency": "GBP", "interval": "monthly", "amountMinor": 999 },
        { "currency": "USD", "interval": "monthly", "amountMinor": 1299 },
        { "currency": "EUR", "interval": "monthly", "amountMinor": 1199 }
      ]
    }
  ]
}
```

### Plan Filtering Logic

```typescript
// In PricingShell
plans.filter((plan) => {
  const hasPrice = plan.prices.some(
    (p) => p.currency === currency && 
           p.interval === "monthly" && 
           p.isActive
  );
  return hasPrice; // Hide if no matching price
});
```

---

## localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `zarzoom_currency` | `Currency` | User's selected currency (GBP/USD/EUR/etc.) |
| `zarzoom_discount_enabled` | `"true"` \| `"false"` | Advertising discount opt-in status |

---

## Discount Calculation

```typescript
// In PlanCard
const baseAmount = price.amountMinor; // e.g., 999 (£9.99)
const discountAmount = Math.round(baseAmount * (discountPercent / 100)); // 150
const displayAmount = baseAmount - discountAmount; // 849 (£8.49)
```

Example with 15% discount:
- Base: £9.99 → £8.49 (saves £1.50)
- Base: $12.99 → $11.04 (saves $1.95)
- Base: €11.99 → $10.19 (saves €1.80)

---

## Advertising Terms

When user enables discount:
- **Discount:** 15% off monthly subscription
- **Max frequency:** 7 ads per week (1 per day)
- **Control:** User can disable anytime (discount removed)
- **Content:** ZARZOOM promotional posts only
- **Feed:** Posted to user's connected social accounts

Stored in user's subscription metadata:
```typescript
{
  ad_partnership_enabled: boolean,
  ad_partnership_max_per_week: 7,
  discount_applied_percent: 15
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Currency auto-detects based on location
- [ ] Currency persists after page reload
- [ ] Discount toggle persists after page reload
- [ ] Prices recalculate correctly with discount
- [ ] Plans hide when currency unavailable
- [ ] Fallback message shows when all plans hidden
- [ ] Multiple currencies display correctly
- [ ] Discount indicators visible and accurate

### Test Currency Detection

```javascript
// In browser console
localStorage.removeItem('zarzoom_currency');
location.reload();
// Check console logs for detection strategy used
```

### Test Discount Calculation

```javascript
// In browser console
const basePrice = 999; // £9.99
const discount = 15;
const result = basePrice - Math.round(basePrice * (discount / 100));
console.log(result); // Should be 849 (£8.49)
```

---

## Future Enhancements

### Potential Features

1. **Dynamic discount rates** - Different discounts per plan tier
2. **Regional pricing** - Same plan, different prices by country
3. **Exchange rate API** - Real-time conversion
4. **Trial period discount** - Extra discount for first month
5. **Referral discounts** - Stack with advertising discount
6. **Annual billing return** - Optional for larger discounts

### Database Schema for Dynamic Discounts

```sql
CREATE TABLE discount_campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  discount_percent INTEGER NOT NULL,
  max_ads_per_week INTEGER,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
);
```

---

## Troubleshooting

### Plans Not Showing

**Issue:** No plans visible on pricing page

**Solutions:**
1. Check browser console for "[v0] Hiding plan..." logs
2. Verify selected currency has prices in database
3. Try switching to GBP (default currency)
4. Check `/api/v1/billing/plans` response

### Currency Not Detected

**Issue:** Always defaults to USD

**Solutions:**
1. Clear localStorage: `localStorage.removeItem('zarzoom_currency')`
2. Check timezone: `Intl.DateTimeFormat().resolvedOptions().timeZone`
3. Check locale: `navigator.language`
4. Manually select preferred currency (will persist)

### Discount Not Applying

**Issue:** Toggle enabled but prices unchanged

**Solutions:**
1. Check localStorage: `localStorage.getItem('zarzoom_discount_enabled')`
2. Verify `discountPercent` prop passed to `PlanCard`
3. Check browser console for calculation errors
4. Hard refresh page (Cmd+Shift+R / Ctrl+Shift+R)

---

## Migration Notes

### Breaking Changes from Previous Version

1. **No Annual Billing** - All prices now monthly only
2. **IntervalToggle Removed** - Delete any imports/usage
3. **New Props** - `PlanCard` now requires `discountPercent` prop
4. **Currency Detection** - Replaces hardcoded GBP default

### Migration Steps

1. Update database with monthly prices for all currencies
2. Remove annual price logic from checkout flow
3. Update subscription creation to handle discount metadata
4. Test currency detection across regions
5. Update billing webhooks to respect discount flag

---

## Support & Contact

For questions about the pricing system:
- Engineering: Check `docs/PRICING_AUDIT_2026.md`
- Product: Review discount terms and conditions
- Finance: Confirm discount percentage and ad frequency limits
