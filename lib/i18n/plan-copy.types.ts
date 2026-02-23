/**
 * TypeScript types for plan copy i18n structure
 * 
 * These types ensure type-safe access to plan marketing copy
 * and help maintain consistency across translations.
 */

/**
 * Standard plan keys used in the system.
 * Extend this union type when adding new plans.
 */
export type PlanKey = 'basic' | 'pro' | 'advanced';

/**
 * Structure of plan copy in i18n files.
 * All fields must be present for a plan to be considered "complete".
 */
export interface I18nPlanCopy {
  /** Display name shown in UI (e.g., "Basic", "Pro", "Advanced") */
  displayName: string;
  
  /** Short tagline/subtitle (e.g., "Perfect for getting started") */
  shortTagline: string;
  
  /** Longer description explaining the plan's value proposition */
  description: string;
  
  /** Array of feature bullet points */
  bullets: string[];
  
  /** Optional CTA text (e.g., "Start Free Trial", "Contact Sales") */
  cta?: string;
}

/**
 * Complete plans section structure in i18n files.
 * 
 * @example JSON structure:
 * ```json
 * {
 *   "plans": {
 *     "basic": {
 *       "displayName": "Basic",
 *       "shortTagline": "Perfect for getting started",
 *       "description": "Essential features...",
 *       "bullets": ["Feature 1", "Feature 2"],
 *       "cta": "Start Free Trial"
 *     },
 *     "pro": { ... },
 *     "advanced": { ... }
 *   }
 * }
 * ```
 */
export interface I18nPlansSection {
  [planKey: string]: I18nPlanCopy;
}

/**
 * Props for components that display plan copy
 */
export interface PlanCopyProps {
  planKey: string;
  /** Optional override for display name */
  displayNameOverride?: string;
  /** Whether to show the CTA button */
  showCta?: boolean;
}
