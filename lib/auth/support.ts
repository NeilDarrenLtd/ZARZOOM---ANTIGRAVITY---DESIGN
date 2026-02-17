import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";

/**
 * Check if a user is an admin.
 */
export async function isUserAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");

  if (error) {
    console.error("[auth] Failed to check admin status:", error);
    return false;
  }

  return data === true;
}

/**
 * Verify a user owns a specific ticket.
 * Throws NotFoundError if ticket doesn't exist.
 * Throws ForbiddenError if user doesn't own it.
 */
export async function verifyTicketOwnership(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string
): Promise<void> {
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("ticket_id, user_id")
    .eq("ticket_id", ticketId)
    .single();

  if (error || !ticket) {
    throw new NotFoundError("Ticket");
  }

  if (ticket.user_id !== userId) {
    throw new ForbiddenError("You do not have access to this ticket");
  }
}

/**
 * Verify a comment belongs to a ticket and user owns the ticket.
 */
export async function verifyCommentOwnership(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string,
  commentId: string
): Promise<void> {
  // First verify ticket ownership
  await verifyTicketOwnership(supabase, userId, ticketId);

  // Then verify comment belongs to ticket
  const { data: comment, error } = await supabase
    .from("support_comments")
    .select("comment_id, ticket_id")
    .eq("comment_id", commentId)
    .eq("ticket_id", ticketId)
    .single();

  if (error || !comment) {
    throw new NotFoundError("Comment");
  }
}

/**
 * Verify an attachment belongs to a ticket and user owns the ticket or is admin.
 */
export async function verifyAttachmentAccess(
  supabase: SupabaseClient,
  userId: string,
  attachmentId: string
): Promise<{ ticketId: string; storagePath: string }> {
  // Get attachment with ticket info
  const { data: attachment, error } = await supabase
    .from("support_attachments")
    .select("attachment_id, comment_id, storage_path, support_comments(ticket_id, support_tickets(user_id))")
    .eq("attachment_id", attachmentId)
    .single();

  if (error || !attachment) {
    throw new NotFoundError("Attachment");
  }

  const commentData = attachment.support_comments as any;
  const ticketData = commentData?.support_tickets as any;

  if (!ticketData) {
    throw new NotFoundError("Ticket");
  }

  // Check if user is admin
  const isAdmin = await isUserAdmin(supabase, userId);

  // Verify ownership or admin
  if (ticketData.user_id !== userId && !isAdmin) {
    throw new ForbiddenError("You do not have access to this attachment");
  }

  return {
    ticketId: commentData.ticket_id,
    storagePath: attachment.storage_path,
  };
}
