/**
 * Plan Copy i18n Helpers
 * 
 * Utilities for accessing standardized plan marketing copy from i18n.
 * Plan copy is separate from pricing data - it contains display text only.
 * 
 * Structure (in locale JSON under billing.plans):
 * - billing.plans.{planKey}.displayName
 * - billing.plans.{planKey}.shortTagline
 * - billing.plans.{planKey}.description
 * - billing.plans.{planKey}.bullets[]
 * - billing.plans.{planKey}.cta (optional)
 * 
 * Rules:
 * - No numeric pricing in i18n
 * - Plan visible only if required keys exist
 */

/**
 * Translation function type (matches useI18n hook)
 */
type TranslateFn = (key: string, fallback?: string) => string;

/**
 * Plan copy structure
 */
export interface PlanCopy {
  displayName: string;
  shortTagline: string;
  description: string;
  bullets: string[];
  cta?: string;
}

/**
 * Required keys that must exist for a plan to be considered "complete"
 */
const REQUIRED_PLAN_KEYS = [
  'displayName',
  'shortTagline',
  'description',
  'bullets',
] as const;

/**
 * Check if complete plan copy exists for a given plan key.
 * 
 * A plan has complete copy if all required keys exist and have non-empty values.
 * This allows you to safely show/hide plans based on i18n availability.
 * 
 * @param planKey - The plan identifier (e.g., 'basic', 'pro', 'advanced')
 * @param t - Translation function from useI18n hook
 * @returns true if all required plan copy keys exist with non-empty values
 * 
 * @example
 * ```tsx
 * const { t } = useI18n();
 * 
 * // Only show plan if copy exists
 * if (hasPlanCopy('basic', t)) {
 *   return <PlanCard plan={plan} />;
 * }
 * 
 * // Filter plans to only those with i18n copy
 * const visiblePlans = plans.filter(p => hasPlanCopy(p.plan_key, t));
 * ```
 */
export function hasPlanCopy(planKey: string, t: TranslateFn): boolean {
  // Check each required key
  const prefix = `billing.plans.${planKey}`;
  for (const key of REQUIRED_PLAN_KEYS) {
    const fullKey = `${prefix}.${key}`;
    const value = t(fullKey, '');

    if (!value || value === fullKey) {
      return false;
    }

    if (key === 'bullets') {
      const firstBullet = t(`${prefix}.bullets.0`, '');
      if (!firstBullet || firstBullet === `${prefix}.bullets.0`) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get complete plan copy for a given plan key.
 * 
 * Returns a structured object with all plan marketing copy.
 * Throws error if required keys are missing - use hasPlanCopy() first to check.
 * 
 * @param planKey - The plan identifier (e.g., 'basic', 'pro', 'advanced')
 * @param t - Translation function from useI18n hook
 * @returns Complete plan copy object
 * @throws Error if required keys are missing
 * 
 * @example
 * ```tsx
 * const { t } = useI18n();
 * const copy = getPlanCopy('pro', t);
 * 
 * return (
 *   <div>
 *     <h2>{copy.displayName}</h2>
 *     <p>{copy.shortTagline}</p>
 *     <p>{copy.description}</p>
 *     <ul>
 *       {copy.bullets.map((bullet, i) => (
 *         <li key={i}>{bullet}</li>
 *       ))}
 *     </ul>
 *     {copy.cta && <button>{copy.cta}</button>}
 *   </div>
 * );
 * ```
 */
export function getPlanCopy(planKey: string, t: TranslateFn): PlanCopy {
  if (!hasPlanCopy(planKey, t)) {
    throw new Error(
      `Missing required plan copy for plan "${planKey}". ` +
      `Ensure all required keys exist: ${REQUIRED_PLAN_KEYS.join(', ')}`
    );
  }
  
  const prefix = `billing.plans.${planKey}`;
  const bullets: string[] = [];
  let bulletIndex = 0;
  while (true) {
    const bullet = t(`${prefix}.bullets.${bulletIndex}`, '');
    if (!bullet || bullet === `${prefix}.bullets.${bulletIndex}`) {
      break;
    }
    bullets.push(bullet);
    bulletIndex++;
  }

  const cta = t(`${prefix}.cta`, '');
  const ctaValue = cta && cta !== `${prefix}.cta` ? cta : undefined;

  return {
    displayName: t(`${prefix}.displayName`),
    shortTagline: t(`${prefix}.shortTagline`),
    description: t(`${prefix}.description`),
    bullets,
    cta: ctaValue,
  };
}

/**
 * Get all available plan keys that have complete i18n copy.
 * 
 * Useful for dynamically discovering which plans should be displayed
 * based on available translations, allowing you to add/remove plans
 * without code changes.
 * 
 * @param allPlanKeys - Array of all possible plan keys to check
 * @param t - Translation function from useI18n hook
 * @returns Array of plan keys that have complete copy
 * 
 * @example
 * ```tsx
 * const { t } = useI18n();
 * const dbPlans = await fetchPlans(); // from database
 * 
 * // Filter to only plans with i18n copy
 * const planKeys = dbPlans.map(p => p.plan_key);
 * const availableKeys = getAvailablePlanKeys(planKeys, t);
 * 
 * const visiblePlans = dbPlans.filter(p => 
 *   availableKeys.includes(p.plan_key)
 * );
 * ```
 */
export function getAvailablePlanKeys(
  allPlanKeys: string[],
  t: TranslateFn
): string[] {
  return allPlanKeys.filter(planKey => hasPlanCopy(planKey, t));
}

/**
 * Check if a specific plan copy key exists.
 * 
 * Lower-level utility for checking individual keys.
 * Most use cases should use hasPlanCopy() instead.
 * 
 * @param planKey - The plan identifier
 * @param copyKey - The specific copy key to check (e.g., 'displayName', 'cta')
 * @param t - Translation function
 * @returns true if the key exists and has a non-empty value
 */
export function hasPlanCopyKey(
  planKey: string,
  copyKey: string,
  t: TranslateFn
): boolean {
  const fullKey = `billing.plans.${planKey}.${copyKey}`;
  const value = t(fullKey, '');
  return !!value && value !== fullKey;
}

/**
 * Get a single plan copy value with fallback.
 * 
 * @param planKey - The plan identifier
 * @param copyKey - The specific copy key to get
 * @param t - Translation function
 * @param fallback - Fallback value if key doesn't exist
 * @returns The translation value or fallback
 * 
 * @example
 * ```tsx
 * const tagline = getPlanCopyValue('pro', 'shortTagline', t, 'Pro Plan');
 * ```
 */
export function getPlanCopyValue(
  planKey: string,
  copyKey: string,
  t: TranslateFn,
  fallback = ''
): string {
  const fullKey = `billing.plans.${planKey}.${copyKey}`;
  const value = t(fullKey, fallback);
  return value === fullKey ? fallback : value;
}
