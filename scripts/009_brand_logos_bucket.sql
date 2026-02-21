-- ============================================================
-- 009: Create brand-logos storage bucket for onboarding logo uploads
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-logos',
  'brand-logos',
  true,
  2097152,  -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload own brand logos" ON storage.objects;
CREATE POLICY "Users can upload own brand logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own logos
DROP POLICY IF EXISTS "Users can update own brand logos" ON storage.objects;
CREATE POLICY "Users can update own brand logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read brand logos (public bucket)
DROP POLICY IF EXISTS "Public read access for brand logos" ON storage.objects;
CREATE POLICY "Public read access for brand logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'brand-logos');
