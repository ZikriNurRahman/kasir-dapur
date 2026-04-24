import { createServerClient } from '@supabase/ssr'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublicPath = pathname.startsWith('/login')
    || pathname.startsWith('/register')
    || pathname.startsWith('/auth/callback')

  if (isPublicPath) {
    if (user && !pathname.startsWith('/auth/callback'))
      return NextResponse.redirect(new URL('/home', request.url))
    return supabaseResponse
  }

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Proteksi halaman per role
  const needsRoleCheck =
    pathname.startsWith('/home/admin') ||
    pathname.startsWith('/home/owner')

  if (needsRoleCheck) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role

    // /home/owner — hanya OWNER
    if (pathname.startsWith('/home/owner') && role !== 'OWNER')
      return NextResponse.redirect(new URL('/home', request.url))

    // /home/admin — OWNER dan ADMIN
    if (pathname.startsWith('/home/admin') && !['OWNER', 'ADMIN'].includes(role ?? ''))
      return NextResponse.redirect(new URL('/home', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}