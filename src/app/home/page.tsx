'use client'
// src/app/home/page.tsx
// UPDATE: halaman baru — homepage setelah login
//
// Menampilkan kartu navigasi ke POS, KDS, dan Admin (kalau OWNER)
// Juga tampilkan greeting dan ringkasan singkat

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

export default function HomePage() {
  const router = useRouter()
  const [role,  setRole]  = useState<UserRole | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) setRole(profile.role as UserRole)
    }
    fetchUser()
  }, [])

  const cards = [
    {
      href:  '/home/pos',
      icon:  '🖥️',
      title: 'POS Kasir',
      desc:  'Input pesanan, kelola cart, checkout ke dapur',
      color: 'border-orange-800 hover:border-orange-600',
      roles: ['OWNER', 'EMPLOYEE'] as UserRole[],
    },
    {
      href:  '/home/kds',
      icon:  '🍳',
      title: 'Dapur (KDS)',
      desc:  'Terima pesanan real-time, ceklis per item, tandai siap',
      color: 'border-green-800 hover:border-green-600',
      roles: ['OWNER', 'EMPLOYEE'] as UserRole[],
    },
    {
      href:  '/home/admin',
      icon:  '⚙️',
      title: 'Admin',
      desc:  'Kelola menu & stok, laporan penjualan harian',
      color: 'border-blue-800 hover:border-blue-600',
      roles: ['OWNER'] as UserRole[],
    },
  ]

  const visibleCards = cards.filter(c => !role || c.roles.includes(role))

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      {/* Greeting */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold text-white">Selamat datang!</h1>
        {email && (
          <p className="text-gray-500 text-sm mt-1">{email}</p>
        )}
        {role && (
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
            role === 'OWNER' ? 'bg-orange-950 text-orange-400' : 'bg-gray-800 text-gray-400'
          }`}>
            {role === 'OWNER' ? '👑 Pemilik Toko' : '👤 Pegawai'}
          </span>
        )}
      </div>

      {/* Kartu navigasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl">
        {visibleCards.map(card => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className={`bg-gray-900 border-2 rounded-xl p-6 text-left
              transition-all hover:bg-gray-800 active:scale-95 ${card.color}`}
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <div className="font-bold text-white text-base mb-1">{card.title}</div>
            <div className="text-xs text-gray-500 leading-relaxed">{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}