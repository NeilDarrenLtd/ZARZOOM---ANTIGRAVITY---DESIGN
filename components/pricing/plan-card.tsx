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

/** Format minor-unit integer to display string, e.g. 2999 -> "29.99" */
function formatPrice(amountMinor: number, currency: Currency): string {
  const major = amountMinor / 100;
  const { locale } = CURRENCY_META[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlanPrice {
  id: string;
  currency: Currency;
  interval: BillingInterval;
  unit_amount: number;
  billing_provider_price_id: string | null;
}

interface PlanCardProps {
  name: string;
  slug: string;
  description: string | null;
  features: string[];
  prices: PlanPrice[];
  highlight: boolean;
  currency: Currency;
  interval: BillingInterval;
  isLoggedIn: boolean;
  onChoosePlan: (priceId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlanCard({
  name,
  description,
  features,
  prices,
  highlight,
  currency,
  interval,
  isLoggedIn,
  onChoosePlan,
}: PlanCardProps) {
  const matchedPrice = prices.find(
    (p) => p.currency === currency && p.interval === interval
  );

  /* Fallback: try GBP for same interval, else show Contact us */
  const fallbackPrice =
    !matchedPrice && currency !== "GBP"
      ? prices.find((p) => p.currency === "GBP" && p.interval === interval)
      : null;

  const price = matchedPrice ?? fallbackPrice;
  const isFallback = !matchedPrice && !!fallbackPrice;

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
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="mb-6">
        {price ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-[hsl(var(--foreground))]">
                {formatPrice(price.unit_amount, isFallback ? "GBP" : currency)}
              </span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                /{interval === "monthly" ? "month" : "year"}
              </span>
            </div>
            {isFallback && (
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Shown in GBP. {currency} pricing coming soon.
              </p>
            )}
            {interval === "annual" && price.unit_amount > 0 && (
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {formatPrice(
                  Math.round(price.unit_amount / 12),
                  isFallback ? "GBP" : currency
                )}
                /month billed annually
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
              Choose plan
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
              Sign up
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
