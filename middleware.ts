import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // API v1 routes handle their own auth -- skip Supabase session refresh
  if (request.nextUrl.pathname.startsWith('/api/v1')) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sequence|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
