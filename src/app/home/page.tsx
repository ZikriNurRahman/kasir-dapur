'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

export default function HomePage() {
  const router = useRouter()
  const [role,    setRole]    = useState<UserRole | null>(null)
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(true)   // ← tambah loading

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: p } = await supabase.from('profiles')
        .select('role, display_name').eq('id', user.id).single()
      if (p) {
        setRole(p.role as UserRole)
        setName(p.display_name || user.email?.split('@')[0] || '')
      }
      setLoading(false)   // ← set false setelah data ada
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (role === 'OWNER') router.replace('/home/owner')
  }, [role, router])

  const cards = [
    { href: '/home/pos',       icon: '🖥️', title: 'POS Kasir',
      desc: 'Input pesanan, kelola cart, checkout ke dapur',
      color: 'border-orange-800 hover:border-orange-600',
      roles: ['ADMIN', 'EMPLOYEE'] as UserRole[] },
    { href: '/home/kds',       icon: '🍳', title: 'Dapur (KDS)',
      desc: 'Terima pesanan real-time, ceklis per item',
      color: 'border-green-800 hover:border-green-600',
      roles: ['ADMIN', 'EMPLOYEE'] as UserRole[] },
    { href: '/home/dashboard', icon: '📊', title: 'Dashboard Saya',
      desc: 'Riwayat pesanan yang kamu layani hari ini',
      color: 'border-blue-800 hover:border-blue-600',
      roles: ['EMPLOYEE'] as UserRole[] },
    { href: '/home/admin',     icon: '⚙️', title: 'Admin',
      desc: 'Kelola menu, stok, pegawai, dan laporan',
      color: 'border-purple-800 hover:border-purple-600',
      roles: ['ADMIN'] as UserRole[] },
  ]

  if (loading || role === 'OWNER') return null   // ← jangan render apapun dulu

  // ↓ filter hanya jalan kalau role sudah terisi (bukan null)
  const visibleCards = cards.filter(c => role !== null && c.roles.includes(role))
  const roleLabel = role === 'ADMIN' ? '🛡️ Admin' : '👤 Pegawai'

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold text-white">Selamat datang, {name}!</h1>
        {role && (
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
            role === 'ADMIN' ? 'bg-purple-950 text-purple-400' : 'bg-gray-800 text-gray-400'
          }`}>{roleLabel}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {visibleCards.map(card => (
          <button key={card.href} onClick={() => router.push(card.href)}
            className={`bg-gray-900 border-2 rounded-xl p-6 text-left
              transition-all hover:bg-gray-800 active:scale-95 ${card.color}`}>
            <div className="text-3xl mb-3">{card.icon}</div>
            <div className="font-bold text-white text-base mb-1">{card.title}</div>
            <div className="text-xs text-gray-500 leading-relaxed">{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}