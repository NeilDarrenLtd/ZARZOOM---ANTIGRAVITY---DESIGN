# Wizard Auto-fill Database Schema

This document describes the database schema and RLS (Row Level Security) policies for the wizard auto-fill feature.

## Migration File

**Location:** `scripts/006_wizard_autofill_feature.sql`

**Dependencies:**
- `scripts/001_create_schema.sql` - Creates `profiles` table with `is_admin` column
- `scripts/003_fix_rls_recursion.sql` - Creates `is_admin()` security definer function
- `scripts/001_create_onboarding_profiles.sql` - Creates `onboarding_profiles` table

## Database Tables

### 1. `wizard_autofill_settings`

Admin-configurable settings for OpenRouter prompt templates and feature flags.

**Purpose:** Singleton table (only 1 row) storing admin-controlled configuration for wizard auto-fill.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `website_prompt_text` | text | NO | (default prompt) | OpenRouter prompt for website analysis |
| `file_prompt_text` | text | NO | (default prompt) | OpenRouter prompt for file analysis |
| `website_autofill_enabled` | boolean | NO | true | Feature flag for website auto-fill |
| `file_autofill_enabled` | boolean | NO | true | Feature flag for file auto-fill |
| `openrouter_model` | text | NO | 'openai/gpt-4o-mini' | OpenRouter model identifier |
| `max_tokens` | integer | NO | 1500 | Max tokens for OpenRouter response |
| `temperature` | numeric(3,2) | NO | 0.7 | Temperature for OpenRouter sampling |
| `updated_by` | uuid | YES | NULL | References auth.users(id), tracks who last updated |
| `updated_at` | timestamptz | NO | now() | Auto-updated on UPDATE |
| `created_at` | timestamptz | NO | now() | Row creation timestamp |

**Constraints:**
- Unique index on `(true)` ensures only one row exists (singleton pattern)
- Foreign key: `updated_by` → `auth.users(id)` ON DELETE SET NULL

**Indexes:**
- `wizard_autofill_settings_singleton` - UNIQUE on `(true)`

**RLS Policies:**

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| `wizard_autofill_settings_admin_select` | SELECT | `public.is_admin(auth.uid())` |
| `wizard_autofill_settings_admin_insert` | INSERT | `public.is_admin(auth.uid())` |
| `wizard_autofill_settings_admin_update` | UPDATE | `public.is_admin(auth.uid())` |

**Access Pattern:**
- ✅ **Admins:** Full read/write access
- ❌ **Users:** No access (API routes will fetch settings server-side)

---

### 2. `wizard_autofill_audit`

Audit log for all wizard auto-fill analysis operations (website and file).

**Purpose:** Track every auto-fill attempt for debugging, analytics, and compliance.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `user_id` | uuid | NO | - | References auth.users(id), who ran the analysis |
| `source_type` | text | NO | - | 'website' or 'file' |
| `source_value` | text | NO | - | URL (if website) or filename (if file) |
| `status` | text | NO | - | 'success', 'partial', or 'error' |
| `extracted_fields` | jsonb | YES | NULL | Raw extracted data as JSON |
| `fields_filled` | text[] | YES | NULL | Array of field names that were filled |
| `error_message` | text | YES | NULL | Human-readable error message |
| `error_code` | text | YES | NULL | Machine-readable error code |
| `openrouter_model` | text | YES | NULL | Model used for this analysis |
| `tokens_used` | integer | YES | NULL | Total tokens consumed |
| `processing_time_ms` | integer | YES | NULL | Processing duration in milliseconds |
| `file_size_bytes` | integer | YES | NULL | File size (if source_type='file') |
| `file_mime_type` | text | YES | NULL | File MIME type (if source_type='file') |
| `file_storage_path` | text | YES | NULL | Path in Supabase Storage |
| `created_at` | timestamptz | NO | now() | When analysis was performed |

**Constraints:**
- `CHECK (source_type IN ('website', 'file'))`
- `CHECK (status IN ('success', 'partial', 'error'))`
- Foreign key: `user_id` → `auth.users(id)` ON DELETE CASCADE

**Indexes:**
- `wizard_autofill_audit_user_id_idx` on `user_id`
- `wizard_autofill_audit_created_at_idx` on `created_at DESC`
- `wizard_autofill_audit_source_type_idx` on `source_type`
- `wizard_autofill_audit_status_idx` on `status`

**RLS Policies:**

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| `wizard_autofill_audit_select_own` | SELECT | `auth.uid() = user_id` |
| `wizard_autofill_audit_insert_own` | INSERT | `auth.uid() = user_id` |
| `wizard_autofill_audit_admin_select` | SELECT | `public.is_admin(auth.uid())` |

**Access Pattern:**
- ✅ **Users:** Can read and create their own audit logs
- ✅ **Admins:** Can read all audit logs (analytics, support)
- ❌ **Users:** Cannot read other users' audit logs

---

### 3. `onboarding_profiles` (Enhanced)

Existing table with new columns added to track auto-fill metadata.

