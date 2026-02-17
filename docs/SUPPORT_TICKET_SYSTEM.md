# Support Ticket System Documentation

## Overview

This document describes the internal support ticket system with attachment support implemented in migration `005_create_support_ticket_system.sql`.

## Database Schema

### Tables Created

#### 1. `support_settings`
Stores system-wide support configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| support_recipient_email | TEXT | Email address to receive ticket notifications |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**RLS Policies:**
- Only admins can SELECT/INSERT/UPDATE settings

#### 2. `support_tickets`
Main ticket tracking table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User who created the ticket |
| subject | TEXT | Ticket subject/title |
| status | TEXT | Current ticket status (constrained) |
| priority | TEXT | Priority level: low, normal, high (nullable) |
| category | TEXT | Optional category (nullable) |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |
| last_activity_at | TIMESTAMPTZ | Last activity timestamp (auto-updated) |

**Status Values (CHECK constraint):**
- `open` - Newly created ticket
- `investigating` - Admin is looking into the issue
- `waiting_on_user` - Waiting for user response
- `resolved` - Issue resolved, awaiting closure
- `closed` - Ticket closed

**Indexes:**
- `support_tickets_user_id_idx` - Fast lookup by user
- `support_tickets_status_idx` - Filter by status
- `support_tickets_last_activity_idx` - Sort by activity (DESC)

**RLS Policies:**
- Users can SELECT/INSERT/UPDATE their own tickets
- Admins can SELECT/UPDATE all tickets

#### 3. `support_comments`
Comments/messages within tickets.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| ticket_id | UUID | Parent ticket (CASCADE delete) |
| author_user_id | UUID | Comment author (nullable, SET NULL on delete) |
| author_role | TEXT | Role: user, admin, system |
| message | TEXT | Comment text content |
| created_at | TIMESTAMPTZ | Creation timestamp |

**Indexes:**
- `support_comments_ticket_created_idx` - Efficient comment retrieval per ticket

**RLS Policies:**
- Users can SELECT/INSERT comments only for their own tickets
- Admins can SELECT/INSERT comments on all tickets

#### 4. `support_attachments`
File attachments (screenshots only).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| ticket_id | UUID | Parent ticket (CASCADE delete) |
| comment_id | UUID | Parent comment (CASCADE delete) |
| uploaded_by_user_id | UUID | Uploader (nullable, SET NULL on delete) |
| uploaded_by_role | TEXT | Role: user, admin |
| kind | TEXT | Attachment type (default: 'screenshot') |
| file_path | TEXT | Storage path |
| file_name | TEXT | Original filename |
| mime_type | TEXT | File MIME type (constrained) |
| file_size | INT | File size in bytes (constrained) |
| created_at | TIMESTAMPTZ | Upload timestamp |

**Constraints:**
- `mime_type` must be: `image/png`, `image/jpeg`, or `image/webp`
- `file_size` must be > 0 and <= 5,242,880 bytes (5MB)
- `uploaded_by_role` must be: `user` or `admin`

**Indexes:**
- `support_attachments_ticket_idx` - Fast ticket lookup
- `support_attachments_comment_idx` - Fast comment lookup

**RLS Policies:**
- Users can SELECT/INSERT attachments only for their own tickets
- Admins can SELECT/INSERT attachments on all tickets
- Only admins can DELETE attachments

## Triggers

### Auto-Update Triggers

1. **`support_settings_updated_at`**
   - Updates `updated_at` on any UPDATE to `support_settings`

2. **`support_tickets_updated_at`**
   - Updates `updated_at` on any UPDATE to `support_tickets`

3. **`support_tickets_status_activity`**
   - Updates `last_activity_at` when ticket `status` changes

4. **`support_comments_update_activity`**
   - Updates ticket's `last_activity_at` when a new comment is inserted

## Supabase Storage Setup

### Bucket Configuration

**Bucket Name:** `support-attachments`

**Settings:**
- **Visibility:** PRIVATE
- **File Size Limit:** 5MB
- **Allowed MIME Types:** image/png, image/jpeg, image/webp

### Object Path Convention

All attachment files must follow this path structure:

```
support/{ticketId}/{commentId}/{attachmentId}.{ext}
```

**Example:**
```
support/a1b2c3d4-e5f6-7890-abcd-ef1234567890/b2c3d4e5-f6a7-8901-bcde-f12345678901/c3d4e5f6-a7b8-9012-cdef-123456789012.png
```

### Storage RLS Policies

Configure these policies in Supabase Dashboard under **Storage > Policies**:

1. **User Upload Policy**
   ```sql
   -- Allow users to upload to their own tickets
   CREATE POLICY "Users can upload to own tickets"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'support-attachments'
     AND (storage.foldername(name))[1] = 'support'
     AND EXISTS (
       SELECT 1 FROM public.support_tickets
       WHERE id::text = (storage.foldername(name))[2]
       AND user_id = auth.uid()
     )
   );
   ```

2. **User Read Policy**
   ```sql
   -- Allow users to read files from their own tickets
   CREATE POLICY "Users can read own ticket files"
   ON storage.objects FOR SELECT
   USING (
     bucket_id = 'support-attachments'
     AND (storage.foldername(name))[1] = 'support'
     AND EXISTS (
       SELECT 1 FROM public.support_tickets
       WHERE id::text = (storage.foldername(name))[2]
       AND user_id = auth.uid()
     )
   );
   ```

