/**
 * Onboarding API Validation Test Script
 *
 * Tests the Zod validation schemas directly (no HTTP calls needed).
 * Run with: npx tsx scripts/test-onboarding.ts
 */

import {
  onboardingUpdateSchema,
  onboardingCompleteSchema,
} from "../lib/validation/onboarding";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL: ${name}`);
    console.log(`        ${message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ──────────────────────────────────────────────
// Update schema tests
// ──────────────────────────────────────────────
console.log("\n--- onboardingUpdateSchema ---\n");

test("accepts empty object (all optional)", () => {
  const result = onboardingUpdateSchema.safeParse({});
  assert(result.success, "Should accept empty object");
});

test("accepts valid partial update", () => {
  const result = onboardingUpdateSchema.safeParse({
    business_name: "My Business",
    onboarding_step: 1,
  });
  assert(result.success, "Should accept valid partial");
});

test("rejects business_name shorter than 2 chars", () => {
  const result = onboardingUpdateSchema.safeParse({
    business_name: "A",
  });
  assert(!result.success, "Should reject short name");
});

test("rejects business_description shorter than 10 chars", () => {
  const result = onboardingUpdateSchema.safeParse({
    business_description: "Short",
  });
  assert(!result.success, "Should reject short description");
});

test("accepts valid description", () => {
  const result = onboardingUpdateSchema.safeParse({
    business_description: "This is a long enough business description for testing",
  });
  assert(result.success, "Should accept valid description");
});

test("rejects invalid website_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    website_url: "not-a-url",
  });
  assert(!result.success, "Should reject invalid URL");
});

test("accepts valid website_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    website_url: "https://example.com",
  });
  assert(result.success, "Should accept valid URL");
});

test("rejects invalid brand_color_hex", () => {
  const result = onboardingUpdateSchema.safeParse({
    brand_color_hex: "red",
  });
  assert(!result.success, "Should reject non-hex color");
});

test("accepts valid brand_color_hex", () => {
  const result = onboardingUpdateSchema.safeParse({
    brand_color_hex: "#FF5500",
  });
  assert(result.success, "Should accept valid hex");
});

test("rejects article_style_links with more than 3 items", () => {
  const result = onboardingUpdateSchema.safeParse({
    article_style_links: [
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
    ],
  });
  assert(!result.success, "Should reject >3 links");
});

test("accepts article_style_links with exactly 3 items", () => {
  const result = onboardingUpdateSchema.safeParse({
    article_style_links: [
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ],
  });
  assert(result.success, "Should accept 3 links");
});

test("rejects onboarding_step outside 1-5", () => {
  const r1 = onboardingUpdateSchema.safeParse({ onboarding_step: 0 });
  const r2 = onboardingUpdateSchema.safeParse({ onboarding_step: 6 });
  assert(!r1.success && !r2.success, "Should reject step out of range");
});

test("conditional: goals with increase_website_traffic requires website_or_landing_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["increase_website_traffic"],
  });
  assert(!result.success, "Should require website_or_landing_url");
  const issues = result.error?.issues || [];
  const hasUrlIssue = issues.some((i) =>
    i.path.includes("website_or_landing_url")
  );
  assert(hasUrlIssue, "Should have website_or_landing_url issue");
});

test("conditional: goals with increase_website_traffic passes with website_or_landing_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["increase_website_traffic"],
    website_or_landing_url: "https://example.com",
  });
  assert(result.success, "Should pass with URL provided");
});

test("conditional: goals with promote_product_or_service requires product_or_sales_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["promote_product_or_service"],
  });
  assert(!result.success, "Should require product_or_sales_url");
});

test("conditional: goals with promote_product_or_service passes with product_or_sales_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["promote_product_or_service"],
    product_or_sales_url: "https://shop.example.com",
  });
  assert(result.success, "Should pass with URL provided");
});

test("conditional: goals with increase_sales requires product_or_sales_url", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["increase_sales"],
  });
  assert(!result.success, "Should require product_or_sales_url");
});

test("conditional: combined goals require both URLs", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["increase_website_traffic", "increase_sales"],
  });
  assert(!result.success, "Should require both URLs");
  const issues = result.error?.issues || [];
  assert(issues.length >= 2, "Should have at least 2 issues");
});

test("conditional: combined goals pass with both URLs", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["increase_website_traffic", "increase_sales"],
    website_or_landing_url: "https://example.com",
    product_or_sales_url: "https://shop.example.com",
  });
  assert(result.success, "Should pass with both URLs");
});

test("rejects invalid goal enum value", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["invalid_goal"],
  });
  assert(!result.success, "Should reject invalid goal");
});

test("accepts valid plan values", () => {
  for (const plan of ["basic", "pro", "scale"]) {
    const result = onboardingUpdateSchema.safeParse({ selected_plan: plan });
    assert(result.success, `Should accept plan: ${plan}`);
  }
});

test("rejects invalid plan value", () => {
  const result = onboardingUpdateSchema.safeParse({
    selected_plan: "enterprise",
  });
  assert(!result.success, "Should reject invalid plan");
});

// ──────────────────────────────────────────────
// Completion schema tests
// ──────────────────────────────────────────────
console.log("\n--- onboardingCompleteSchema ---\n");

test("rejects when missing required fields", () => {
  const result = onboardingCompleteSchema.safeParse({});
  assert(!result.success, "Should reject empty");
});

test("accepts minimum valid completion", () => {
  const result = onboardingCompleteSchema.safeParse({
    business_name: "My Business",
    business_description: "This is a valid business description",
    content_language: "en",
    goals: ["build_brand_authority"],
  });
  assert(result.success, "Should accept valid completion");
});

test("rejects completion with traffic goal but no website URL", () => {
  const result = onboardingCompleteSchema.safeParse({
    business_name: "My Business",
    business_description: "This is a valid business description",
    content_language: "en",
    goals: ["increase_website_traffic"],
  });
  assert(!result.success, "Should reject without URL for traffic goal");
});

test("accepts completion with traffic goal and website URL", () => {
  const result = onboardingCompleteSchema.safeParse({
    business_name: "My Business",
    business_description: "This is a valid business description",
    content_language: "en",
    goals: ["increase_website_traffic"],
    website_or_landing_url: "https://example.com",
  });
  assert(result.success, "Should accept with URL");
});

test("accepts full valid profile for completion", () => {
  const result = onboardingCompleteSchema.safeParse({
    business_name: "ZARZOOM Inc",
    business_description:
      "A content automation platform for businesses worldwide",
    content_language: "en",
    goals: [
      "increase_website_traffic",
      "promote_product_or_service",
      "build_brand_authority",
    ],
    website_or_landing_url: "https://zarzoom.com",
    product_or_sales_url: "https://zarzoom.com/pricing",
  });
  assert(result.success, "Should accept full valid profile");
});

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`============================\n`);

if (failed > 0) {
  process.exit(1);
}
