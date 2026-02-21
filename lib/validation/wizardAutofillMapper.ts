import type { WizardAutoFillPayload } from "./wizardAutofillSchema";
import type { OnboardingUpdate } from "./onboarding";

/**
 * Maps validated auto-fill payload to onboarding schema format
 *
 * This function transforms the AI-extracted data structure into the format
 * expected by the onboarding wizard and database.
 *
 * @param payload - Validated auto-fill payload from AI extraction
 * @returns Partial onboarding update matching the wizard's expected structure
 *
 * @example
 * const aiData = validateAndNormaliseAutoFill(rawAIResponse);
 * if (aiData.success && aiData.data) {
 *   const wizardData = mapAutoFillToOnboarding(aiData.data);
 *   onChange(wizardData); // Update wizard state
 * }
 */
export function mapAutoFillToOnboarding(
  payload: WizardAutoFillPayload
): Partial<OnboardingUpdate> {
  const update: Partial<OnboardingUpdate> = {};

  // ──────────────────────────────────────────────
  // Brand Section Mapping
  // ──────────────────────────────────────────────
  if (payload.brand) {
    const { brand } = payload;

    // Business name
    if (brand.business_name) {
      update.business_name = brand.business_name;
    }

    // Use long_description if available, fallback to short_description
    if (brand.long_description) {
      update.business_description = brand.long_description;
    } else if (brand.short_description) {
      update.business_description = brand.short_description;
    }

    // Website URL
    if (brand.website) {
      update.website_url = brand.website;
    }

    // Content language
    if (brand.content_language) {
      update.content_language = brand.content_language;
    }

    // Article styles
    if (brand.article_styles && brand.article_styles.length > 0) {
      update.article_styles = brand.article_styles;
    }

    // Style reference links
    if (brand.style_reference_links && brand.style_reference_links.length > 0) {
      update.article_style_links = brand.style_reference_links.slice(0, 3); // Max 3
    }

    // Brand color (take first color as primary)
    if (brand.brand_colours && brand.brand_colours.length > 0) {
      update.brand_color_hex = brand.brand_colours[0];
    }

    // Logo guidance could be stored in additional_notes if there's no logo_url
    // For now, we'll skip since we don't have a logo file
  }

  // ──────────────────────────────────────────────
  // Goals Section Mapping
  // ──────────────────────────────────────────────
  if (payload.goals) {
    const { goals } = payload;

    // Combine primary and secondary goals
    const allGoals = [
      ...(goals.primary_goals || []),
      ...(goals.secondary_goals || []),
    ];

    if (allGoals.length > 0) {
      // Remove duplicates
      update.goals = Array.from(new Set(allGoals));
    }

    // Note: We don't have direct mappings for:
    // - target_platforms (could be stored in additional_notes)
    // - posting_frequency (mapped in plan section)
    // - kpis (could be stored in additional_notes)
  }

  // ──────────────────────────────────────────────
  // Plan Section Mapping
  // ──────────────────────────────────────────────
  if (payload.plan) {
    const { plan } = payload;

    // Suggested tier
    if (plan.suggested_tier) {
      update.selected_plan = plan.suggested_tier;
    }

    // Approvals workflow
    if (plan.approvals_workflow) {
      update.approval_preference = plan.approvals_workflow;
    }

    // Collaboration notes can go into additional_notes
    if (plan.collaboration_notes) {
      const existingNotes = update.additional_notes || "";
      update.additional_notes = existingNotes
        ? `${existingNotes}\n\nTeam notes: ${plan.collaboration_notes}`
        : `Team notes: ${plan.collaboration_notes}`;
    }
  }

  // ──────────────────────────────────────────────
  // Connect Section Mapping
  // ──────────────────────────────────────────────
  if (payload.connect) {
    const { connect } = payload;

    // Onboarding notes
    if (connect.onboarding_notes) {
      const existingNotes = update.additional_notes || "";
      update.additional_notes = existingNotes
        ? `${existingNotes}\n\nOnboarding: ${connect.onboarding_notes}`
        : `Onboarding: ${connect.onboarding_notes}`;
    }

    // Note: required_social_accounts could be used to pre-select
    // which social platforms to prompt connection for, but there's
    // no direct field in onboarding schema for this
  }

  return update;
}

/**
 * Merges auto-filled data with existing wizard state
 *
 * This function intelligently merges AI-extracted data with the user's
 * existing wizard progress, preserving user edits and only filling empty fields.
 *
 * @param existing - Current wizard state
 * @param autoFilled - Auto-filled data from AI
 * @param overwrite - If true, overwrites existing data. If false, only fills empty fields.
 * @returns Merged wizard state
 *
 * @example
 * const merged = mergeWithExistingState(
 *   currentWizardData,
 *   aiExtractedData,
 *   false // Don't overwrite user's existing edits
 * );
 */
export function mergeWithExistingState(
  existing: Partial<OnboardingUpdate>,
  autoFilled: Partial<OnboardingUpdate>,
  overwrite = false
): Partial<OnboardingUpdate> {
  const merged: Partial<OnboardingUpdate> = { ...existing };

  // Helper to merge field if empty or overwrite is enabled
  const mergeField = <K extends keyof OnboardingUpdate>(
    key: K,
    value: OnboardingUpdate[K]
  ) => {
    if (overwrite || !existing[key]) {
      merged[key] = value;
    }
  };

  // Merge each field from auto-filled data
  (Object.keys(autoFilled) as Array<keyof OnboardingUpdate>).forEach((key) => {
    const value = autoFilled[key];
    if (value !== undefined && value !== null) {
      mergeField(key, value);
    }
  });

  return merged;
}

/**
 * Extracts brand colors for color picker preview
 *
 * @param payload - Auto-fill payload
 * @returns Array of hex colors for preview
 */
export function extractBrandColors(
  payload: WizardAutoFillPayload
): string[] {
  return payload.brand?.brand_colours || [];
}

/**
 * Extracts social links for quick access
 *
 * @param payload - Auto-fill payload
 * @returns Object with social platform URLs
 */
export function extractSocialLinks(payload: WizardAutoFillPayload): Record<
  string,
  string
> {
  return payload.brand?.social_links || {};
}

/**
 * Generates a confidence report for display to user
 *
 * @param payload - Auto-fill payload with metadata
 * @returns Human-readable confidence summary
 */
export function generateConfidenceReport(
  payload: WizardAutoFillPayload
): {
  overall: "high" | "medium" | "low";
  details: Record<string, "high" | "medium" | "low">;
} {
  const confidence = payload.metadata?.confidence_by_section || {};

  // Calculate overall confidence (most conservative)
  const confidenceLevels = Object.values(confidence).filter(
    Boolean
  ) as Array<"high" | "medium" | "low">;

  let overall: "high" | "medium" | "low" = "high";

  if (confidenceLevels.includes("low")) {
    overall = "low";
  } else if (confidenceLevels.includes("medium")) {
    overall = "medium";
  }

  return {
    overall,
    details: {
      brand: confidence.brand || "medium",
      goals: confidence.goals || "medium",
      plan: confidence.plan || "medium",
      connect: confidence.connect || "medium",
    },
  };
}
