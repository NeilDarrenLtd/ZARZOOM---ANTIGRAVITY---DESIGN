import type { GetPlansResponse } from "@/lib/billing/api-types";

/**
 * Fetch all active plans with prices from the API.
 * This is the single source of truth for pricing data.
 * 
 * @returns Typed API response with plans array
 * @throws Error if fetch fails
 */
export async function fetchPlans(): Promise<GetPlansResponse> {
  try {
    const response = await fetch("/api/v1/billing/plans", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store", // Always get fresh pricing data
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response shape
    if (!data || typeof data !== "object" || !Array.isArray(data.plans)) {
      throw new Error("Invalid API response format");
    }

    return data as GetPlansResponse;
  } catch (error) {
    console.error("[v0] Failed to fetch plans:", error);
    // Return empty but valid response on failure
    return { plans: [] };
  }
}

/**
 * Server-side fetch for RSC (React Server Components).
 * Uses absolute URL for server-side requests.
 */
export async function fetchPlansServer(baseUrl: string): Promise<GetPlansResponse> {
  try {
    const url = `${baseUrl}/api/v1/billing/plans`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 120 }, // Cache for 2 minutes on server
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || typeof data !== "object" || !Array.isArray(data.plans)) {
      throw new Error("Invalid API response format");
    }

    return data as GetPlansResponse;
  } catch (error) {
    console.error("[v0] Failed to fetch plans (server):", error);
    return { plans: [] };
  }
}
