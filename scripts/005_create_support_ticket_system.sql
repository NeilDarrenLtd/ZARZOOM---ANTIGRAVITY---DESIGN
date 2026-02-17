-- ============================================================================
-- Migration 005: Internal Support Ticket System with Attachments
--
-- Creates a complete support ticket system with:
-- - Support settings for recipient configuration
-- - Tickets with status workflow and priority levels
-- - Comments with role-based authoring
-- - Attachments with file validation (screenshots only)
-- - Strict RLS policies using existing is_admin() function
-- - Supabase Storage bucket: support-attachments (PRIVATE)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SUPPORT_SETTINGS -- Email recipient configuration for tickets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_recipient_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT/INSERT/UPDATE settings
CREATE POLICY "Admins can read support settings"
  ON public.support_settings FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert support settings"
  ON public.support_settings FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update support settings"
  ON public.support_settings FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Seed default settings
INSERT INTO public.support_settings (support_recipient_email)
VALUES ('support@zarzoom.com')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 2. SUPPORT_TICKETS -- Main ticket table with status workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NULL CHECK (priority IN ('low', 'normal', 'high')),
  category TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  
  -- Status constraint
  CONSTRAINT support_tickets_status_check 
    CHECK (status IN ('open', 'investigating', 'waiting_on_user', 'resolved', 'closed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx 
  ON public.support_tickets (user_id);
  
CREATE INDEX IF NOT EXISTS support_tickets_status_idx 
  ON public.support_tickets (status);
  
CREATE INDEX IF NOT EXISTS support_tickets_last_activity_idx 
  ON public.support_tickets (last_activity_at DESC);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own tickets
CREATE POLICY "Users can read own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can INSERT their own tickets
CREATE POLICY "Users can create own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own tickets (limited fields)
CREATE POLICY "Users can update own tickets"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can SELECT all tickets
CREATE POLICY "Admins can read all tickets"
  ON public.support_tickets FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can UPDATE all tickets (including status)
CREATE POLICY "Admins can update all tickets"
  ON public.support_tickets FOR UPDATE
  USING (public.is_admin(auth.uid()));


-- ============================================================================
-- 3. SUPPORT_COMMENTS -- Comments on tickets with role tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('user', 'admin', 'system')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS support_comments_ticket_created_idx 
  ON public.support_comments (ticket_id, created_at);

-- Enable RLS
ALTER TABLE public.support_comments ENABLE ROW LEVEL SECURITY;

-- Users can SELECT comments only for tickets they own
CREATE POLICY "Users can read own ticket comments"
  ON public.support_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

-- Users can INSERT comments only for tickets they own
CREATE POLICY "Users can create comments on own tickets"
  ON public.support_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

-- Admins can SELECT all comments
CREATE POLICY "Admins can read all comments"
  ON public.support_comments FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can INSERT comments on any ticket
CREATE POLICY "Admins can create comments on all tickets"
  ON public.support_comments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));


