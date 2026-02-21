# Wizard Auto-fill Setup Guide

Complete setup instructions for the wizard auto-fill feature.

## Prerequisites

- Supabase project connected
- Node.js 18+ and npm/pnpm
- OPENROUTER_API_KEY environment variable (for AI analysis step)

## Step 1: Install Dependencies

The file parsing feature requires two npm packages:

```bash
npm install pdf-parse mammoth
npm install -D @types/pdf-parse
```

Or with pnpm:

```bash
pnpm add pdf-parse mammoth
pnpm add -D @types/pdf-parse
```

### Package Details

- **pdf-parse** (v1.1.1+): Extracts text from PDF files
- **mammoth** (v1.6.0+): Extracts text from DOC/DOCX files
- **@types/pdf-parse**: TypeScript types for pdf-parse

## Step 2: Run Database Migration

Execute the migration to create tables, RLS policies, and storage bucket:

```bash
# Connect to your Supabase project SQL editor
# Copy and paste the contents of scripts/006_wizard_autofill_feature.sql
# Execute the migration
```

Or use Supabase CLI:

```bash
supabase db push
```

### What the Migration Creates

1. **Tables:**
   - `wizard_autofill_settings` - Admin prompt configuration
   - `wizard_autofill_audit` - Analysis audit logs
   - Enhanced `onboarding_profiles` with auto-fill metadata

2. **Storage Bucket:**
   - `wizard-uploads` (private, 10MB limit)

3. **RLS Policies:**
   - User-scoped file access
   - Admin-only settings access
   - Audit log policies

4. **Helper Functions:**
   - `get_wizard_autofill_settings()`
   - `log_wizard_autofill()`

## Step 3: Set Environment Variables

Add the OpenRouter API key to your environment:

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-...
```

Or set it in Vercel:

```bash
vercel env add OPENROUTER_API_KEY
```

### Environment Variable Details

- **OPENROUTER_API_KEY**: Your OpenRouter API key for AI analysis
- Get your key from: https://openrouter.ai/keys

## Step 4: Verify Storage Bucket

Check that the `wizard-uploads` bucket was created:

1. Go to Supabase Dashboard → Storage
2. Verify `wizard-uploads` bucket exists
3. Check that it's marked as "Private"
4. Verify RLS policies are enabled

### Manual Bucket Creation (if needed)

If the bucket wasn't created automatically:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wizard-uploads',
  'wizard-uploads',
  false,
  10485760,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);
```

## Step 5: Test File Upload

1. Navigate to `/onboarding` in your app
2. Go to Step 2 (Brand)
3. Upload a test PDF/DOC file
4. Verify success message appears
5. Check Supabase Storage for the uploaded file

### Test Files

Use these test scenarios:

- ✅ Valid PDF under 10MB
- ✅ Valid DOC/DOCX under 10MB
- ❌ File over 10MB (should be rejected)
- ❌ Unsupported file type (e.g., .txt, .jpg)

## Step 6: Configure OpenRouter Prompts

1. Log in as admin
2. Navigate to Admin → Settings → OpenRouter Prompts
3. Review and customize the default prompts
4. Save settings

### Default Prompts

The migration installs sensible default prompts, but you can customize them for your use case.

## Step 7: Test Website Analysis

1. Go to `/onboarding` Step 2
2. Enter a website URL (e.g., https://example.com)
3. Click "Auto-fill from website"
4. Verify the site is fetched and analyzed
5. Check that wizard fields are populated

## Testing Checklist

### File Upload
- [ ] PDF upload and parsing works
- [ ] DOC upload and parsing works
- [ ] DOCX upload and parsing works
- [ ] File size validation (reject > 10MB)
- [ ] File type validation (reject non-documents)
- [ ] Text extraction completes successfully
- [ ] Truncation notice for large files

### Website Analysis
- [ ] SSRF protection blocks private IPs
- [ ] Valid URLs are fetched
- [ ] Content extraction works
- [ ] Link prioritization works (about, pricing, etc.)
- [ ] Multiple pages are crawled
- [ ] Text is combined correctly

### Security
- [ ] User can only access own files
- [ ] Admin-only prompt access works
- [ ] RLS policies enforce boundaries
- [ ] File upload requires authentication
- [ ] No public bucket access

### UI/UX
- [ ] Loading states show correctly
- [ ] Success messages display
- [ ] Error messages are clear
- [ ] File selection works
- [ ] Unsaved changes warning (prompts page)

## Common Issues

### "Module not found: pdf-parse"

**Solution:** Install dependencies
```bash
npm install pdf-parse mammoth
```

### "Failed to upload file"

**Solution:** Check Supabase configuration
1. Verify bucket exists
2. Check RLS policies
3. Verify service role key is set
4. Check storage is enabled in project

### "Unauthorized" when uploading

**Solution:** User must be authenticated
- Ensure user is logged in
- Check auth session is valid
- Verify middleware is working

### "Text extraction failed"

**Solution:** Check file format
- Verify file is actually PDF/DOC/DOCX
- Try a different file
- Check file isn't corrupted or password-protected

### OpenRouter API errors

**Solution:** Check API key and configuration
- Verify OPENROUTER_API_KEY is set
- Check key has sufficient credits
- Verify model name in settings is valid

## Performance Considerations

### File Upload
- Uploads are streamed (no full file in memory)
- Text extraction happens server-side
- 10MB limit prevents abuse

### Website Crawling
- Limited to 5-8 pages max
- 10 second timeout per page
- 500KB per page limit
- Total 2MB limit across all pages

### OpenRouter API
- Uses streaming when possible
- Timeout protection (30s)
- Retry logic with exponential backoff
- Cost tracking in audit logs

## Monitoring

### Audit Logs

Check analysis activity:

```sql
SELECT 
  source_type,
  status,
  COUNT(*) as count,
  AVG(processing_time_ms) as avg_time
FROM wizard_autofill_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source_type, status;
```

### Storage Usage

Monitor storage usage:

```sql
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(size) as total_bytes,
  SUM(size) / 1024 / 1024 as total_mb
FROM storage.objects
WHERE bucket_id = 'wizard-uploads'
GROUP BY bucket_id;
```

### Error Rates

Track errors:

```sql
SELECT 
  error_message,
  COUNT(*) as occurrences
FROM wizard_autofill_audit
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY occurrences DESC
LIMIT 10;
```

## Next Steps

Once everything is working:

1. Monitor audit logs for issues
2. Customize prompts based on results
3. Add cleanup job for old files (optional)
4. Consider adding file analysis to admin panel
5. Add analytics for auto-fill success rates

## Support

If you encounter issues:

1. Check Supabase logs (Database → Logs)
2. Check browser console for errors
3. Review audit table for failed attempts
4. Verify all migration steps completed
5. Check environment variables are set

## Related Documentation

- [File Upload Documentation](./FILE_UPLOAD_WIZARD.md)
- [Site Fetcher Documentation](./SITE_FETCHER.md)
- [OpenRouter Client Documentation](./OPENROUTER_CLIENT.md)
- [Schema Guide](./WIZARD_AUTOFILL_SCHEMA_GUIDE.md)
- [Database Schema](./WIZARD_AUTOFILL_SCHEMA.md)
