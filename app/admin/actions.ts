"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

// ─── Auth guard ────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Quick check via JWT metadata first (no DB query needed)
  if (user.user_metadata?.is_admin === true) {
    return user;
  }

  // Fall back to profiles table check using admin client to bypass RLS
  const adminSupabase = await createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Not authorised");
  }

  return user;
}

// ─── Settings CRUD (uses site_settings table) ──────────────────
// Settings are stored as key/value pairs. Secrets are marked encrypted=true
// and their values are NOT returned to the client after save.

export async function getSettings(prefix: string) {
  await requireAdmin();
  // Use admin client (service role) to bypass RLS for settings reads
  const supabase = await createAdminClient();

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
  // Use admin client (service role) to bypass RLS for settings writes
  const supabase = await createAdminClient();

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

// ─── Configure Supabase OAuth provider via Management API ──────
// This actually enables/disables providers in Supabase Auth itself,
// so signInWithOAuth calls work for users.
export async function configureSupabaseOAuthProvider(
  providerId: string,
  clientId: string,
  clientSecret: string,
  enabled: boolean
) {
  await requireAdmin();

  const supabaseRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)/
  )?.[1];

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseRef || !serviceRoleKey) {
    return { error: "Missing Supabase project configuration." };
  }

  // Map provider IDs to Supabase Management API field names
  const providerMap: Record<string, string> = {
    google: "google",
    facebook: "facebook",
    linkedin: "linkedin_oidc",
    twitter: "twitter",
  };

  const supabaseProvider = providerMap[providerId] || providerId;

  // Build the auth config update payload
  const payload: Record<string, unknown> = {
    [`external_${supabaseProvider}_enabled`]: enabled,
  };

  // Only send client_id and secret if we have them (don't clear existing ones)
  if (clientId) {
    payload[`external_${supabaseProvider}_client_id`] = clientId;
  }
  if (clientSecret) {
    payload[`external_${supabaseProvider}_secret`] = clientSecret;
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${supabaseRef}/config/auth`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[OAuth Config] Supabase API error:", response.status, errBody);
      return { error: `Failed to update Supabase auth config: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[OAuth Config] Network error:", err);
    return { error: "Failed to connect to Supabase Management API." };
  }
}

// ─── Get current Supabase OAuth provider status ────────────────
export async function getSupabaseOAuthStatus() {
  await requireAdmin();

  const supabaseRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)/
  )?.[1];

  if (!supabaseRef || !process.env.SUPABASE_ACCESS_TOKEN) {
    return { error: "Missing Supabase access token.", providers: {} };
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${supabaseRef}/config/auth`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return { error: "Failed to read Supabase auth config.", providers: {} };
    }

    const config = await response.json();

    const providers: Record<string, { enabled: boolean; hasClientId: boolean }> = {
      google: {
        enabled: config.external_google_enabled === true,
        hasClientId: !!config.external_google_client_id,
      },
      facebook: {
        enabled: config.external_facebook_enabled === true,
        hasClientId: !!config.external_facebook_client_id,
      },
      linkedin: {
        enabled: config.external_linkedin_oidc_enabled === true,
        hasClientId: !!config.external_linkedin_oidc_client_id,
      },
      twitter: {
        enabled: config.external_twitter_enabled === true,
        hasClientId: !!config.external_twitter_client_id,
      },
    };

    return { providers };
  } catch {
    return { error: "Failed to connect to Supabase Management API.", providers: {} };
  }
}

// ─── Send real test email via SMTP ─────────────────────────────
export async function sendTestEmail(recipientEmail: string) {
  await requireAdmin();

  // Read SMTP settings from site_settings
  const supabase = await createAdminClient();
  const { data: rows, error: fetchErr } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", "smtp_%");

  if (fetchErr) return { error: fetchErr.message };

  const smtp: Record<string, string> = {};
  for (const row of rows || []) {
    smtp[row.key] = row.value ?? "";
  }

  if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
    return { error: "SMTP is not configured. Please save your SMTP settings first." };
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
      // For TLS on non-465 ports
      ...(smtp.smtp_encryption === "tls" && !secure
        ? { requireTLS: true }
        : {}),
    });

    await transporter.sendMail({
      from: `"${smtp.smtp_from_name || "ZARZOOM"}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
      to: recipientEmail,
      subject: "ZARZOOM - Test Email",
      text: "This is a test email from ZARZOOM admin panel. Your SMTP settings are working correctly!",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #16a34a;">ZARZOOM Test Email</h2>
          <p>This is a test email from the ZARZOOM admin panel.</p>
          <p style="color: #16a34a; font-weight: bold;">Your SMTP settings are working correctly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="color: #6b7280; font-size: 12px;">Sent from ZARZOOM Admin Panel</p>
        </div>
      `,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    console.error("[SMTP] Send error:", message);
    return { error: `SMTP error: ${message}` };
  }
}

// ─── User management ───────────────────────────────────────────
export async function getUsers() {
  await requireAdmin();
  // Use admin client (service role) to bypass RLS for reading all profiles
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, users: [] };
  return { users: data || [] };
}

export async function updateUserRole(userId: string, isAdmin: boolean) {
  await requireAdmin();
  // Use admin client (service role) to bypass RLS for role updates
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) return { error: error.message };
  return { success: true };
}

// ─── Get enabled OAuth providers (for auth page) ──────────────
// Returns which providers are enabled so the auth page can show/hide buttons
export async function getEnabledProviders() {
  const supabaseRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)/
  )?.[1];

  if (!supabaseRef || !process.env.SUPABASE_ACCESS_TOKEN) {
    // Fall back to checking site_settings
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .like("key", "oauth_%_enabled");

    const providers: Record<string, boolean> = {};
    for (const row of data || []) {
      const match = row.key.match(/^oauth_(\w+)_enabled$/);
      if (match) {
        providers[match[1]] = row.value === "true";
      }
    }
    return { providers };
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${supabaseRef}/config/auth`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return { providers: {} };
    }

    const config = await response.json();
    return {
      providers: {
        google: config.external_google_enabled === true,
        facebook: config.external_facebook_enabled === true,
        linkedin: config.external_linkedin_oidc_enabled === true,
        twitter: config.external_twitter_enabled === true,
      },
    };
  } catch {
    return { providers: {} };
  }
}