**New Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `autofilled_from_source` | text | YES | NULL | 'website' or 'file' (which source was used) |
| `autofill_source_value` | text | YES | NULL | URL or filename that was analyzed |
| `autofill_performed_at` | timestamptz | YES | NULL | When auto-fill was performed |
| `autofill_fields_filled` | text[] | YES | NULL | Array of field names that were auto-filled |
| `autofill_audit_id` | uuid | YES | NULL | References wizard_autofill_audit(id) |

**Constraints:**
- `CHECK (autofilled_from_source IS NULL OR autofilled_from_source IN ('website', 'file'))`
- Foreign key: `autofill_audit_id` → `wizard_autofill_audit(id)` ON DELETE SET NULL

**New Indexes:**
- `onboarding_profiles_autofilled_idx` on `autofilled_from_source` (partial index, WHERE NOT NULL)
- `onboarding_profiles_autofill_audit_id_idx` on `autofill_audit_id` (partial index, WHERE NOT NULL)

**RLS Policies:** (Unchanged from original)
- Users can only read/write their own row
- Service role has full access

---

## Supabase Storage

### Bucket: `wizard-uploads`

**Configuration:**
- **ID:** `wizard-uploads`
- **Public:** `false` (PRIVATE bucket)
- **Max File Size:** 10MB (10,485,760 bytes)
- **Allowed MIME Types:**
  - `application/pdf`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Folder Structure:**
```
wizard-uploads/
└── {user_id}/
    ├── {uuid}_document.pdf
    ├── {uuid}_brandguide.docx
    └── ...
```

**RLS Policies on `storage.objects`:**

| Policy Name | Operation | Rule | Description |
|-------------|-----------|------|-------------|
| `wizard_uploads_user_insert` | INSERT | `bucket_id = 'wizard-uploads' AND auth.uid()::text = (storage.foldername(name))[1]` | Users can upload to their own folder |
| `wizard_uploads_user_select` | SELECT | `bucket_id = 'wizard-uploads' AND auth.uid()::text = (storage.foldername(name))[1]` | Users can read their own files |
| `wizard_uploads_user_delete` | DELETE | `bucket_id = 'wizard-uploads' AND auth.uid()::text = (storage.foldername(name))[1]` | Users can delete their own files |
| `wizard_uploads_admin_select` | SELECT | `bucket_id = 'wizard-uploads' AND public.is_admin(auth.uid())` | Admins can read all files |

**Access Pattern:**
- ✅ **Users:** Full control over their own folder (`{user_id}/`)
- ✅ **Admins:** Read access to all files (for support/debugging)
- ❌ **Users:** Cannot access other users' folders

---

## Database Functions

### 1. `public.get_wizard_autofill_settings()`

**Purpose:** Bypass RLS to fetch wizard auto-fill settings for API routes.

**Signature:**
```sql
RETURNS TABLE (
  website_prompt TEXT,
  file_prompt TEXT,
  website_enabled BOOLEAN,
  file_enabled BOOLEAN,
  model TEXT,
  max_tokens INTEGER,
  temperature NUMERIC
)
```

**Security:** `SECURITY DEFINER` - Runs with elevated privileges, bypasses RLS

**Usage:**
```sql
SELECT * FROM public.get_wizard_autofill_settings();
```

**Grants:** `GRANT EXECUTE TO authenticated`

---

### 2. `public.log_wizard_autofill(...)`

**Purpose:** Log a wizard auto-fill attempt with all metadata.

**Signature:**
```sql
RETURNS UUID
PARAMETERS:
  p_user_id UUID,
  p_source_type TEXT,
  p_source_value TEXT,
  p_status TEXT,
  p_extracted_fields JSONB DEFAULT NULL,
  p_fields_filled TEXT[] DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_openrouter_model TEXT DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_processing_time_ms INTEGER DEFAULT NULL,
  p_file_size_bytes INTEGER DEFAULT NULL,
  p_file_mime_type TEXT DEFAULT NULL,
  p_file_storage_path TEXT DEFAULT NULL
```

**Returns:** UUID of created audit log entry (`wizard_autofill_audit.id`)

**Security:** `SECURITY DEFINER` - Bypasses RLS to insert audit log

**Usage:**
```typescript
const { data: auditId } = await supabase.rpc('log_wizard_autofill', {
  p_user_id: user.id,
  p_source_type: 'website',
  p_source_value: 'https://example.com',
  p_status: 'success',
  p_fields_filled: ['business_name', 'business_description']
});
```

**Grants:** `GRANT EXECUTE TO authenticated`

---

## Admin Role Enforcement

The wizard auto-fill schema uses the existing `public.is_admin()` function for role-based access control.

### `public.is_admin(check_user_id UUID)`

**Defined in:** `scripts/003_fix_rls_recursion.sql`

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND is_admin = true
  );
END;
$$;
```

**Why Security Definer?**
- Runs with elevated privileges to bypass RLS
- Prevents infinite recursion when checking admin status in RLS policies

**Admin Detection:**
1. Checks `profiles.is_admin` boolean field
2. Can also check `auth.users.user_metadata.is_admin` (JWT claim)

**Setting Admin Status:**
```sql
-- Via profiles table
UPDATE public.profiles SET is_admin = true WHERE id = '{user_id}';

