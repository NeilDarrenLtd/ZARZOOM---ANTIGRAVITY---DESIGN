import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/api/env'

export async function updateSession(request: NextRequest) {
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/engine') ||
    request.nextUrl.pathname.startsWith('/onboarding') ||
    (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login'))

  // Routes that HARD-gate onboarding (no access unless completed)
  const isEngineRoute = request.nextUrl.pathname.startsWith('/engine')
  // Dashboard is always reachable when authenticated; OnboardingBanner prompts to complete/skip.
  // Only /engine is hard-gated so users never get stuck in the wizard.

  // For public routes, skip Supabase auth entirely to avoid blocking page loads
  if (!isProtectedRoute) {
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env()
    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Protect /dashboard routes - redirect to login if not authenticated
    if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }

    // Protect /onboarding routes - redirect to login if not authenticated
    if (request.nextUrl.pathname.startsWith('/onboarding') && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }

    // Protect /admin routes - redirect to admin login if not authenticated
    if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login') && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // ── Suspension guard ────────────────────────────────────────────
    // Check if user is suspended (for ALL protected routes)
    if (user && !request.nextUrl.pathname.startsWith('/suspended')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_suspended')
        .eq('id', user.id)
        .single()

      if (profile?.is_suspended) {
        // Sign the user out and redirect to suspended page
        const url = request.nextUrl.clone()
        url.pathname = '/suspended'
        return NextResponse.redirect(url)
      }
    }

    // ── Onboarding guard ──────────────────────────────────────────
    // Only /engine is hard-gated (must have completed onboarding).
    // Dashboard is always allowed when authenticated; OnboardingBanner on dashboard
    // prompts incomplete/skipped users, so no one gets stuck in the wizard.
    if (isEngineRoute && user) {
      const activeWorkspaceId = request.cookies.get('active_workspace_id')?.value?.trim()
      if (activeWorkspaceId) {
        const { data: profile } = await supabase
          .from('onboarding_profiles')
          .select('onboarding_status')
          .eq('tenant_id', activeWorkspaceId)
          .maybeSingle()

        const status = profile?.onboarding_status ?? 'not_started'
        if (status !== 'completed') {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          return NextResponse.redirect(url)
        }
      }
    }

    // If user is on /admin, check if they are admin
    if (request.nextUrl.pathname.startsWith('/admin') && user) {
      const isAdmin = user.user_metadata?.is_admin === true
      if (!isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch {
    // If Supabase auth fails, redirect protected routes to login
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }
}
