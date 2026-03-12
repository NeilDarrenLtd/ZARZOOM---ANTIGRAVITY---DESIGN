-- Add social_profile_prompt column to wizard_autofill_settings
ALTER TABLE wizard_autofill_settings
  ADD COLUMN IF NOT EXISTS social_profile_prompt text;
