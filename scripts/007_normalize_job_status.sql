-- ============================================================
-- Migration 007: Normalise job status "succeeded" → "completed"
-- ============================================================
-- Idempotent -- safe to run multiple times.
--
-- 1. Migrate existing rows
-- 2. Drop the old CHECK constraint (if it exists)
-- 3. Add the canonical CHECK constraint
-- ============================================================

-- Step 1: Back-fill any rows still using the legacy "succeeded" value.
UPDATE jobs
SET    status     = 'completed',
       updated_at = now()
WHERE  status = 'succeeded';

-- Step 2: Drop legacy CHECK constraint.
-- The constraint name may vary; try both common conventions.
DO $$
BEGIN
  -- Try the most common auto-generated name first
  ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL; -- constraint does not exist, that's fine
END $$;

-- Step 3: Add the canonical CHECK constraint with the new status set.
-- "completed" replaces "succeeded"; "scheduled" is also now valid.
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN (
    'pending',
    'scheduled',
    'running',
    'completed',
    'failed',
    'cancelled'
  ));
