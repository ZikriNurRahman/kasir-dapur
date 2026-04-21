'use client'
// src/app/home/layout.tsx
// UPDATE: layout baru untuk semua halaman /home/*
//
// Yang berubah dari sebelumnya:
// - Ada header dengan navigasi global
// - Tombol sign out
// - Link ke /home/pos, /home/kds, /home/admin (admin hanya muncul kalau OWNER)
//
// Ini client component karena perlu baca role user dan handle sign out

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router    = useRouter()
  const pathname  = usePathname()
  const [role, setRole] = useState<UserRole | null>(null)

  // Ambil role user saat komponen pertama kali mount
  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) setRole(profile.role as UserRole)
    }
    fetchRole()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Kalau halaman /home/kds — tampilkan tanpa header (fullscreen untuk dapur)
  if (pathname.startsWith('/home/kds')) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header global */}
      <header className="px-5 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0">
        <Link href="/home" className="flex items-center gap-2">
          <span className="text-lg">🍽️</span>
          <span className="font-bold text-sm text-white">kasir-dapur</span>
        </Link>

        {/* Navigasi halaman */}
        <nav className="flex items-center gap-1">
          {[
            { href: '/home/pos',   label: '🖥️ POS',    roles: ['OWNER', 'EMPLOYEE'] },
            { href: '/home/kds',   label: '🍳 Dapur',  roles: ['OWNER', 'EMPLOYEE'] },
            { href: '/home/admin', label: '⚙️ Admin',  roles: ['OWNER'] },
          ].filter(item => !role || item.roles.includes(role))
           .map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                pathname.startsWith(item.href)
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Tombol sign out */}
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
        >
          Keluar
        </button>
      </header>

      {/* Konten halaman */}
      <main className="flex-1 flex flex-col min-h-0">
        {children}
      </main>
    </div>
  )
}