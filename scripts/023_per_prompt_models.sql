-- 023: Add per-prompt model columns to wizard_autofill_settings
-- Previously a single openrouter_model was shared across all prompts.
-- Now each prompt type can specify its own model.
-- The existing openrouter_model column is kept as a legacy fallback.

ALTER TABLE public.wizard_autofill_settings
  ADD COLUMN IF NOT EXISTS website_model text,
  ADD COLUMN IF NOT EXISTS file_model text,
  ADD COLUMN IF NOT EXISTS social_profile_model text;

COMMENT ON COLUMN public.wizard_autofill_settings.website_model IS 'OpenRouter model for website investigation prompt';
COMMENT ON COLUMN public.wizard_autofill_settings.file_model IS 'OpenRouter model for file investigation prompt';
COMMENT ON COLUMN public.wizard_autofill_settings.social_profile_model IS 'OpenRouter model for social profile investigation prompt';
