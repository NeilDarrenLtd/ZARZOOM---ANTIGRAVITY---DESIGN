import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/api/env";

/**
 * Support ticket email notifications using existing SMTP infrastructure.
 * Reads SMTP settings from site_settings table and sends emails via nodemailer.
 */

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Get SMTP configuration from site_settings
 */
async function getSmtpConfig() {
  const supabase = await createAdminClient();
  const { data: rows, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", "smtp_%");

  if (error) {
    console.error("[SupportMailer] Failed to fetch SMTP settings:", error);
    return null;
  }

  const smtp: Record<string, string> = {};
  for (const row of rows || []) {
    smtp[row.key] = row.value ?? "";
  }

  if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
    console.warn("[SupportMailer] SMTP not configured");
    return null;
  }

  return smtp;
}

/**
 * Send an email using the configured SMTP server
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  const smtp = await getSmtpConfig();
  if (!smtp) {
    console.error("[SupportMailer] Cannot send email: SMTP not configured");
    return false;
  }

  try {
    const nodemailer = await import("nodemailer");

    const port = parseInt(smtp.smtp_port || "587", 10);
    const secure = smtp.smtp_encryption === "ssl" || port === 465;

    const transporter = nodemailer.default.createTransport({
      host: smtp.smtp_host,
      port,
      secure,
      auth: {
        user: smtp.smtp_user,
        pass: smtp.smtp_pass,
      },
      ...(smtp.smtp_encryption === "tls" && !secure ? { requireTLS: true } : {}),
    });

    await transporter.sendMail({
      from: `"${smtp.smtp_from_name || "ZARZOOM"}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log("[SupportMailer] Email sent successfully to:", options.to);
    return true;
  } catch (err) {
    console.error("[SupportMailer] Failed to send email:", err);
    return false;
  }
}

/**
 * Get the base URL for generating deep links
 */
function getBaseUrl(): string {
  return env().SITE_URL || env().NEXT_PUBLIC_APP_URL;
}

/**
 * Get the support recipient email from support_settings table
 */
async function getSupportRecipientEmail(): Promise<string | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("support_settings")
    .select("recipient_email")
    .single();

  if (error || !data?.recipient_email) {
    console.warn("[SupportMailer] No support recipient email configured");
    return null;
  }

  return data.recipient_email;
}

/**
 * Email templates
 */

function createEmailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
            <div style="background: #16a34a; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">ZARZOOM Support</h1>
            </div>
            <div style="padding: 24px;">
              ${content}
            </div>
            <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                This is an automated message from ZARZOOM Support System
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 1) User creates ticket → Email to support team
 */
export async function sendNewTicketNotification(params: {
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  firstMessage: string;
}): Promise<boolean> {
  const recipientEmail = await getSupportRecipientEmail();
  if (!recipientEmail) return false;

  const baseUrl = getBaseUrl();
  const adminLink = `${baseUrl}/admin/support/tickets/${params.ticketId}`;

  // Truncate message if too long
  const messageTruncated =
    params.firstMessage.length > 500
      ? params.firstMessage.substring(0, 500) + "..."
      : params.firstMessage;

  const subject = `New Support Ticket #${params.ticketId}: ${params.ticketSubject}`;

  const html = createEmailWrapper(`
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">New Support Ticket</h2>
    <div style="background: #f9fafb; border-left: 4px solid #16a34a; padding: 12px 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Ticket ID:</p>
      <p style="margin: 0; color: #6b7280; font-family: monospace;">#${params.ticketId}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Subject:</p>
      <p style="margin: 0; color: #111827;">${params.ticketSubject}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">From:</p>
      <p style="margin: 0; color: #111827;">${params.userEmail}</p>
    </div>
    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Message:</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; color: #374151; white-space: pre-wrap;">${messageTruncated}</div>
    </div>
    <a href="${adminLink}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Ticket in Admin Panel
    </a>
  `);

  const text = `
New Support Ticket #${params.ticketId}

Subject: ${params.ticketSubject}
From: ${params.userEmail}

Message:
${messageTruncated}

View ticket: ${adminLink}
  `.trim();

  return sendEmail({ to: recipientEmail, subject, text, html });
}

/**
 * 2) User adds comment → Email to support team
 */
