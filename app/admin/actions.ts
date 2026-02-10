"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

// ─── Auth guard ────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Check profiles table for admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin && user.user_metadata?.is_admin !== true) {
    throw new Error("Not authorised");
  }

  return user;
}

// ─── Settings CRUD (uses site_settings table) ──────────────────
// Settings are stored as key/value pairs. Secrets are marked encrypted=true
// and their values are NOT returned to the client after save.

export async function getSettings(prefix: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value, encrypted")
    .like("key", `${prefix}%`)
    .order("key");

  if (error) return { error: error.message, settings: {} };

  const settings: Record<string, string> = {};
  for (const row of data || []) {
    // Never return encrypted values to the client
    settings[row.key] = row.encrypted ? "" : (row.value ?? "");
  }

  return { settings };
}

export async function saveSettings(
  entries: { key: string; value: string; encrypted?: boolean }[]
) {
  await requireAdmin();
  const supabase = await createClient();

  for (const entry of entries) {
    // Skip empty secrets (user didn't change them)
    if (entry.encrypted && !entry.value) continue;

    const { error } = await supabase.from("site_settings").upsert(
      {
        key: entry.key,
        value: entry.value,
        encrypted: entry.encrypted ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) return { error: error.message };
  }

  return { success: true };
}

// ─── Test email (stub) ─────────────────────────────────────────
// In production this would read SMTP settings from site_settings (or env vars)
// and send a real email via nodemailer / resend / etc.
export async function sendTestEmail(recipientEmail: string) {
  await requireAdmin();

  // Stub: log what would happen
  console.log(
    `[SMTP STUB] Would send test email to ${recipientEmail} using saved SMTP settings.`
  );
  console.log(
    `[SMTP STUB] In production, read smtp_host, smtp_port, smtp_user, smtp_pass from site_settings or env vars.`
  );

  // Simulate success
  return { success: true };
}

// ─── User management ───────────────────────────────────────────
export async function getUsers() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, users: [] };
  return { users: data || [] };
}

export async function updateUserRole(userId: string, isAdmin: boolean) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) return { error: error.message };
  return { success: true };
}

// ─── Email verification stub ───────────────────────────────────
// This function represents where SMTP settings from the admin panel
// would be used to send verification emails. Currently Supabase
// handles email verification via its built-in email provider.
// When custom SMTP is configured, this function would:
// 1. Read smtp_host, smtp_port, smtp_user, smtp_pass from site_settings
// 2. Create a nodemailer transport
// 3. Send the verification email with the confirmation link
export async function sendVerificationEmail(
  _email: string,
  _verificationUrl: string
) {
  console.log(
    `[EMAIL STUB] Would send verification email using admin SMTP settings.`
  );
  console.log(
    `[EMAIL STUB] To: ${_email}, Link: ${_verificationUrl}`
  );
  return { success: true };
}
