// src/app/auth/callback/route.ts
// UPDATE: file baru — handler untuk link verifikasi email
//
// Ketika user klik link di email, Supabase redirect ke URL ini
// dengan query param 'code'. Kita tukar code ini jadi sesi aktif.
//
// Kenapa perlu file ini?
// Supabase Auth pakai "PKCE flow" — link email mengandung kode satu kali
// yang harus ditukar dengan token sesi. Proses ini terjadi di sini.

import { NextResponse }          from 'next/server'
import { createServerClient }    from '@supabase/ssr'
import { cookies }               from 'next/headers'
import type { NextRequest }      from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/home' // URL tujuan setelah verifikasi

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // Tukar 'code' dari URL email → sesi aktif di browser
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Verifikasi berhasil → ke homepage
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Gagal → ke halaman login dengan pesan error
  return NextResponse.redirect(`${origin}/login?error=verifikasi-gagal`)
}