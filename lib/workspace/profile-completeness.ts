import type { OnboardingUpdate, Goal } from "@/lib/validation/onboarding";

export interface MissingItem {
  key: string;
  label: string;
  section: "brand" | "goals" | "plan" | "social";
  priority: "required" | "recommended";
}

export interface CompletenessResult {
  percentage: number;
  missing: MissingItem[];
  isComplete: boolean;
}

const TOTAL_WEIGHT = 7;

export function checkProfileCompleteness(
  data: OnboardingUpdate
): CompletenessResult {
  const missing: MissingItem[] = [];
  let filled = 0;

  // 1. Business name (required)
  if (data.business_name && data.business_name.trim().length >= 2) {
    filled++;
  } else {
    missing.push({
      key: "business_name",
      label: "Business name",
      section: "brand",
      priority: "required",
    });
  }

  // 2. Business description (required)
  if (data.business_description && data.business_description.trim().length >= 10) {
    filled++;
  } else {
    missing.push({
      key: "business_description",
      label: "Business description",
      section: "brand",
      priority: "required",
    });
  }

  // 3. Content language (has default, so almost always filled)
  if (data.content_language && data.content_language.trim().length > 0) {
    filled++;
  } else {
    missing.push({
      key: "content_language",
      label: "Content language",
      section: "brand",
      priority: "required",
    });
  }

  // 4. Goals (at least one)
  const goals = data.goals ?? [];
  if (goals.length > 0) {
    filled++;
  } else {
    missing.push({
      key: "goals",
      label: "At least one goal",
      section: "goals",
      priority: "required",
    });
  }

  // 5. Conditional goal URLs
  const typedGoals = goals as Goal[];
  const needsWebsite =
    typedGoals.includes("increase_website_traffic") ||
    typedGoals.includes("get_more_subscribers_leads");
  const needsProduct =
    typedGoals.includes("promote_product_or_service") ||
    typedGoals.includes("increase_sales");

  if (needsWebsite && !data.website_or_landing_url) {
    missing.push({
      key: "website_or_landing_url",
      label: "Website or landing page URL",
      section: "goals",
      priority: "required",
    });
  }
  if (needsProduct && !data.product_or_sales_url) {
    missing.push({
      key: "product_or_sales_url",
      label: "Product or sales URL",
      section: "goals",
      priority: "required",
    });
  }

  // 6. Plan selected (recommended)
  if (data.selected_plan) {
    filled++;
  } else {
    missing.push({
      key: "selected_plan",
      label: "Choose a plan",
      section: "plan",
      priority: "recommended",
    });
  }

  // 7. Social connections (recommended)
  if (data.socials_connected) {
    filled++;
  } else {
    missing.push({
      key: "socials_connected",
      label: "Connect social accounts",
      section: "social",
      priority: "recommended",
    });
  }

  // 8. Logo (recommended -- not counted in weight but shown)
  if (!data.logo_url) {
    missing.push({
      key: "logo_url",
      label: "Upload a logo",
      section: "brand",
      priority: "recommended",
    });
  }

  const percentage = Math.round((filled / TOTAL_WEIGHT) * 100);

  return {
    percentage,
    missing,
    isComplete: missing.filter((m) => m.priority === "required").length === 0,
  };
}

export function getSectionLabel(section: MissingItem["section"]): string {
  switch (section) {
    case "brand":
      return "profile.sections.brand";
    case "goals":
      return "profile.sections.goals";
    case "plan":
      return "profile.sections.plan";
    case "social":
      return "profile.sections.social";
  }
}
