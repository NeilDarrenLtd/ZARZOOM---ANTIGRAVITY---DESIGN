# Wizard Auto-fill Implementation Guide

This guide provides the implementation roadmap for the wizard auto-fill feature now that the database schema is complete.

## ✅ Completed: Database Layer

- [x] Migration file: `scripts/006_wizard_autofill_feature.sql`
- [x] TypeScript types: `lib/types/wizard-autofill.ts`
- [x] Documentation: `docs/WIZARD_AUTOFILL_SCHEMA.md`
- [x] UI scaffolding: Updated `components/onboarding/Step2Brand.tsx` with auto-fill buttons and status indicators

### Tables Created
1. `wizard_autofill_settings` - Admin-configurable OpenRouter prompts (singleton)
2. `wizard_autofill_audit` - Audit logs for all analysis runs
3. `onboarding_profiles` - Enhanced with auto-fill metadata columns
4. Storage bucket: `wizard-uploads` - Private bucket for PDF/Word uploads

### RLS Policies
- ✅ Admin-only access to settings
- ✅ Users can read/write their own audit logs
- ✅ Admins can read all audit logs
- ✅ Users can upload/read/delete files in their own folder
- ✅ Admins can read all uploaded files

---

## 🚧 Next Steps: Backend Implementation

### Phase 1: Core API Routes

#### 1.1 Website Auto-fill API
**File:** `app/api/v1/onboarding/autofill/website/route.ts`

**Method:** POST

**Request Body:**
```typescript
{
  url: string; // Website URL to analyze
}
```

**Implementation Steps:**
1. Validate user authentication
2. Validate URL format
3. Fetch website content (use a scraping library or service)
4. Get settings from `public.get_wizard_autofill_settings()`
5. Check if `website_autofill_enabled` is true
6. Call OpenRouter API with website content
7. Parse JSON response to extract brand data
8. Log to `wizard_autofill_audit` using `public.log_wizard_autofill()`
9. Update `onboarding_profiles` with extracted data
10. Return extracted fields to frontend

**OpenRouter Request:**
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: settings.website_prompt
      },
      {
        role: 'user',
        content: websiteContent
      }
    ],
    max_tokens: settings.max_tokens,
    temperature: settings.temperature,
    response_format: { type: 'json_object' }
  })
});
```

**Response:**
```typescript
{
  status: 'success' | 'partial' | 'error',
  extracted_data: {
    business_name?: string,
    business_description?: string,
    brand_color_hex?: string,
    content_language?: string,
    article_styles?: string[]
  },
  fields_filled: string[],
  audit_id: string,
  error_message?: string
}
```

---

#### 1.2 File Auto-fill API
**File:** `app/api/v1/onboarding/autofill/file/route.ts`

**Method:** POST

**Request Body:**
```typescript
{
  file_path: string; // Path in Supabase Storage
  file_name: string;
  file_size: number;
  file_mime_type: string;
}
```

**Implementation Steps:**
1. Validate user authentication
2. Verify file exists in user's folder in `wizard-uploads` bucket
3. Download file from Supabase Storage
4. Extract text content from PDF/Word (use `pdf-parse` or `mammoth`)
5. Get settings from `public.get_wizard_autofill_settings()`
6. Check if `file_autofill_enabled` is true
7. Call OpenRouter API with file content
8. Parse JSON response to extract brand data
9. Log to `wizard_autofill_audit`
10. Update `onboarding_profiles` with extracted data
11. Return extracted fields to frontend

**File Upload Route (separate):**
**File:** `app/api/v1/onboarding/autofill/upload/route.ts`

**Method:** POST (multipart/form-data)

**Implementation:**
1. Validate user authentication
2. Validate file type (PDF, DOC, DOCX only)
3. Validate file size (max 10MB)
4. Generate UUID for filename
5. Upload to `wizard-uploads/{user_id}/{uuid}_{filename}`
6. Return storage path and metadata

**Response:**
```typescript
{
  file_path: string,
  file_name: string,
  file_size: number,
  file_mime_type: string,
  success: boolean
}
```

---

### Phase 2: Admin API Routes

#### 2.1 Get Wizard Auto-fill Settings (Admin)
**File:** `app/api/v1/admin/wizard-autofill/settings/route.ts`

**Method:** GET

**Auth:** Admin only

**Implementation:**
1. Check if user is admin (use `lib/auth/support.ts` pattern)
2. Query `wizard_autofill_settings` table
3. Return settings object

**Response:** `WizardAutofillSettings`

---

#### 2.2 Update Wizard Auto-fill Settings (Admin)
**File:** `app/api/v1/admin/wizard-autofill/settings/route.ts`

**Method:** PUT

**Auth:** Admin only

**Request Body:** `UpdateWizardAutofillSettingsRequest`

**Implementation:**
1. Check if user is admin
2. Validate request body with Zod schema
3. Update `wizard_autofill_settings` table
4. Set `updated_by` to current user ID
5. Return updated settings

---

#### 2.3 Get Audit Logs (Admin)
**File:** `app/api/v1/admin/wizard-autofill/audit/route.ts`

**Method:** GET

**Auth:** Admin only

**Query Params:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `source_type` (optional: 'website' | 'file')
- `status` (optional: 'success' | 'partial' | 'error')
- `user_id` (optional: filter by user)

**Implementation:**
1. Check if user is admin
2. Build query with filters and pagination
3. Query `wizard_autofill_audit` table
4. Return paginated results

---

### Phase 3: Frontend Components

#### 3.1 File Upload Component
**File:** `components/onboarding/FileUploadSection.tsx`

**Features:**
- Drag & drop file upload
- File validation (type, size)
- Upload progress indicator
- Preview uploaded file name
- "Analyse file" button integration

**State Management:**
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
const [storageMetadata, setStorageMetadata] = useState<FileStorageMetadata | null>(null);
```