-- ============================================================================
-- 4. SUPPORT_ATTACHMENTS -- File attachments (screenshots only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.support_comments(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_role TEXT NOT NULL CHECK (uploaded_by_role IN ('user', 'admin')),
  kind TEXT NOT NULL DEFAULT 'screenshot',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 5242880), -- 5MB max
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS support_attachments_ticket_idx 
  ON public.support_attachments (ticket_id);
  
CREATE INDEX IF NOT EXISTS support_attachments_comment_idx 
  ON public.support_attachments (comment_id);

-- Enable RLS
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

-- Users can SELECT attachments only for tickets they own
CREATE POLICY "Users can read own ticket attachments"
  ON public.support_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

-- Users can INSERT attachments only for tickets they own
CREATE POLICY "Users can upload attachments to own tickets"
  ON public.support_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

-- Admins can SELECT all attachments
CREATE POLICY "Admins can read all attachments"
  ON public.support_attachments FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can INSERT attachments on any ticket
CREATE POLICY "Admins can upload attachments to all tickets"
  ON public.support_attachments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can DELETE attachments
CREATE POLICY "Admins can delete attachments"
  ON public.support_attachments FOR DELETE
  USING (public.is_admin(auth.uid()));


-- ============================================================================
-- 5. TRIGGERS -- Auto-update timestamps and activity tracking
-- ============================================================================

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for support_settings.updated_at
DROP TRIGGER IF EXISTS support_settings_updated_at ON public.support_settings;
CREATE TRIGGER support_settings_updated_at
  BEFORE UPDATE ON public.support_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for support_tickets.updated_at
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Last activity trigger function
CREATE OR REPLACE FUNCTION public.update_ticket_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update last_activity_at when a comment is inserted
  UPDATE public.support_tickets
  SET last_activity_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

-- Trigger for last_activity_at on comment insert
DROP TRIGGER IF EXISTS support_comments_update_activity ON public.support_comments;
CREATE TRIGGER support_comments_update_activity
  AFTER INSERT ON public.support_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_last_activity();

-- Last activity on status change
CREATE OR REPLACE FUNCTION public.update_ticket_activity_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update last_activity_at when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_activity_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_status_activity ON public.support_tickets;
CREATE TRIGGER support_tickets_status_activity
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_activity_on_status_change();


-- ============================================================================
-- 6. STORAGE BUCKET DOCUMENTATION
-- ============================================================================

-- NOTE: Supabase Storage buckets must be created via the Supabase Dashboard
-- or via the Management API. This migration documents the required setup:
--
-- Bucket Name: support-attachments
-- Visibility: PRIVATE
-- File Size Limit: 5MB
-- Allowed MIME Types: image/png, image/jpeg, image/webp
--
-- Object Path Convention:
--   support/{ticketId}/{commentId}/{attachmentId}.{ext}
--
-- Example:
--   support/a1b2c3d4-e5f6-7890-abcd-ef1234567890/
--          b2c3d4e5-f6a7-8901-bcde-f12345678901/
--          c3d4e5f6-a7b8-9012-cdef-123456789012.png
--
-- RLS Policies for Storage:
-- Users can upload to their own tickets, admins can access all files.
-- These must be configured in the Supabase Dashboard under Storage > Policies.


COMMIT;


-- ============================================================================
-- 7. TEST QUERIES -- Validation snippets
-- ============================================================================

-- Test 1: User cannot read another user's tickets
-- (Run as regular user; should return 0 rows if no shared tickets)
-- SELECT * FROM public.support_tickets WHERE user_id != auth.uid();

-- Test 2: User can insert a ticket
-- INSERT INTO public.support_tickets (user_id, subject, priority)
-- VALUES (auth.uid(), 'Test ticket', 'normal')
-- RETURNING id, subject, status;

-- Test 3: Admin can list all tickets
-- (Run as admin user; should return all tickets)
-- SELECT id, user_id, subject, status, created_at 
-- FROM public.support_tickets
-- ORDER BY created_at DESC;

-- Test 4: Status constraint rejects invalid values
-- INSERT INTO public.support_tickets (user_id, subject, status)
-- VALUES (auth.uid(), 'Invalid status test', 'invalid_status');
-- Expected: ERROR - violates check constraint "support_tickets_status_check"

-- Test 5: Attachment mime_type constraint rejects invalid values
-- INSERT INTO public.support_attachments (
--   ticket_id, comment_id, uploaded_by_user_id, uploaded_by_role,
--   file_path, file_name, mime_type, file_size
-- )
-- VALUES (
--   '...', '...', auth.uid(), 'user',
--   'support/test/test/test.pdf', 'test.pdf', 'application/pdf', 1000
-- );
-- Expected: ERROR - violates check constraint for mime_type

-- Test 6: Attachment file_size constraint rejects files over 5MB
-- INSERT INTO public.support_attachments (
--   ticket_id, comment_id, uploaded_by_user_id, uploaded_by_role,
--   file_path, file_name, mime_type, file_size
-- )
-- VALUES (
--   '...', '...', auth.uid(), 'user',
--   'support/test/test/test.png', 'test.png', 'image/png', 6000000
-- );
-- Expected: ERROR - violates check constraint for file_size
