"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || headersList.get("host") || "";
  const protocol = origin.startsWith("localhost") ? "http" : "https";
  const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;

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
  const headersList = await headers();
  const origin = headersList.get("origin") || headersList.get("host") || "";
  const protocol = origin.startsWith("localhost") ? "http" : "https";
  const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;

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
  const headersList = await headers();
  const origin = headersList.get("origin") || headersList.get("host") || "";
  const protocol = origin.startsWith("localhost") ? "http" : "https";
  const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;

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

  // Check if user has admin role via metadata or profiles table
  const isAdminMeta = data.user?.user_metadata?.is_admin === true;
  if (!isAdminMeta) {
    const { data: profile } = await supabase
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
