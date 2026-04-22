import { createBrowserClient } from '@supabase/ssr'

// Singleton — satu instance untuk seluruh aplikasi
// NEXT_PUBLIC_ agar bisa diakses dari browser (client component)
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // {
  //   realtime: {
  //     timeout: 30000, // 30 detik — lebih toleran di jaringan restoran
  //   },
  // }
)