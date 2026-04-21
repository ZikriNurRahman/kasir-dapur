// src/app/page.tsx
// UPDATE: ganti halaman default Next.js → redirect ke /home atau /login
//
// Ini Server Component — bisa langsung akses sesi tanpa useEffect
// Middleware sebenarnya sudah handle redirect, tapi ini sebagai fallback

import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function RootPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  // Sudah login → ke homepage
  if (user) redirect('/home')

  // Belum login → ke halaman login
  redirect('/login')
}