3. **Admin Full Access**
   ```sql
   -- Admins can access all files
   CREATE POLICY "Admins full access"
   ON storage.objects FOR ALL
   USING (
     bucket_id = 'support-attachments'
     AND public.is_admin(auth.uid())
   );
   ```

## Security Model

### Admin Detection

The system uses the existing `public.is_admin()` security definer function:

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

This function:
- Runs with elevated privileges (SECURITY DEFINER)
- Bypasses RLS to check admin status
- Prevents infinite recursion in RLS policies

### User Profile Structure

Admin status is stored in the `profiles` table:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT false,
  ...
);
```

## Validation Tests

### Test 1: User Isolation
Verify users cannot see other users' tickets:
```sql
-- Run as regular user
SELECT * FROM public.support_tickets WHERE user_id != auth.uid();
-- Expected: 0 rows
```

### Test 2: Ticket Creation
Verify users can create tickets:
```sql
INSERT INTO public.support_tickets (user_id, subject, priority)
VALUES (auth.uid(), 'Test ticket', 'normal')
RETURNING id, subject, status;
-- Expected: 1 row with status='open'
```

### Test 3: Admin Access
Verify admins can list all tickets:
```sql
-- Run as admin user
SELECT id, user_id, subject, status, created_at 
FROM public.support_tickets
ORDER BY created_at DESC;
-- Expected: All tickets visible
```

### Test 4: Status Constraint
Verify invalid status is rejected:
```sql
INSERT INTO public.support_tickets (user_id, subject, status)
VALUES (auth.uid(), 'Invalid status test', 'invalid_status');
-- Expected: ERROR - violates check constraint "support_tickets_status_check"
```

### Test 5: MIME Type Constraint
Verify invalid file types are rejected:
```sql
INSERT INTO public.support_attachments (
  ticket_id, comment_id, uploaded_by_user_id, uploaded_by_role,
  file_path, file_name, mime_type, file_size
)
VALUES (
  '...', '...', auth.uid(), 'user',
  'support/test/test/test.pdf', 'test.pdf', 'application/pdf', 1000
);
-- Expected: ERROR - violates check constraint (mime_type)
```

### Test 6: File Size Constraint
Verify files over 5MB are rejected:
```sql
INSERT INTO public.support_attachments (
  ticket_id, comment_id, uploaded_by_user_id, uploaded_by_role,
  file_path, file_name, mime_type, file_size
)
VALUES (
  '...', '...', auth.uid(), 'user',
  'support/test/test/test.png', 'test.png', 'image/png', 6000000
);
-- Expected: ERROR - violates check constraint (file_size)
```

## Usage Examples

### Create a Ticket
```typescript
const { data: ticket, error } = await supabase
  .from('support_tickets')
  .insert({
    user_id: user.id,
    subject: 'Login issue',
    priority: 'high',
    category: 'authentication'
  })
  .select()
  .single();
```

### Add a Comment
```typescript
const { data: comment, error } = await supabase
  .from('support_comments')
  .insert({
    ticket_id: ticketId,
    author_user_id: user.id,
    author_role: 'user',
    message: 'Additional details...'
  })
  .select()
  .single();
```

### Upload an Attachment
```typescript
// 1. Upload file to storage
const filePath = `support/${ticketId}/${commentId}/${attachmentId}.png`;
const { error: uploadError } = await supabase.storage
  .from('support-attachments')
  .upload(filePath, file);

// 2. Create attachment record
const { data: attachment, error } = await supabase
  .from('support_attachments')
  .insert({
    ticket_id: ticketId,
    comment_id: commentId,
    uploaded_by_user_id: user.id,
    uploaded_by_role: 'user',
    kind: 'screenshot',
    file_path: filePath,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size
  })
  .select()
  .single();
```

### Update Ticket Status (Admin)
```typescript
const { data, error } = await supabase
  .from('support_tickets')
  .update({ status: 'resolved' })
  .eq('id', ticketId)
  .select()
  .single();
```

## Migration Files

**Created:**
- `scripts/005_create_support_ticket_system.sql` - Complete schema migration

**Dependencies:**
- `scripts/001_create_schema.sql` - Creates `profiles` table with `is_admin`
- `scripts/003_fix_rls_recursion.sql` - Creates `is_admin()` security definer function

## Next Steps

1. **Create Storage Bucket:**
   - Navigate to Supabase Dashboard > Storage
   - Create new bucket: `support-attachments`
   - Set visibility to PRIVATE
   - Configure file size limit: 5MB

2. **Configure Storage RLS Policies:**
   - Add the three storage policies documented above
   - Test upload/download permissions

3. **Set Support Email:**
   - Update `support_settings.support_recipient_email` to your support inbox

4. **Build Frontend:**
   - Ticket creation form
   - Comment interface
   - File upload component (with client-side validation)
   - Admin dashboard for ticket management

5. **Add Email Notifications:**
   - Trigger emails on new tickets
   - Notify users on status changes
   - Alert admins on new comments
