-- Seed default site settings
INSERT INTO public.site_settings (key, value)
VALUES
  ('smtp_host', '""'),
  ('smtp_port', '"587"'),
  ('smtp_user', '""'),
  ('smtp_pass', '""'),
  ('smtp_from', '""'),
  ('oauth_google_client_id', '""'),
  ('oauth_google_client_secret', '""'),
  ('oauth_facebook_app_id', '""'),
  ('oauth_facebook_app_secret', '""'),
  ('oauth_twitter_client_id', '""'),
  ('oauth_twitter_client_secret', '""'),
  ('oauth_linkedin_client_id', '""'),
  ('oauth_linkedin_client_secret', '""')
ON CONFLICT (key) DO NOTHING;
