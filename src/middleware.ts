// src/middleware.ts
// UPDATE: file baru — proteksi rute berdasarkan status login + role
//
// Cara kerja middleware Next.js:
// - Dijalankan di Edge Runtime SEBELUM setiap request diteruskan ke halaman
// - Di sini kita cek apakah user sudah login, lalu redirect sesuai kebutuhan
//
// Alur:
// - Belum login → redirect ke /login (kecuali sudah di halaman publik)
// - Sudah login + akses /login → redirect ke /home
// - Sudah login + akses /home/admin + bukan OWNER → redirect ke /home

import { createServerClient } from '@supabase/ssr'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'

export async function middleware(request: NextRequest) {
  // Buat response awal — akan dimodifikasi kalau perlu redirect
  let supabaseResponse = NextResponse.next({ request })

  // Buat Supabase client yang bisa baca/set cookie dari request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookie di request & response agar sesi tetap fresh
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Ambil user dari sesi — JANGAN pakai getSession() karena bisa di-spoof
  // getUser() verifikasi langsung ke Supabase Auth server
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Halaman publik — tidak perlu login
  const isPublicPath = pathname.startsWith('/login')
    || pathname.startsWith('/register')
    || pathname.startsWith('/auth/callback')

  if (isPublicPath) {
    // Kalau sudah login dan coba akses login/register → langsung ke /home
    if (user && !pathname.startsWith('/auth/callback')) {
      return NextResponse.redirect(new URL('/home', request.url))
    }
    return supabaseResponse
  }

  // Belum login dan bukan halaman publik → ke login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Proteksi halaman admin — hanya OWNER yang boleh masuk
  if (pathname.startsWith('/home/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'OWNER') {
      // Bukan owner → redirect ke homepage biasa
      return NextResponse.redirect(new URL('/home', request.url))
    }
  }

  return supabaseResponse
}

// Matcher: jalankan middleware di semua route kecuali file statis
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}