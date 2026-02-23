/**
 * Plan Copy i18n Module
 * 
 * Centralized exports for plan marketing copy utilities.
 * Import from this file in your components.
 * 
 * @example
 * ```tsx
 * import { hasPlanCopy, getPlanCopy } from '@/lib/i18n/plan-copy.index';
 * import { useI18n } from '@/lib/i18n';
 * 
 * export function PlanCard({ planKey }: { planKey: string }) {
 *   const { t } = useI18n();
 *   
 *   if (!hasPlanCopy(planKey, t)) {
 *     return null; // Don't show plans without i18n copy
 *   }
 *   
 *   const copy = getPlanCopy(planKey, t);
 *   
 *   return (
 *     <div>
 *       <h3>{copy.displayName}</h3>
 *       <p>{copy.shortTagline}</p>
 *       <p>{copy.description}</p>
 *       <ul>
 *         {copy.bullets.map((bullet, i) => (
 *           <li key={i}>{bullet}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */

// Core utilities
export {
  hasPlanCopy,
  getPlanCopy,
  getAvailablePlanKeys,
  hasPlanCopyKey,
  getPlanCopyValue,
  type PlanCopy,
} from './plan-copy';

// TypeScript types
export type {
  PlanKey,
  I18nPlanCopy,
  I18nPlansSection,
  PlanCopyProps,
} from './plan-copy.types';
