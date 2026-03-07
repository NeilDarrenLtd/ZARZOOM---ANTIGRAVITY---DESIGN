import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_LOCALE, isRoutedLocale, getPublicPathSegments } from '@/lib/i18n/routing'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // API v1 routes handle their own auth -- skip Supabase session refresh
  if (pathname.startsWith('/api/v1')) {
    return NextResponse.next()
  }

  // ── Locale routing: public pages get [locale] prefix; only en/fr supported ──
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]

  // Root → default locale
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone()
    url.pathname = `/${DEFAULT_LOCALE}`
    return NextResponse.redirect(url)
  }

  // First segment is a locale: set locale cookie (so login/app preserve language) then continue
  if (isRoutedLocale(first)) {
    const response = await updateSession(request)
    response.cookies.set('locale', first, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    })
    return response
  }

  // First segment is a public path (no locale) → redirect to default locale
  const publicSegments = getPublicPathSegments()
  if (publicSegments.includes(first)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${DEFAULT_LOCALE}/${pathname.slice(1)}`
    return NextResponse.redirect(url)
  }

  // First segment looks like a locale but is not supported (e.g. /de/...) → redirect to default locale path
  if (segments.length >= 1 && first.length <= 5 && /^[a-z]{2}(-[a-z]{2})?$/i.test(first)) {
    const url = request.nextUrl.clone()
    const rest = segments.slice(1).join('/')
    url.pathname = rest ? `/${DEFAULT_LOCALE}/${rest}` : `/${DEFAULT_LOCALE}`
    return NextResponse.redirect(url)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sequence|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
