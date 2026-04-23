'use client'
// src/app/home/layout.tsx
// V4 UPDATE:
// - Tampilkan nama user yang sedang login di header
// - Notifikasi bell untuk ORDER_READY (pesanan yang dilayani sudah siap)
// - Tampilkan branch yang aktif

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { UserRole, OrderNotification } from '@/types/database'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [role,        setRole]        = useState<UserRole | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [userId,      setUserId]      = useState<string>('')
  // Notifikasi pesanan READY untuk pelayan
  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('id', user.id)
        .single()

      if (profile) {
        setRole(profile.role as UserRole)
        setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')
      }
    }
    fetchUser()
  }, [])

  // Subscribe notifikasi ORDER_READY untuk user ini
  useEffect(() => {
    if (!userId) return

    // Fetch notifikasi yang belum dibaca
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('order_notifications')
        .select('*, orders(order_number, table_number, customer_name)')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setNotifications(data as OrderNotification[])
    }
    fetchNotifs()

    // Realtime: terima notifikasi baru
    const channel = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'order_notifications',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        // Fetch notifikasi dengan relasi order
        const { data } = await supabase
          .from('order_notifications')
          .select('*, orders(order_number, table_number, customer_name)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setNotifications(prev => [data as OrderNotification, ...prev])
          // Bunyi notifikasi via Web Audio
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const g   = ctx.createGain()
            osc.connect(g); g.connect(ctx.destination)
            osc.frequency.value = 660; osc.type = 'sine'
            g.gain.setValueAtTime(0.3, ctx.currentTime)
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
            osc.start(); osc.stop(ctx.currentTime + 0.5)
          } catch {}
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markAllRead = async () => {
    if (notifications.length === 0) return
    await supabase
      .from('order_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotifications([])
    setShowNotifPanel(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (pathname.startsWith('/home/kds')) return <>{children}</>

  const unreadCount = notifications.length

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0">

        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2">
          <span>🍽️</span>
          <span className="font-bold text-sm hidden sm:block">kasir-dapur</span>
        </Link>

        {/* Navigasi */}
        <nav className="flex items-center gap-1">
          {[
            { href: '/home/pos',   label: '🖥️ POS',   roles: ['OWNER','ADMIN','EMPLOYEE'] },
            { href: '/home/kds',   label: '🍳 Dapur', roles: ['OWNER','ADMIN','EMPLOYEE'] },
            { href: '/home/admin', label: '⚙️ Admin', roles: ['OWNER','ADMIN'] },
          ].filter(item => !role || item.roles.includes(role))
           .map(item => (
            <Link key={item.href} href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${pathname.startsWith(item.href)
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Kanan: info user + notifikasi + logout */}
        <div className="flex items-center gap-2">
          {/* Info user yang sedang login */}
          {displayName && (
            <span className="text-xs text-gray-400 hidden sm:block">
              <span className="text-orange-400 font-semibold">{displayName}</span>
              {role && <span className="ml-1 text-gray-600">· {role}</span>}
            </span>
          )}

          {/* Bell notifikasi ORDER_READY */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full
                                 text-white text-xs font-black flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Panel notifikasi */}
            {showNotifPanel && (
              <div className="absolute right-0 top-9 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
                  <span className="text-sm font-bold">Notifikasi</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-orange-400 hover:text-orange-300">
                      Tandai semua dibaca
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-6">Tidak ada notifikasi baru</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className="px-4 py-3 border-b border-gray-800 last:border-0">
                      <p className="text-sm text-white font-semibold">
                        🍽️ Pesanan Siap!
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(n.orders as any)?.order_number} — Meja {(n.orders as any)?.table_number}
                        {(n.orders as any)?.customer_name ? ` · ${(n.orders as any).customer_name}` : ''}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(n.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1">
            Keluar
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {children}
      </main>
    </div>
  )
}