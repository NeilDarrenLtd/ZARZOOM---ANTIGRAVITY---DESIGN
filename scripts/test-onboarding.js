/**
 * Onboarding API Validation Test Script (JS)
 *
 * Tests the Zod validation schemas directly.
 */

import { z } from "zod";

// ── Inline schema definitions (mirrors lib/validation/onboarding.ts) ──

const GOAL_OPTIONS = [
  "increase_website_traffic",
  "get_more_subscribers_leads",
  "promote_product_or_service",
  "increase_sales",
  "build_brand_authority",
  "improve_seo",
  "educate_audience",
  "generate_social_content",
];

const PLAN_OPTIONS = ["basic", "pro", "scale"];
const APPROVAL_OPTIONS = ["auto", "manual"];

const urlField = z.string().url("Must be a valid URL");

const hexColorField = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
  .nullable()
  .optional();

const onboardingUpdateSchema = z
  .object({
    onboarding_step: z.number().int().min(1).max(5).nullable().optional(),
    business_name: z.string().min(2).optional(),
    website_url: urlField.nullable().optional(),
    business_description: z.string().min(10).optional(),
    content_language: z.string().min(1).optional(),
    auto_publish: z.boolean().optional(),
    article_styles: z.array(z.string()).nullable().optional(),
    article_style_links: z.array(urlField).max(3).nullable().optional(),
    brand_color_hex: hexColorField,
    logo_url: urlField.nullable().optional(),
    goals: z.array(z.enum(GOAL_OPTIONS)).optional(),
    website_or_landing_url: urlField.nullable().optional(),
    product_or_sales_url: urlField.nullable().optional(),
    selected_plan: z.enum(PLAN_OPTIONS).nullable().optional(),
    discount_opt_in: z.boolean().optional(),
    approval_preference: z.enum(APPROVAL_OPTIONS).optional(),
    uploadpost_profile_username: z.string().nullable().optional(),
    socials_connected: z.boolean().optional(),
    additional_notes: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const needsWebsite =
      data.goals?.includes("increase_website_traffic") ||
      data.goals?.includes("get_more_subscribers_leads");
    if (needsWebsite && !data.website_or_landing_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Website or landing URL is required",
        path: ["website_or_landing_url"],
      });
    }
    const needsProduct =
      data.goals?.includes("promote_product_or_service") ||
      data.goals?.includes("increase_sales");
    if (needsProduct && !data.product_or_sales_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product or sales URL is required",
        path: ["product_or_sales_url"],
      });
    }
  });

const onboardingCompleteSchema = z
  .object({
    business_name: z.string().min(2),
    business_description: z.string().min(10),
    content_language: z.string().min(1),
    goals: z.array(z.enum(GOAL_OPTIONS)).min(1),
    website_or_landing_url: urlField.nullable().optional(),
    product_or_sales_url: urlField.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const needsWebsite =
      data.goals.includes("increase_website_traffic") ||
      data.goals.includes("get_more_subscribers_leads");
    if (needsWebsite && !data.website_or_landing_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Website or landing URL is required",
        path: ["website_or_landing_url"],
      });
    }
    const needsProduct =
      data.goals.includes("promote_product_or_service") ||
      data.goals.includes("increase_sales");
    if (needsProduct && !data.product_or_sales_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product or sales URL is required",
        path: ["product_or_sales_url"],
      });
    }
  });

// ── Test runner ──

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message || err}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Update schema tests ──
console.log("\n--- onboardingUpdateSchema ---\n");

test("accepts empty object (all optional)", () => {
  assert(onboardingUpdateSchema.safeParse({}).success, "Should accept empty object");
});

test("accepts valid partial update", () => {
  assert(
    onboardingUpdateSchema.safeParse({ business_name: "My Business", onboarding_step: 1 }).success,
    "Should accept valid partial"
  );
});

test("rejects business_name shorter than 2 chars", () => {
  assert(!onboardingUpdateSchema.safeParse({ business_name: "A" }).success, "Should reject");
});

test("rejects business_description shorter than 10 chars", () => {
  assert(!onboardingUpdateSchema.safeParse({ business_description: "Short" }).success, "Should reject");
});

test("accepts valid description", () => {
  assert(
    onboardingUpdateSchema.safeParse({ business_description: "This is a valid long description" }).success,
    "Should accept"
  );
});

test("rejects invalid website_url", () => {
  assert(!onboardingUpdateSchema.safeParse({ website_url: "not-a-url" }).success, "Should reject");
});

test("accepts valid website_url", () => {
  assert(onboardingUpdateSchema.safeParse({ website_url: "https://example.com" }).success, "Should accept");
});

test("rejects invalid brand_color_hex", () => {
  assert(!onboardingUpdateSchema.safeParse({ brand_color_hex: "red" }).success, "Should reject");
});

test("accepts valid brand_color_hex", () => {
  assert(onboardingUpdateSchema.safeParse({ brand_color_hex: "#FF5500" }).success, "Should accept");
});

