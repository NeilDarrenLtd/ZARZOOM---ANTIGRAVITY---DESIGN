# File Upload for Wizard Auto-fill

This document describes the file upload and parsing implementation for the wizard auto-fill feature.

## Overview

Users can upload PDF, DOC, or DOCX files to automatically populate the onboarding wizard. The system extracts text content from these files and prepares it for AI analysis.

## Architecture

```
User uploads file → Supabase Storage → Text extraction → (Future: AI analysis) → Auto-fill wizard
```

### Components

1. **Frontend** (`components/onboarding/Step2Brand.tsx`)
   - File input with validation
   - Upload progress indicator
   - Success/error status display

2. **API Route** (`app/api/v1/onboarding/upload-file/route.ts`)
   - Handles file upload to Supabase Storage
   - Validates file type and size
   - Extracts text content
   - Returns extracted text for AI processing

3. **File Extractor** (`lib/fileExtractor/index.ts`)
   - Parses PDF, DOC, and DOCX files
   - Normalizes text content
   - Caps text length for LLM processing

## File Constraints

### Supported Formats
- **PDF**: `.pdf` (application/pdf)
- **Word (Legacy)**: `.doc` (application/msword)
- **Word (Modern)**: `.docx` (application/vnd.openxmlformats-officedocument.wordprocessingml.document)

### Size Limits
- **Maximum file size**: 10MB
- **Maximum text length**: 50,000 characters (after extraction)
- **Truncation**: Text is truncated at natural boundaries (sentences) with a notice

### Validation
- MIME type validation
- File extension validation
- MIME/extension consistency check
- Size validation (both frontend and backend)

## Supabase Storage Setup

### Bucket Configuration

The `wizard-uploads` bucket is created in the migration `006_wizard_autofill_feature.sql`:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wizard-uploads',
  'wizard-uploads',
  false,  -- Private bucket
  10485760,  -- 10MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);
```

### RLS Policies

Users can only access their own files:

```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload wizard files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wizard-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
CREATE POLICY "Users can read own wizard files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wizard-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own wizard files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wizard-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

### File Organization

Files are stored with the following path structure:
```
wizard-uploads/
  └── {user_id}/
      └── {random_uuid}.{extension}
```

Example: `wizard-uploads/550e8400-e29b-41d4-a716-446655440000/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf`

## Text Extraction

### PDF Parsing
Uses `pdf-parse` library to extract text from PDF files.

**Extracted metadata:**
- Page count
- Author
- Title
- Creation date

### Word Document Parsing
Uses `mammoth` library to extract text from DOC/DOCX files.

**Features:**
- Handles both legacy (.doc) and modern (.docx) formats
- Extracts plain text (no formatting)
- Preserves paragraph structure

### Text Normalization

All extracted text goes through normalization:
1. Remove control characters (except newlines/tabs)
2. Normalize line breaks (CRLF → LF)
3. Remove excessive blank lines (3+ → 2)
4. Normalize whitespace (multiple spaces → single)
5. Trim lines
6. Cap at 50,000 characters with smart truncation

## API Endpoints

### POST /api/v1/onboarding/upload-file

Upload and parse a file for wizard auto-fill.

**Request:**
```
Content-Type: multipart/form-data

file: <File>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "fileId": "user-id/uuid.pdf",
    "fileName": "company-profile.pdf",
    "fileType": "pdf",
    "extractedText": "Full text content...",
    "metadata": {
      "originalLength": 25000,
      "truncated": false,
      "pageCount": 12,
      "author": "John Doe",
      "title": "Company Profile"
    },
    "analysisReady": true
  }
}
```

**Response (Error):**
```json
{
  "error": "File size exceeds maximum of 10MB",
  "code": "INVALID_FILE"
}
```

**Error Codes:**
- `INVALID_FILE` - File validation failed
- `PARSE_ERROR` - Text extraction failed
- `SIZE_EXCEEDED` - File too large
- `UNSUPPORTED_FORMAT` - Unsupported file type

### GET /api/v1/onboarding/upload-file

List uploaded files for the current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "name": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
        "created_at": "2024-01-15T10:30:00Z",
        "size": 1024000
      }
    ],
    "count": 1
  }
}
```

### DELETE /api/v1/onboarding/upload-file?path={filePath}

Delete an uploaded file.

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## Security

### Upload Security
- ✅ Authentication required
- ✅ Private bucket (not publicly accessible)
- ✅ User-scoped file access (RLS enforced)
- ✅ MIME type validation
- ✅ File size limits
- ✅ Extension validation
- ✅ No arbitrary file execution

### Storage Security
- Files stored with random UUIDs (no user data in filename)
- User ID in path prevents cross-user access
- RLS policies enforce user boundaries
- Admin service role used for upload (bypasses RLS temporarily)
- Files accessible only via signed URLs or user's own auth

### Text Extraction Security
- Maximum text length cap prevents memory issues
- Timeout protection (via library defaults)
- Safe error handling (no stack traces exposed)
- No code execution from file content

## Dependencies

Add these to `package.json`:

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"
  }
}
```

Install:
```bash
npm install pdf-parse mammoth
npm install -D @types/pdf-parse
```

## File Cleanup

### Automatic Cleanup (Optional)

You can set up automatic cleanup of old files using a Supabase Edge Function or cron job:

```sql
-- Delete files older than 7 days
DELETE FROM storage.objects
WHERE bucket_id = 'wizard-uploads'
  AND created_at < NOW() - INTERVAL '7 days';
```

### Manual Cleanup

Users can delete their own files via the DELETE endpoint, or you can add a cleanup UI in the admin panel.

## Testing

### Unit Tests

Test file validation and extraction:

```typescript
import { validateFile, extractTextFromFile } from "@/lib/fileExtractor";

// Test validation
const validation = validateFile({
  name: "test.pdf",
  size: 5000000,
  type: "application/pdf",
});

// Test extraction
const buffer = fs.readFileSync("test.pdf");
const result = await extractTextFromFile(buffer, "test.pdf", "application/pdf");
```

### Integration Tests

1. Upload a test PDF
2. Verify file appears in storage
3. Verify text extraction
4. Verify RLS policies (try accessing another user's file)
5. Test file deletion

## Troubleshooting

### "Failed to upload file"
- Check Supabase Storage is enabled
- Verify bucket exists and has correct name
- Check RLS policies are applied
- Verify service role key is set

### "Failed to parse PDF/DOC"
- Ensure pdf-parse and mammoth are installed
- Check file is not corrupted
- Verify file is actually the claimed type
- Check file size is within limits

### "Unauthorized" errors
- Verify user is authenticated
- Check RLS policies are correct
- Ensure user ID matches folder path

### Text truncation
- Files with more than 50k characters will be truncated
- Check metadata.truncated field
- Consider increasing MAX_TEXT_LENGTH if needed

## Next Steps

The extracted text is now ready for AI analysis with OpenRouter. The next implementation step will:

1. Fetch OpenRouter prompt from settings
2. Combine extracted text with prompt
3. Call OpenRouter API
4. Parse AI response using WizardAutoFillSchema
5. Auto-fill wizard fields with extracted data

## Related Documentation

- [Wizard Auto-fill Schema](./WIZARD_AUTOFILL_SCHEMA_GUIDE.md)
- [OpenRouter Client](./OPENROUTER_CLIENT.md)
- [Database Schema](./WIZARD_AUTOFILL_SCHEMA.md)