export async function sendUserCommentNotification(params: {
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  commentText: string;
}): Promise<boolean> {
  const recipientEmail = await getSupportRecipientEmail();
  if (!recipientEmail) return false;

  const baseUrl = getBaseUrl();
  const adminLink = `${baseUrl}/admin/support/tickets/${params.ticketId}`;

  const commentTruncated =
    params.commentText.length > 500
      ? params.commentText.substring(0, 500) + "..."
      : params.commentText;

  const subject = `New Comment on Ticket #${params.ticketId}: ${params.ticketSubject}`;

  const html = createEmailWrapper(`
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">New Comment from User</h2>
    <div style="background: #f9fafb; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Ticket ID:</p>
      <p style="margin: 0; color: #6b7280; font-family: monospace;">#${params.ticketId}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Subject:</p>
      <p style="margin: 0; color: #111827;">${params.ticketSubject}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">From:</p>
      <p style="margin: 0; color: #111827;">${params.userEmail}</p>
    </div>
    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Comment:</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; color: #374151; white-space: pre-wrap;">${commentTruncated}</div>
    </div>
    ${params.commentText.includes("attachment") ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">View attachments in the ticket.</p>` : ""}
    <a href="${adminLink}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Ticket in Admin Panel
    </a>
  `);

  const text = `
New Comment on Ticket #${params.ticketId}

Subject: ${params.ticketSubject}
From: ${params.userEmail}

Comment:
${commentTruncated}

View ticket: ${adminLink}
  `.trim();

  return sendEmail({ to: recipientEmail, subject, text, html });
}

/**
 * 3) Admin adds comment → Email to ticket owner
 */
export async function sendAdminCommentNotification(params: {
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  adminComment: string;
}): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const userLink = `${baseUrl}/dashboard/support/tickets/${params.ticketId}`;

  const commentTruncated =
    params.adminComment.length > 500
      ? params.adminComment.substring(0, 500) + "..."
      : params.adminComment;

  const subject = `Support Team replied to your ticket #${params.ticketId}`;

  const html = createEmailWrapper(`
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">New Reply from Support Team</h2>
    <div style="background: #f9fafb; border-left: 4px solid #16a34a; padding: 12px 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Ticket ID:</p>
      <p style="margin: 0; color: #6b7280; font-family: monospace;">#${params.ticketId}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Subject:</p>
      <p style="margin: 0; color: #111827;">${params.ticketSubject}</p>
    </div>
    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Support Team Response:</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 12px; color: #374151; white-space: pre-wrap;">${commentTruncated}</div>
    </div>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
      View attachments and continue the conversation in your ticket.
    </p>
    <a href="${userLink}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Your Ticket
    </a>
  `);

  const text = `
Support Team replied to your ticket #${params.ticketId}

Subject: ${params.ticketSubject}

Response:
${commentTruncated}

View ticket: ${userLink}
  `.trim();

  return sendEmail({ to: params.userEmail, subject, text, html });
}

/**
 * 4) Admin changes status → Email to ticket owner
 */
export async function sendStatusChangeNotification(params: {
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  oldStatus: string;
  newStatus: string;
}): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const userLink = `${baseUrl}/dashboard/support/tickets/${params.ticketId}`;

  const statusLabels: Record<string, string> = {
    open: "Open",
    investigating: "Investigating",
    waiting_on_user: "Waiting on You",
    resolved: "Resolved",
    closed: "Closed",
  };

  const newStatusLabel = statusLabels[params.newStatus] || params.newStatus;

  const subject = `Your ticket #${params.ticketId} status changed to ${newStatusLabel}`;

  const html = createEmailWrapper(`
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Ticket Status Updated</h2>
    <div style="background: #f9fafb; border-left: 4px solid #8b5cf6; padding: 12px 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Ticket ID:</p>
      <p style="margin: 0; color: #6b7280; font-family: monospace;">#${params.ticketId}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Subject:</p>
      <p style="margin: 0; color: #111827;">${params.ticketSubject}</p>
    </div>
    <div style="margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Status Changed:</p>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="background: #e5e7eb; color: #6b7280; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">${statusLabels[params.oldStatus] || params.oldStatus}</span>
        <span style="color: #6b7280;">→</span>
        <span style="background: #16a34a; color: white; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">${newStatusLabel}</span>
      </div>
    </div>
    <a href="${userLink}" style="display: inline-block; background: #8b5cf6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Your Ticket
    </a>
  `);

  const text = `
Your ticket status has been updated

Ticket ID: #${params.ticketId}
Subject: ${params.ticketSubject}

Status: ${statusLabels[params.oldStatus] || params.oldStatus} → ${newStatusLabel}

View ticket: ${userLink}
  `.trim();

  return sendEmail({ to: params.userEmail, subject, text, html });
}
