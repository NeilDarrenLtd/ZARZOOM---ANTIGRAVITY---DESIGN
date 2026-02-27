-- ============================================================================
-- Migration 006: Remove active_plan_prices view (no longer needed)
--
-- The view was used to filter active prices, but this logic is now handled
-- directly in application code for better maintainability and control.
-- ============================================================================

BEGIN;

-- Drop the view that is no longer needed
DROP VIEW IF EXISTS public.active_plan_prices CASCADE;

COMMIT;
