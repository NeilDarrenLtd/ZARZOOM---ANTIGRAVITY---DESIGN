# Wizard Autofill UI Guide

Complete guide to the wizard autofill user experience and implementation.

## Overview

The wizard autofill feature allows users to automatically populate their onboarding wizard by either:
1. **Website Analysis** - Entering their website URL and clicking "Auto-fill from website"
2. **File Upload** - Uploading a PDF/DOC/DOCX file and clicking "Analyse file"

## User Flow

### 1. Website Autofill

**Step-by-step:**
1. User navigates to Brand step (Step 2) of onboarding wizard
2. User enters their website URL in the "Website URL" field at the top
3. User clicks "Auto-fill from website" button (sparkles icon)
4. System shows loading state: button shows spinner + "Analysing..." text
5. Backend fetches website, extracts content, calls OpenRouter AI
6. On success/partial:
   - Green/amber banner appears with appropriate message
   - Wizard data reloads from database
   - Fields populate with extracted data
   - AI-filled fields show purple "AI-filled" badges
7. User reviews and adjusts data as needed
8. User proceeds through remaining wizard steps

**Status Messages:**
- **Success**: "We filled what we could. Please review and adjust if needed." (green)
- **Partial**: "We couldn't get everything. Please complete the remaining fields below." (amber) + shows list of missing fields
- **Error**: "We couldn't analyse that right now. Please try again or fill in manually." (red)

### 2. File Autofill

**Step-by-step:**
1. User clicks file input to select PDF/DOC/DOCX (max 10MB)
2. File validation checks size and type
3. User clicks "Analyse file" button
4. System uploads file to Supabase Storage
5. System extracts text content (pdf-parse/mammoth)
6. Backend calls OpenRouter AI with extracted text
7. Same success/partial/error handling as website autofill
8. Fields populate, badges appear, data refreshes

**File Validations:**
- Max 10MB file size
- Only PDF, DOC, DOCX allowed
- Client-side validation before upload

## UI Components

### AIFilledField Component

**Location:** `/components/onboarding/AIFilledField.tsx`

Wraps form fields to show AI-filled badge when applicable.

```tsx
<AIFilledField isAIFilled={aiFilledFields.includes("business_name")}>
  <div>
    <label>Business Name</label>
    <input value={data.business_name} onChange={...} />
  </div>
</AIFilledField>
```

**Badge appearance:**
- Purple background (`bg-purple-50`)
- Purple border (`border-purple-200`)
- Sparkles icon + "AI-filled" text
- Positioned absolutely at top-right of field

### Status Banners

Three types of status banners appear after autofill attempts:

**Success Banner (Green):**
```tsx
<div className="bg-green-50 border-green-200">
  <CheckCircle2 className="text-green-600" />
  <p className="text-green-700">
    We filled what we could. Please review and adjust if needed.
  </p>
</div>
```

**Partial Banner (Amber):**
```tsx
<div className="bg-amber-50 border-amber-200">
  <AlertCircle className="text-amber-600" />
  <p className="text-amber-700">
    We couldn't get everything. Please complete the remaining fields below.
  </p>
</div>
```

**Error Banner (Red):**
```tsx
<div className="bg-red-50 border-red-200">
  <AlertCircle className="text-red-600" />
  <p className="text-red-700">
    We couldn't analyse that right now. Please try again or fill in manually.
  </p>
</div>
```

### Missing Fields Helper

When partial autofill occurs, a helper message appears at the top of Step 2:

```tsx
<div className="bg-amber-50 border-amber-200 rounded-lg p-4">
  <h4 className="text-amber-900">Complete remaining fields</h4>
  <p className="text-amber-700">We filled what we could, but still need:</p>
  <ul className="list-disc list-inside">
    <li>Business name</li>
    <li>Business description</li>
  </ul>
</div>
```

## State Management

### Onboarding Page State

**Main state variables:**
```tsx
const [data, setData] = useState<OnboardingUpdate>({...});
const [aiFilledFields, setAiFilledFields] = useState<string[]>([]);
```

**Reload function:**
```tsx
const reloadWizardData = useCallback(async () => {
  const res = await fetch("/api/v1/onboarding");
  const profile = res.json().data;
  
  // Merge all fields from profile into local state
  setData({ ...data, ...profile });
  
  // Update AI-filled fields tracking
  setAiFilledFields(profile.autofill_fields_filled || []);
}, [data]);
```

### Step 2 Brand State

**Local state for autofill status:**
```tsx
type AutoFillStatus = "idle" | "loading" | "success" | "partial" | "error";

const [websiteStatus, setWebsiteStatus] = useState<AutoFillStatus>("idle");
const [fileStatus, setFileStatus] = useState<AutoFillStatus>("idle");
const [selectedFile, setSelectedFile] = useState<File | null>(null);
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User enters URL or uploads file                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Frontend calls API endpoint                                  │
│    - /api/v1/onboarding/autofill/website                       │
│    - /api/v1/onboarding/autofill/file                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend processes                                            │
│    - Fetch website content OR extract file text                │
│    - Call OpenRouter AI with prompt                            │
│    - Validate response with Zod schema                         │
│    - Map to wizard fields                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend persists to database                                 │
│    - Update onboarding_profiles with extracted data            │
│    - Set autofill_fields_filled array                          │
│    - Create audit log entry                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Frontend reloads wizard data                                 │
│    - Calls reloadWizardData()                                   │
│    - Fetches updated profile from DB                            │
│    - Updates local state with new data                          │
│    - Updates aiFilledFields array                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. UI updates                                                   │
│    - Fields populate with data                                  │
│    - AI-filled badges appear                                    │
│    - Status banner shows                                        │
│    - User can review and edit                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Props Propagation

AI-filled metadata flows down through wizard steps:

```tsx
// app/onboarding/page.tsx
<Step2Brand 
  data={data}
  onChange={handleChange}
  aiFilledFields={aiFilledFields}  // ← Tracked in parent
  onReload={reloadWizardData}       // ← Reload function
