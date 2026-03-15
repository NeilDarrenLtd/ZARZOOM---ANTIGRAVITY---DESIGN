/**
 * POST /api/v1/admin/settings/openrouter-prompts/test
 *
 * Admin-only endpoint that sends a free-form prompt through the existing
 * OpenRouter pipeline (same client, retry, timeout, JSON parsing logic) and
 * returns the raw result for inspection.
 *
 * Reuses: callOpenRouter from lib/openrouter/client.ts
 * Auth:   same admin guard as the parent settings route
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";
import { callOpenRouter, OpenRouterError } from "@/lib/openrouter/client";
import { logActivity } from "@/lib/logging/activity";
import { z } from "zod";

const RequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(50000),
  model: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  try {
    // ── Auth: admin only ────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return NextResponse.json(
        { error: { message: "Forbidden: Admin access required" } },
        { status: 403 }
      );
    }

    // ── Parse & validate body ───────────────────────────────────────────
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { prompt, model: modelOverride } = parsed.data;

    // ── Resolve API key + model from saved settings ─────────────────────
    const { data: settings } = await supabase
      .from("wizard_autofill_settings")
      .select("openrouter_api_key, openrouter_model")
      .eq("id", 1)
      .maybeSingle();

    const envKey = process.env.OPENROUTER_API_KEY;
    const dbKey = settings?.openrouter_api_key ?? null;
    const apiKey = envKey ?? dbKey ?? null;
    const keySource = envKey ? "env" : dbKey ? "db" : "none";
    const resolvedModel =
      modelOverride ?? settings?.openrouter_model ?? "openai/gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            message:
              "No OpenRouter API key configured. Set OPENROUTER_API_KEY or configure it in Admin settings.",
          },
        },
        { status: 422 }
      );
    }

    // ── Call OpenRouter through the existing pipeline ────────────────────
    void logActivity({
      category: "admin",
      stage: "admin.test_prompt_sent",
      level: "info",
      userId: user.id,
      details: {
        model: resolvedModel,
        keySource,
        promptLength: prompt.length,
        promptFirst100: prompt.substring(0, 100),
      },
    });

    const systemPrompt =
      "You are a helpful AI assistant. Respond to the user's prompt.";

    const response = await callOpenRouter({
      model: resolvedModel,
      prompt: systemPrompt,
      input: prompt,
      temperature: 0.5,
      apiKeyOverride: apiKey,
      responseType: "text", // Free-form response; avoids 400 from models that don't support response_format.json_object
    });

    const durationMs = Date.now() - startMs;

    void logActivity({
      category: "admin",
      stage: "admin.test_prompt_success",
      level: "info",
      userId: user.id,
      details: {
        model: response.model,
        tokensUsed: response.tokensUsed,
        durationMs,
      },
    });

    return NextResponse.json({
      data: {
        output: response.data,
        model: response.model,
        tokensUsed: response.tokensUsed,
        durationMs,
        success: true,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;

    if (err instanceof OpenRouterError) {
      void logActivity({
        category: "admin",
        stage: "admin.test_prompt_failed",
        level: "error",
        details: {
          code: err.code,
          statusCode: err.statusCode,
          message: err.message,
          durationMs,
        },
      });

      return NextResponse.json(
        {
          error: {
            message: err.message,
            code: err.code,
            statusCode: err.statusCode,
          },
          durationMs,
        },
        { status: err.statusCode ?? 502 }
      );
    }

    const message =
      err instanceof Error ? err.message : "Unknown error";

    console.error("[admin/test-prompt] Unexpected error:", err);

    void logActivity({
      category: "admin",
      stage: "admin.test_prompt_failed",
      level: "error",
      details: { message, durationMs },
    });

    return NextResponse.json(
      { error: { message }, durationMs },
      { status: 500 }
    );
  }
}