---

#### 3.2 Admin Settings Page
**File:** `app/admin/wizard-autofill/page.tsx`

**Features:**
- Text areas for editing OpenRouter prompts
- Model selection dropdown
- Temperature/max_tokens sliders
- Feature toggle switches (enable/disable website/file auto-fill)
- Save button with confirmation
- "Test prompt" functionality (optional)

**Layout:**
```tsx
<AdminLayout>
  <Card title="Wizard Auto-fill Settings">
    <Tabs>
      <Tab label="Website Prompt">
        <PromptEditor value={websitePrompt} onChange={...} />
      </Tab>
      <Tab label="File Prompt">
        <PromptEditor value={filePrompt} onChange={...} />
      </Tab>
      <Tab label="Configuration">
        <ModelSelector />
        <TemperatureSlider />
        <FeatureToggles />
      </Tab>
    </Tabs>
    <SaveButton />
  </Card>
</AdminLayout>
```

---

#### 3.3 Admin Audit Logs Page
**File:** `app/admin/wizard-autofill/audit/page.tsx`

**Features:**
- Paginated table of audit logs
- Filters: source_type, status, date range, user
- Search by URL/filename
- View detailed log entry (modal)
- Export to CSV (optional)

**Table Columns:**
- Created At
- User Email
- Source Type
- Source Value (URL/filename)
- Status
- Fields Filled
- Tokens Used
- Actions (View Details)

---

### Phase 4: Integration with Step2Brand

#### 4.1 Update Website "Auto-fill" Button Handler
**File:** `components/onboarding/Step2Brand.tsx`

**Current:** Calls `/api/v1/onboarding/investigate-website` (stub)

**Update to:**
```typescript
async function handleInvestigate() {
  if (!data.website_url) return;
  setInvestigating(true);
  setWebsiteStatus("loading");

  try {
    const res = await fetch("/api/v1/onboarding/autofill/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: data.website_url }),
    });

    if (!res.ok) throw new Error("Failed");

    const body = await res.json();
    
    // Update form with extracted data
    const patch: Partial<OnboardingUpdate> = {};
    if (body.extracted_data.business_name) {
      patch.business_name = body.extracted_data.business_name;
    }
    if (body.extracted_data.business_description) {
      patch.business_description = body.extracted_data.business_description;
    }
    if (body.extracted_data.brand_color_hex) {
      patch.brand_color_hex = body.extracted_data.brand_color_hex;
    }
    if (body.extracted_data.article_styles) {
      patch.article_styles = body.extracted_data.article_styles;
    }
    
    onChange(patch);
    setWebsiteStatus(body.fields_filled.length > 0 ? "success" : "partial");
  } catch {
    setWebsiteStatus("error");
  } finally {
    setInvestigating(false);
  }
}
```

---

#### 4.2 Implement File "Analyse" Button Handler
**File:** `components/onboarding/Step2Brand.tsx`

**Steps:**
1. Upload file to storage (if not already uploaded)
2. Call `/api/v1/onboarding/autofill/file` with storage metadata
3. Update form with extracted data
4. Show status (success/partial/error)

