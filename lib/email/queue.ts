import { createAdminClient } from "@/lib/supabase/server";

export type EmailQueueStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export interface QueueEmailParams {
  toEmail: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  emailType: string;
  relatedType?: string;
  relatedId?: string;
  tenantId?: string;
  createdBy?: string;
  priority?: number;
  scheduledFor?: string;
}

export interface QueuedEmail {
  id: string;
  status: EmailQueueStatus;
  to_email: string;
  to_name: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  email_type: string;
  related_type: string | null;
  related_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  queued_at: string;
  scheduled_for: string;
  sent_at: string | null;
  failed_at: string | null;
}

/**
 * Snapshots the current SMTP "from" settings so the queued email records
 * who it was intended to be sent from at enqueue time.
 */
async function snapshotFromAddress(): Promise<{
  fromEmail: string | null;
  fromName: string | null;
}> {
  try {
    const supabase = await createAdminClient();
    const { data: rows } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["smtp_from_email", "smtp_from_name", "smtp_user"]);

    const settings: Record<string, string> = {};
    for (const row of rows || []) {
      settings[row.key] = row.value ?? "";
    }

    return {
      fromEmail: settings.smtp_from_email || settings.smtp_user || null,
      fromName: settings.smtp_from_name || "ZARZOOM",
    };
  } catch {
    return { fromEmail: null, fromName: "ZARZOOM" };
  }
}

/**
 * Enqueue an email for later delivery by the external engine.
 * Returns the queue row id on success, null on failure.
 */
export async function queueEmail(
  params: QueueEmailParams
): Promise<string | null> {
  try {
    const supabase = await createAdminClient();

    const snapshot =
      params.fromEmail && params.fromName
        ? { fromEmail: params.fromEmail, fromName: params.fromName }
        : await snapshotFromAddress();

    const { data, error } = await supabase
      .from("email_queue")
      .insert({
        to_email: params.toEmail,
        to_name: params.toName ?? null,
        from_email: params.fromEmail ?? snapshot.fromEmail,
        from_name: params.fromName ?? snapshot.fromName,
        subject: params.subject,
        html_body: params.htmlBody,
        text_body: params.textBody ?? null,
        email_type: params.emailType,
        related_type: params.relatedType ?? null,
        related_id: params.relatedId ?? null,
        tenant_id: params.tenantId ?? null,
        created_by: params.createdBy ?? null,
        priority: params.priority ?? 0,
        scheduled_for: params.scheduledFor ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[EmailQueue] Failed to enqueue email:", error.message);
      return null;
    }

    console.log(
      "[EmailQueue] Enqueued:",
      data.id,
      "type:", params.emailType,
      "to:", params.toEmail
    );
    return data.id;
  } catch (err) {
    console.error("[EmailQueue] Unexpected error enqueuing email:", err);
    return null;
  }
}