/>

<Step3Goals 
  data={data}
  onChange={handleChange}
  aiFilledFields={aiFilledFields}  // ← Same array
/>

<Step4Plan 
  data={data}
  onChange={handleChange}
  aiFilledFields={aiFilledFields}  // ← Same array
/>

<Step5Connect 
  data={data}
  onChange={handleChange}
  aiFilledFields={aiFilledFields}  // ← Same array
/>
```

## Database Tracking

### Onboarding Profiles Table

New columns track autofill metadata:

```sql
ALTER TABLE onboarding_profiles
  ADD COLUMN autofilled_from_source TEXT;      -- 'website' | 'file'
  ADD COLUMN autofill_source_value TEXT;        -- URL or filename
  ADD COLUMN autofill_performed_at TIMESTAMPTZ; -- Timestamp
  ADD COLUMN autofill_fields_filled TEXT[];     -- ['business_name', 'brand_color_hex']
  ADD COLUMN autofill_audit_id UUID;            -- Reference to audit log
```

### Reading AI-filled Fields

```tsx
// Frontend reads autofill_fields_filled array
const profile = await fetch("/api/v1/onboarding").json();
const aiFilledFields = profile.data.autofill_fields_filled || [];

// Check if specific field was AI-filled
const isAIFilled = aiFilledFields.includes("business_name");
```

## Keyboard Shortcuts

None currently implemented, but could add:
- `Cmd/Ctrl + Enter` - Trigger autofill when URL is focused
- `Esc` - Cancel autofill in progress

## Accessibility

**ARIA labels:**
- Status banners use appropriate ARIA roles (`role="alert"`)
- Loading states announce to screen readers
- AI-filled badges use `aria-label="AI-filled field"`

**Keyboard navigation:**
- All buttons and inputs are keyboard accessible
- File input accessible via label click
- Tab order follows logical flow

## Error Handling

### Client-side Validation

**URL validation:**
```tsx
function validateWebsiteUrl(value: string) {
  try {
    new URL(value);
    setUrlError("");
  } catch {
    setUrlError("Invalid URL");
  }
}
```

**File validation:**
```tsx
function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  
  // Size check
  if (file.size > 10 * 1024 * 1024) {
    alert("File too large (max 10MB)");
    return;
  }
  
  // Type check
  const allowed = ["application/pdf", "application/msword", ...];
  if (!allowed.includes(file.type)) {
    alert("Only PDF, DOC, DOCX supported");
    return;
  }
}
```

### Backend Error Handling

API endpoints return structured errors:

```json
{
  "error": "Failed to analyze website",
  "message": "Website returned 404 Not Found",
  "status": "error"
}
```

Frontend catches and displays:
```tsx
try {
  const res = await fetch("/api/v1/onboarding/autofill/website", {...});
  if (!res.ok) {
    throw new Error(body.error || "Failed");
  }
} catch (error) {
  setWebsiteStatus("error");
}
```

## Performance Considerations

**Timeouts:**
- Website fetch: 10 seconds
- File extraction: Immediate (synchronous)
- OpenRouter API: 30 seconds default

**Rate Limiting:**
- Not implemented yet
- Could add: 3 autofill attempts per hour per user

**Caching:**
- Audit logs store results
- Could implement: Don't re-analyze same URL within 24h

## Testing Checklist

**Manual testing:**
- [ ] Enter valid URL, autofill succeeds
- [ ] Enter invalid URL, shows error
- [ ] Enter non-existent domain, shows error
- [ ] Upload valid PDF, autofill succeeds
- [ ] Upload file >10MB, shows error
- [ ] Upload unsupported file type, shows error
- [ ] Partial autofill shows missing fields helper
- [ ] AI-filled badges appear on correct fields
- [ ] Data persists across page refresh
- [ ] Data persists when navigating between steps
- [ ] Multiple autofills update correctly
- [ ] Error messages are clear and actionable

## Future Enhancements

**Undo functionality:**
- Store snapshot before autofill
- Add "Undo last autofill" button
- Restore previous values on click

**Progress indicators:**
- Show % completion during autofill
- "Extracting content..." → "Analyzing with AI..." → "Done!"

**Smart defaults:**
- If URL ends in /about, prioritize that page
- If filename contains "brand guide", boost confidence

**Batch autofill:**
- Allow multiple URLs for better accuracy
- Combine data from homepage + about + pricing

**Confidence scores:**
- Show AI confidence for each field
- Allow user to accept/reject individual fields

---

## Related Documentation

- [Wizard Autofill Schema Guide](./WIZARD_AUTOFILL_SCHEMA_GUIDE.md)
- [Wizard Autofill API](./WIZARD_AUTOFILL_API.md)
- [Site Fetcher](./SITE_FETCHER.md)
- [File Upload](./FILE_UPLOAD_WIZARD.md)
- [OpenRouter Client](./OPENROUTER_CLIENT.md)