test("rejects article_style_links with more than 3 items", () => {
  assert(
    !onboardingUpdateSchema.safeParse({
      article_style_links: ["https://a.com", "https://b.com", "https://c.com", "https://d.com"],
    }).success,
    "Should reject >3 links"
  );
});

test("accepts article_style_links with exactly 3 items", () => {
  assert(
    onboardingUpdateSchema.safeParse({
      article_style_links: ["https://a.com", "https://b.com", "https://c.com"],
    }).success,
    "Should accept 3 links"
  );
});

test("rejects onboarding_step outside 1-5", () => {
  assert(
    !onboardingUpdateSchema.safeParse({ onboarding_step: 0 }).success &&
      !onboardingUpdateSchema.safeParse({ onboarding_step: 6 }).success,
    "Should reject out of range"
  );
});

test("conditional: traffic goal requires website_or_landing_url", () => {
  const result = onboardingUpdateSchema.safeParse({ goals: ["increase_website_traffic"] });
  assert(!result.success, "Should require URL");
  assert(
    result.error.issues.some((i) => i.path.includes("website_or_landing_url")),
    "Should have URL issue"
  );
});

test("conditional: traffic goal passes with website_or_landing_url", () => {
  assert(
    onboardingUpdateSchema.safeParse({
      goals: ["increase_website_traffic"],
      website_or_landing_url: "https://example.com",
    }).success,
    "Should pass"
  );
});

test("conditional: promote goal requires product_or_sales_url", () => {
  assert(
    !onboardingUpdateSchema.safeParse({ goals: ["promote_product_or_service"] }).success,
    "Should require URL"
  );
});

test("conditional: promote goal passes with product_or_sales_url", () => {
  assert(
    onboardingUpdateSchema.safeParse({
      goals: ["promote_product_or_service"],
      product_or_sales_url: "https://shop.example.com",
    }).success,
    "Should pass"
  );
});

test("conditional: increase_sales requires product_or_sales_url", () => {
  assert(!onboardingUpdateSchema.safeParse({ goals: ["increase_sales"] }).success, "Should require URL");
});

test("conditional: combined goals require both URLs", () => {
  const result = onboardingUpdateSchema.safeParse({
    goals: ["increase_website_traffic", "increase_sales"],
  });
  assert(!result.success, "Should require both");
  assert(result.error.issues.length >= 2, "Should have >= 2 issues");
});

test("conditional: combined goals pass with both URLs", () => {
  assert(
    onboardingUpdateSchema.safeParse({
      goals: ["increase_website_traffic", "increase_sales"],
      website_or_landing_url: "https://example.com",
      product_or_sales_url: "https://shop.example.com",
    }).success,
    "Should pass"
  );
});

test("rejects invalid goal enum value", () => {
  assert(!onboardingUpdateSchema.safeParse({ goals: ["invalid_goal"] }).success, "Should reject");
});

test("accepts valid plan values", () => {
  for (const plan of ["basic", "pro", "scale"]) {
    assert(onboardingUpdateSchema.safeParse({ selected_plan: plan }).success, `Should accept: ${plan}`);
  }
});

test("rejects invalid plan value", () => {
  assert(!onboardingUpdateSchema.safeParse({ selected_plan: "enterprise" }).success, "Should reject");
});

// ── Completion schema tests ──
console.log("\n--- onboardingCompleteSchema ---\n");

test("rejects when missing required fields", () => {
  assert(!onboardingCompleteSchema.safeParse({}).success, "Should reject empty");
});

test("accepts minimum valid completion", () => {
  assert(
    onboardingCompleteSchema.safeParse({
      business_name: "My Business",
      business_description: "This is a valid business description",
      content_language: "en",
      goals: ["build_brand_authority"],
    }).success,
    "Should accept"
  );
});

test("rejects completion with traffic goal but no website URL", () => {
  assert(
    !onboardingCompleteSchema.safeParse({
      business_name: "My Business",
      business_description: "This is a valid business description",
      content_language: "en",
      goals: ["increase_website_traffic"],
    }).success,
    "Should reject"
  );
});

test("accepts completion with traffic goal and website URL", () => {
  assert(
    onboardingCompleteSchema.safeParse({
      business_name: "My Business",
      business_description: "This is a valid business description",
      content_language: "en",
      goals: ["increase_website_traffic"],
      website_or_landing_url: "https://example.com",
    }).success,
    "Should accept"
  );
});

test("accepts full valid profile for completion", () => {
  assert(
    onboardingCompleteSchema.safeParse({
      business_name: "ZARZOOM Inc",
      business_description: "A content automation platform for businesses worldwide",
      content_language: "en",
      goals: ["increase_website_traffic", "promote_product_or_service", "build_brand_authority"],
      website_or_landing_url: "https://zarzoom.com",
      product_or_sales_url: "https://zarzoom.com/pricing",
    }).success,
    "Should accept"
  );
});

// ── Summary ──
console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`============================\n`);

if (failed > 0) process.exit(1);
