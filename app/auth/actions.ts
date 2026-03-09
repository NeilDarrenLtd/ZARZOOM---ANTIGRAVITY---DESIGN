"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * Resolves the public base URL for the app, used for OAuth and email redirects.
 * Priority: NEXT_PUBLIC_SITE_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > origin header
 */
async function getBaseUrl(): Promise<string> {
  // 1. Explicit site URL (set by admin)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  // 2. Vercel production URL (auto-provided by Vercel)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. Vercel preview/branch URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Fall back to request origin header
  const headersList = await headers();
  const origin = headersList.get("origin") || headersList.get("host") || "";
  const protocol = origin.startsWith("localhost") ? "http" : "https";
  return origin.startsWith("http") ? origin : `${protocol}://${origin}`;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Check if user is suspended
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminSupabase = await createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("is_suspended")
    .eq("id", data.user.id)
    .single();

  if (profile?.is_suspended) {
    await supabase.auth.signOut();
    return { error: "suspended", redirectTo: "/suspended" };
  }

  // Resolve onboarding-aware redirect destination
  const { resolvePostAuthRedirect } = await import(
    "@/lib/auth/postAuthRedirect"
  );
  const redirectTo = await resolvePostAuthRedirect(data.user.id);

  return { success: true, redirectTo };
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=/auth/verified`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signInWithOAuth(
  provider: "google" | "facebook" | "twitter" | "linkedin_oidc"
) {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { url: data.url };
}

export async function resendVerificationEmail(email: string) {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=/auth/verified`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signInAdmin(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Check if user has admin role via metadata first
  const isAdminMeta = data.user?.user_metadata?.is_admin === true;
  if (!isAdminMeta) {
    // Use admin client to bypass RLS and avoid recursion when checking profiles
    const { createAdminClient } = await import("@/lib/supabase/server");
    const adminSupabase = await createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_admin) {
      await supabase.auth.signOut();
      return { error: "You do not have administrator access." };
    }
  }

  return { success: true };
}

export async function requestPasswordReset(
  email: string
): Promise<{
  status: "sent_direct" | "sent_queued" | "not_found" | "error";
  message?: string;
}> {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const admin = await createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", trimmed)
      .maybeSingle();

    if (!profile) {
      return { status: "not_found" };
    }

    const baseUrl = await getBaseUrl();

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email: trimmed,
        options: {
          redirectTo: `${baseUrl}/auth/callback?next=/auth/reset-password`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[Auth] generateLink error:", linkError?.message);
      return {
        status: "error",
        message: "Unable to generate a reset link. Please try again later.",
      };
    }

    const resetLink = linkData.properties.action_link;
    const subject = "Reset your ZARZOOM password";

    const html = `
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
                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">ZARZOOM</h1>
              </div>
              <div style="padding: 24px;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Password Reset</h2>
                <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  We received a request to reset the password for your ZARZOOM account. Click the button below to choose a new password.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetLink}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    Reset Password
                  </a>
                </div>
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                  This link will expire in 24 hours. If you did not request a password reset, you can safely ignore this email.
                </p>
                <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                  If the button above doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px; word-break: break-all;">
                  ${resetLink}
                </p>
              </div>
              <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                  This is an automated message from ZARZOOM
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Reset your ZARZOOM password

We received a request to reset the password for your ZARZOOM account.

Click here to reset your password:
${resetLink}

This link will expire in 24 hours. If you did not request a password reset, you can safely ignore this email.
    `.trim();

    const { sendEmailDirect } = await import("@/lib/email/sender");
    const result = await sendEmailDirect({
      to: trimmed,
      subject,
      html,
      text,
    });

    if (result.success) {
      return { status: "sent_direct" };
    }

    console.warn(
      "[Auth] SMTP direct send failed, falling back to queue:",
      result.error
    );

    const { queueEmail } = await import("@/lib/email/queue");
    const queued = await queueEmail({
      toEmail: trimmed,
      subject,
      htmlBody: html,
      textBody: text,
      emailType: "user_password_reset",
      relatedType: "password_reset",
      relatedId: profile.id,
      createdBy: profile.id,
      priority: 10,
    });

    if (queued) {
      return { status: "sent_queued" };
    }

    return {
      status: "error",
      message: "Unable to send the reset email. Please try again later.",
    };
  } catch (err) {
    console.error("[Auth] requestPasswordReset error:", err);
    return {
      status: "error",
      message: "Something went wrong. Please try again later.",
    };
  }
}