```typescript
async function handleFileAnalyse() {
  if (!selectedFile) return;
  setFileStatus("loading");

  try {
    // Step 1: Upload file
    const uploadRes = await fetch("/api/v1/onboarding/autofill/upload", {
      method: "POST",
      body: createFormData(selectedFile),
    });
    
    if (!uploadRes.ok) throw new Error("Upload failed");
    const uploadData = await uploadRes.json();
    
    // Step 2: Analyze file
    const analyzeRes = await fetch("/api/v1/onboarding/autofill/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_path: uploadData.file_path,
        file_name: uploadData.file_name,
        file_size: uploadData.file_size,
        file_mime_type: uploadData.file_mime_type,
      }),
    });
    
    if (!analyzeRes.ok) throw new Error("Analysis failed");
    const body = await analyzeRes.json();
    
    // Step 3: Update form
    const patch: Partial<OnboardingUpdate> = {};
    // ... map extracted fields to patch object
    
    onChange(patch);
    setFileStatus(body.fields_filled.length > 0 ? "success" : "partial");
  } catch {
    setFileStatus("error");
  }
}
```

---

## 📦 Required Dependencies

Add these packages to `package.json`:

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "@mozilla/readability": "^0.5.0"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.1"
  }
}
```

---

## 🔐 Environment Variables

Add to Vercel project:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Admin can optionally override model in settings, but this key is required for OpenRouter API access.

---

## 🧪 Testing Checklist

### Database Tests
- [ ] Run migration successfully
- [ ] Verify singleton pattern (only 1 settings row)
- [ ] Test RLS policies as user and admin
- [ ] Test storage bucket policies

### API Tests
- [ ] Website auto-fill returns extracted data
- [ ] File upload succeeds with valid PDF/DOCX
- [ ] File upload fails with invalid file type
- [ ] File upload fails if > 10MB
- [ ] File auto-fill returns extracted data
- [ ] Admin can read/update settings
- [ ] Non-admin cannot access settings
- [ ] Admin can view all audit logs
- [ ] User can view only their audit logs

### UI Tests
- [ ] Website URL input shows status messages
- [ ] File upload shows preview
- [ ] "Auto-fill" button disables during analysis
- [ ] Status messages match actual results
- [ ] Extracted data populates form fields correctly
- [ ] Admin settings page loads and saves

---

## 📊 Success Metrics

Track these metrics in the admin audit logs page:

1. **Adoption Rate:** % of users who use auto-fill vs manual entry
2. **Success Rate:** % of analyses with status='success'
3. **Partial Fill Rate:** % of analyses with status='partial'
4. **Error Rate:** % of analyses with status='error'
5. **Average Fields Filled:** Mean number of fields auto-filled per analysis
6. **Token Usage:** Total OpenRouter tokens consumed (cost monitoring)
7. **Processing Time:** Average `processing_time_ms` per analysis

---

## 🎯 Future Enhancements

1. **Smart Field Mapping:** Use AI to improve field extraction accuracy
2. **Multi-file Upload:** Allow multiple files for better context
3. **Image Analysis:** Extract colors from logo images
4. **Website Screenshots:** Capture hero image for brand analysis
5. **LinkedIn Import:** Auto-fill from LinkedIn company page
6. **Batch Import:** Admin bulk import for onboarding multiple clients
7. **A/B Testing:** Test different prompts and track conversion rates
8. **Confidence Scores:** Show how confident the AI is in each extracted field

---

## 🐛 Known Limitations

1. **Website Scraping:** May fail on JavaScript-heavy sites (consider using a headless browser)
2. **PDF Parsing:** Complex layouts may not extract cleanly
3. **Language Detection:** Works best with English content
4. **Rate Limiting:** OpenRouter has rate limits (need to handle 429 errors)
5. **Token Costs:** Each analysis consumes tokens (monitor costs)

---

## 📚 Additional Resources

- [OpenRouter API Docs](https://openrouter.ai/docs)
- [pdf-parse Documentation](https://www.npmjs.com/package/pdf-parse)
- [mammoth.js Documentation](https://www.npmjs.com/package/mammoth)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Cheerio Documentation](https://cheerio.js.org/)

---

## Support

For questions or issues with the wizard auto-fill feature:

1. Check the audit logs: `app/admin/wizard-autofill/audit`
2. Review the database schema: `docs/WIZARD_AUTOFILL_SCHEMA.md`
3. Test with the verification queries in the migration file
4. Check OpenRouter API key is valid
5. Verify RLS policies are correctly applied

---

**Last Updated:** 2024-02-21  
**Schema Version:** 006  
**Status:** Database layer complete, API implementation pending
