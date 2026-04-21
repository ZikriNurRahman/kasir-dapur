// src/lib/supabase-server.ts
// UPDATE: file baru — client Supabase untuk Server Components
//
// Kenapa perlu file ini?
// - supabase.ts yang lama pakai createClient biasa (browser client)
// - Server Components di Next.js App Router butuh client berbeda
//   yang bisa baca/set cookies dari request HTTP
// - @supabase/ssr menyediakan createServerClient untuk keperluan ini

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  // cookies() mengembalikan cookie store dari request yang sedang diproses
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Baca semua cookie — untuk verifikasi sesi user
        getAll() {
          return cookieStore.getAll()
        },
        // Set cookie — untuk refresh token otomatis
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Di Server Components read-only context, set bisa gagal — itu normal
            // Middleware yang akan handle refresh token
          }
        },
      },
    }
  )
}