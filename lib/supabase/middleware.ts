import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/engine') ||
    request.nextUrl.pathname.startsWith('/onboarding') ||
    (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login'))

  // Routes that HARD-gate onboarding (no access unless completed)
  const isEngineRoute = request.nextUrl.pathname.startsWith('/engine')

  // Routes that SOFT-gate onboarding (allow access but show banner if not completed)
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')

  // Combined: any route that should redirect brand-new / in_progress users
  const isOnboardingGuardedRoute = isEngineRoute || isDashboardRoute

  // For public routes, skip Supabase auth entirely to avoid blocking page loads
  if (!isProtectedRoute) {
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    // Engine routes: hard-gate (only completed users may enter)
    // Dashboard routes: soft-gate (skipped users may enter but see banner;
    //   not_started / in_progress users are redirected to /onboarding)
    if (isOnboardingGuardedRoute && user) {
      const { data: profile } = await supabase
        .from('onboarding_profiles')
        .select('onboarding_status')
        .eq('user_id', user.id)
        .single()

      const status = profile?.onboarding_status ?? 'not_started'

      if (isEngineRoute && status !== 'completed') {
        // Engine is fully blocked until onboarding is completed
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      if (isDashboardRoute && status !== 'completed' && status !== 'skipped') {
        // Dashboard allows completed + skipped; everything else → onboarding
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
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