-- Via auth metadata (on signup)
INSERT INTO auth.users (email, raw_user_meta_data)
VALUES ('admin@example.com', '{"is_admin": true}');
```

---

## Security Summary

### User Permissions

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `wizard_autofill_settings` | ❌ Admin only | ❌ Admin only | ❌ Admin only | ❌ Not allowed |
| `wizard_autofill_audit` | ✅ Own rows | ✅ Own rows | ❌ Not allowed | ❌ Not allowed |
| `onboarding_profiles` (autofill columns) | ✅ Own row | ✅ Own row | ✅ Own row | ❌ Not allowed |

### Admin Permissions

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `wizard_autofill_settings` | ✅ All rows | ✅ Allowed | ✅ All rows | ❌ Not allowed |
| `wizard_autofill_audit` | ✅ All rows | ❌ Not needed | ❌ Not allowed | ❌ Not allowed |
| `onboarding_profiles` (autofill columns) | ✅ All rows | ❌ Not needed | ✅ All rows | ❌ Not needed |

### Storage Permissions (wizard-uploads bucket)

| Operation | User | Admin |
|-----------|------|-------|
| Upload | ✅ Own folder only | ❌ Not needed |
| Read | ✅ Own folder only | ✅ All folders |
| Delete | ✅ Own folder only | ❌ Not needed |

---

## TypeScript Types

**Location:** `lib/types/wizard-autofill.ts`

Key types exported:
- `WizardAutofillSettings` - Settings table row
- `WizardAutofillAudit` - Audit log table row
- `OnboardingProfileAutofillMetadata` - Auto-fill metadata columns
- `AutofillSourceType` - 'website' | 'file'
- `AutofillStatus` - 'success' | 'partial' | 'error'
- `ExtractedBrandData` - Parsed OpenRouter response
- `AutofillAnalysisResponse` - API response structure

---

## Migration Execution

### Step 1: Run the Migration

```bash
# Via Supabase CLI
supabase db reset --db-url "$SUPABASE_URL"

# Or via SQL Editor in Supabase Dashboard
# Copy/paste scripts/006_wizard_autofill_feature.sql
```

### Step 2: Verify Migration

```sql
-- Check settings table exists with default row
SELECT * FROM public.wizard_autofill_settings;

-- Check audit table exists
SELECT COUNT(*) FROM public.wizard_autofill_audit;

-- Check new columns on onboarding_profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'onboarding_profiles'
  AND column_name LIKE 'autofill%';

-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'wizard-uploads';

-- Check storage policies exist
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE 'wizard_uploads%';
```

### Step 3: Test Permissions

```sql
-- As regular user (should succeed)
SET ROLE authenticated;
SET request.jwt.claims.sub TO '{user_id}';

SELECT * FROM public.wizard_autofill_audit WHERE user_id = '{user_id}';

-- As regular user (should fail - no access to settings)
SELECT * FROM public.wizard_autofill_settings; -- Should return empty

-- As admin user (should succeed)
SET ROLE authenticated;
SET request.jwt.claims.sub TO '{admin_user_id}';

SELECT * FROM public.wizard_autofill_settings; -- Should return settings
SELECT * FROM public.wizard_autofill_audit; -- Should return all audit logs
```

---

## Next Steps

With the database schema in place, you can now implement:

1. **API Routes:**
   - `POST /api/v1/onboarding/autofill/website` - Analyze website
   - `POST /api/v1/onboarding/autofill/file` - Upload and analyze file
   - `GET /api/v1/admin/wizard-autofill/settings` - Get settings (admin)
   - `PUT /api/v1/admin/wizard-autofill/settings` - Update settings (admin)
   - `GET /api/v1/admin/wizard-autofill/audit` - Get audit logs (admin)

2. **Frontend Components:**
   - File upload UI with validation
   - Website URL input with "Auto-fill" button
   - Status indicators (loading, success, partial, error)
   - Admin settings page for prompt configuration

3. **OpenRouter Integration:**
   - Fetch prompts from `wizard_autofill_settings`
   - Send website/file content to OpenRouter
   - Parse JSON response and map to onboarding fields
   - Log to `wizard_autofill_audit`

---

## Troubleshooting

### Issue: "Row-level security policy violation"

**Cause:** User trying to access data they don't have permission for.

**Solution:** Verify RLS policies are correctly applied:
```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('wizard_autofill_settings', 'wizard_autofill_audit');
```

### Issue: "Function public.is_admin() does not exist"

**Cause:** Missing dependency from `003_fix_rls_recursion.sql`.

**Solution:** Run migration 003 first, then re-run 006.

### Issue: Storage upload fails with "new row violates row-level security policy"

**Cause:** Incorrect folder structure in storage path.

**Solution:** Ensure files are uploaded to `{user_id}/filename.pdf` format:
```typescript
const filePath = `${user.id}/${uuid()}_${file.name}`;
await supabase.storage.from('wizard-uploads').upload(filePath, file);
```

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [PostgreSQL Security Definer Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [OpenRouter API Documentation](https://openrouter.ai/docs)
