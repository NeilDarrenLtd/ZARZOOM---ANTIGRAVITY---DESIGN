import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/v1/onboarding/upload-logo
 * Upload a brand logo to Supabase Storage and return a public URL.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { error: "Logo must be under 2MB" },
        { status: 400 }
      );
    }

    // Build storage path: brand-logos/{userId}/{uuid}.{ext}
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${randomUUID()}.${ext}`;
    const storagePath = `${user.id}/${fileName}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("brand-logos")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-logo] Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload logo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("brand-logos")
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { error: "Failed to generate public URL" },
        { status: 500 }
      );
    }

    // Also update onboarding profile with the logo URL
    await supabase
      .from("onboarding_profiles")
      .update({ logo_url: publicUrl })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        storagePath,
      },
    });
  } catch (err) {
    console.error("[upload-logo] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
