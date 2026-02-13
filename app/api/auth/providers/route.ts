import { getEnabledProviders } from "@/app/admin/actions";
import { NextResponse } from "next/server";

export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
  try {
    const result = await getEnabledProviders();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ providers: {} });
  }
}
