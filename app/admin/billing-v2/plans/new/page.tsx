"use client";

import { useState } from "react";
import { createNewPlan } from "@/app/admin/billing/actions";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  AlertCircle,
  Info,
  Check,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { CURRENCIES } from "@/lib/billing/types";

interface PriceInput {
  currency: string;
  interval: string;
  amount_minor: number;
}

export default function NewPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [planKey, setPlanKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");
  const [prices, setPrices] = useState<PriceInput[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [maxAdsPerWeek, setMaxAdsPerWeek] = useState<number>(7);

  // Price form
  const [newPriceCurrency, setNewPriceCurrency] = useState("GBP");
  const [newPriceInterval, setNewPriceInterval] = useState("monthly");
  const [newPriceAmount, setNewPriceAmount] = useState("");

  // Validate plan_key format
  const isValidPlanKey = /^[a-z0-9_-]+$/.test(planKey);
  const planKeyError = planKey && !isValidPlanKey
    ? "Plan key must be lowercase alphanumeric with dashes or underscores only"
    : null;

  function addFeature() {
    if (featureInput.trim() && !features.includes(featureInput.trim())) {
      setFeatures([...features, featureInput.trim()]);
      setFeatureInput("");
    }
  }

  function removeFeature(index: number) {
    setFeatures(features.filter((_, i) => i !== index));
  }

  function addPrice() {
    const amountMinor = Math.round(parseFloat(newPriceAmount) * 100);

    if (isNaN(amountMinor) || amountMinor <= 0) {
      setError("Price must be a positive number");
      return;
    }

    // Check for duplicate
    const duplicate = prices.find(
      (p) => p.currency === newPriceCurrency && p.interval === newPriceInterval
    );

    if (duplicate) {
      setError(
        `Price for ${newPriceCurrency} ${newPriceInterval} already exists`
      );
      return;
    }

    setPrices([
      ...prices,
      {
        currency: newPriceCurrency,
        interval: newPriceInterval,
        amount_minor: amountMinor,
      },
    ]);

    setNewPriceAmount("");
    setError(null);
  }

  function removePrice(index: number) {
    setPrices(prices.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidPlanKey) {
      setError("Invalid plan key format");
      return;
    }

    if (prices.length === 0) {
      setError("At least one price is required");
      return;
    }

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("name", name);
    fd.set("slug", planKey);
    fd.set("description", description);
    fd.set("is_active", String(isActive));
    fd.set("display_order", String(sortOrder));
    fd.set("highlight", "false");
    fd.set("quota_policy", JSON.stringify({ posts_per_month: 100, social_profiles: 10 }));
    fd.set("features", JSON.stringify(features));
    fd.set("entitlements", JSON.stringify({ advanced_analytics: true, priority_support: true }));
    fd.set("prices", JSON.stringify(prices.map((p) => ({
      currency: p.currency,
      interval: p.interval,
      unitAmount: p.amount_minor,
    }))));

    const result = await createNewPlan(fd);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/admin/billing-v2");
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/admin/billing-v2"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to plans
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Plan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure pricing, features, and discount options
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Plan Key *
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    (lowercase, no spaces)
                  </span>
                </label>
                <input
                  type="text"
                  value={planKey}
                  onChange={(e) => setPlanKey(e.target.value.toLowerCase())}
                  placeholder="e.g. basic, pro, enterprise"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                />
                {planKeyError && (
                  <p className="mt-1 text-xs text-red-600">{planKeyError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  This is the unique identifier used in code and URLs
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Professional Plan"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this plan..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value))}
                    min="0"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Lower numbers appear first
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer mt-8">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active (visible to users)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Advertising Discount */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              Advertising Partnership Discount
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 leading-relaxed">
                Offer users a discount in exchange for allowing ZARZOOM to post
                promotional content on their social feeds.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Discount Percentage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) =>
                      setDiscountPercent(parseInt(e.target.value) || 0)
                    }
                    min="0"
                    max="50"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  0% = no discount offered
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Max Ads Per Week
                </label>
                <input
                  type="number"
                  value={maxAdsPerWeek}
                  onChange={(e) =>
                    setMaxAdsPerWeek(Math.min(7, parseInt(e.target.value) || 7))
                  }
                  min="1"
                  max="7"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum once per day (1-7)
                </p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pricing *
            </h2>

            {/* Add Price Form */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={newPriceCurrency}
                    onChange={(e) => setNewPriceCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Interval
                  </label>
                  <select
                    value={newPriceInterval}
                    onChange={(e) => setNewPriceInterval(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Price
                  </label>
                  <input
                    type="number"
                    value={newPriceAmount}
                    onChange={(e) => setNewPriceAmount(e.target.value)}
                    placeholder="9.99"
                    step="0.01"
                    min="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">In major units</p>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addPrice}
                    className="w-full bg-green-600 text-white font-medium py-2 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Prices List */}
            {prices.length > 0 ? (
              <div className="space-y-2">
                {prices.map((price, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {price.currency}
                      </span>
                      <span className="text-sm text-gray-600 capitalize">
                        {price.interval}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {(price.amount_minor / 100).toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePrice(index)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                At least one price is required
              </div>
            )}
          </div>

          {/* Features */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Features (Optional)
            </h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                placeholder="e.g. Up to 10 social profiles"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={addFeature}
                className="bg-green-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {features.length > 0 && (
              <div className="space-y-2">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5"
                  >
                    <span className="text-sm text-gray-700">{feature}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* i18n Warning */}
          <div className="border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 leading-relaxed">
                  <p className="font-semibold mb-1">i18n Copy Required</p>
                  <p>
                    After creating this plan, you must add translations to{" "}
                    <code className="bg-blue-100 px-1 rounded font-mono">
                      plans.{planKey || "[plan_key]"}.*
                    </code>{" "}
                    in your locale files for it to be visible to users.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <Link
              href="/admin/billing-v2"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !isValidPlanKey || prices.length === 0}
              className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Plan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
