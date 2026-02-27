"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { Currency, BillingInterval } from "@/lib/billing/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CURRENCY_META: Record<Currency, { symbol: string; locale: string }> = {
  GBP: { symbol: "\u00A3", locale: "en-GB" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "\u20AC", locale: "de-DE" },
};

/** Format minor-unit integer to display string, e.g. 2999 -> "€29.99" or "$29.99" */
function formatPrice(amountMinor: number, currency: Currency): string {
  const major = amountMinor / 100;
  const { locale, symbol } = CURRENCY_META[currency];
  
  // Format number without currency symbol using US locale for consistent number formatting
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  
  const numberString = formatter.format(major);
  
  // For EUR, place symbol before the number; for others, after
  if (currency === "EUR") {
    return `${symbol}${numberString}`;
  }
  
  return `${symbol}${numberString}`;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlanPrice {
  id: string;
  currency: Currency | string;
  interval: BillingInterval | string;
  amountMinor: number;
  isActive: boolean;
  billingProviderId: string | null;
}

interface PlanCardProps {
  name: string;
  slug: string;
  description: string;
  tagline?: string;
  features: string[];
  prices: PlanPrice[];
  highlight: boolean;
  currency: Currency;
  interval: BillingInterval;
  isLoggedIn: boolean;
  cta?: string;
  discountPercent?: number;
  onChoosePlan: (priceId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlanCard({
  name,
  description,
  tagline,
  features,
  prices,
  highlight,
  currency,
  interval,
  isLoggedIn,
  cta,
  discountPercent = 0,
  onChoosePlan,
}: PlanCardProps) {
  const matchedPrice = prices.find(
    (p) => p.currency === currency && p.interval === interval && p.isActive
  );

  /* Fallback: try GBP for same interval, else show Contact us */
  const fallbackPrice =
    !matchedPrice && currency !== "GBP"
      ? prices.find((p) => p.currency === "GBP" && p.interval === interval && p.isActive)
      : null;

  const price = matchedPrice ?? fallbackPrice;
  const isFallback = !matchedPrice && !!fallbackPrice;
  
  // Calculate discounted price
  const baseAmount = price?.amountMinor ?? 0;
  const discountAmount = discountPercent > 0 ? Math.round(baseAmount * (discountPercent / 100)) : 0;
  const displayAmount = baseAmount - discountAmount;
  const hasDiscount = discountPercent > 0 && baseAmount > 0;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-8",
        "transition-shadow duration-200",
        highlight
          ? "border-[hsl(var(--primary))] shadow-lg shadow-[hsl(var(--primary)/0.08)]"
          : "border-[hsl(var(--border))] hover:shadow-md"
      )}
    >
      {/* Most popular badge */}
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-[hsl(var(--primary))] px-4 py-1 text-xs font-semibold text-[hsl(var(--primary-foreground))]">
            Most popular
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          {name}
        </h3>
        {tagline && (
          <p className="mt-1 text-xs font-medium text-[hsl(var(--primary))]">
            {tagline}
          </p>
        )}
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="mb-6">
        {price ? (
          <>
            {hasDiscount && (
              <div className="mb-1">
                <span className="text-sm text-[hsl(var(--muted-foreground))] line-through">
                  {formatPrice(baseAmount, isFallback ? "GBP" : currency)}
                </span>
                <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                  Save {discountPercent}%
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-4xl font-bold tracking-tight",
                hasDiscount ? "text-green-600" : "text-[hsl(var(--foreground))]"
              )}>
                {formatPrice(displayAmount, isFallback ? "GBP" : currency)}
              </span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                /month
              </span>
            </div>
            {isFallback && (
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Shown in GBP. {currency} pricing coming soon.
              </p>
            )}
            {hasDiscount && (
              <p className="mt-1 text-xs text-green-600 font-medium">
                Advertising partnership discount applied
              </p>
            )}
          </>
        ) : (
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
              Contact us
            </span>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="mb-8">
        {price ? (
          isLoggedIn ? (
            <button
              onClick={() => onChoosePlan(price.id)}
              className={cn(
                "w-full rounded-lg py-3 text-sm font-semibold transition-colors",
                highlight
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(142_71%_40%)]"
                  : "border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              )}
            >
              {cta || "Choose plan"}
            </button>
          ) : (
            <a
              href="/signup"
              className={cn(
                "block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors",
                highlight
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(142_71%_40%)]"
                  : "border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              )}
            >
              {cta || "Sign up"}
            </a>
          )
        ) : (
          <a
            href="mailto:sales@zarzoom.com"
            className="block w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-3 text-center text-sm font-semibold text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
          >
            Contact sales
          </a>
        )}
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-3" role="list">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
            <Check
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                highlight
                  ? "text-[hsl(var(--primary))]"
                  : "text-[hsl(var(--muted-foreground))]"
              )}
              aria-hidden="true"
            />
            <span className="text-[hsl(var(--foreground))]">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
