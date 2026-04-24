'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { UserRole, OrderNotification } from '@/types/database'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [role,           setRole]           = useState<UserRole | null>(null)
  const [displayName,    setDisplayName]    = useState('')
  const [userId,         setUserId]         = useState('')
  const [branchName,     setBranchName]     = useState('')
  const [notifications,  setNotifications]  = useState<OrderNotification[]>([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role, display_name, branch_id').eq('id', user.id).single()
      if (cancelled || !profile) return

      setRole(profile.role as UserRole)
      setDisplayName(profile.display_name || user.email?.split('@')[0] || 'User')

      if (profile.branch_id) {
        const { data: branch } = await supabase
          .from('branches').select('name').eq('id', profile.branch_id).single()
        if (!cancelled && branch) setBranchName(branch.name)
      }
    }
    fetchUser()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!userId) return
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }

    let cancelled = false
    supabase.from('order_notifications')
      .select('*, orders(order_number, table_number, customer_name)')
      .eq('user_id', userId).eq('is_read', false)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (!cancelled && data) setNotifications(data as OrderNotification[]) })

    const channel = supabase.channel(`notif-${userId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'order_notifications', filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const { data } = await supabase.from('order_notifications')
          .select('*, orders(order_number, table_number, customer_name)')
          .eq('id', payload.new.id).single()
        if (!cancelled && data) setNotifications(prev => [data as OrderNotification, ...prev])
      })
      .subscribe()

    channelRef.current = channel
    return () => { cancelled = true; supabase.removeChannel(channel); channelRef.current = null }
  }, [userId])

  const markAllRead = async () => {
    await supabase.from('order_notifications').update({ is_read: true })
      .eq('user_id', userId).eq('is_read', false)
    setNotifications([])
    setShowNotifPanel(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (pathname.startsWith('/home/kds')) return <>{children}</>

  // Nav per role
  const navItems = [
    { href: '/home/pos',       label: '🖥️ POS',       roles: ['OWNER','ADMIN','EMPLOYEE'] as UserRole[] },
    { href: '/home/kds',       label: '🍳 Dapur',     roles: ['OWNER','ADMIN','EMPLOYEE'] as UserRole[] },
    { href: '/home/dashboard', label: '📊 Dashboard', roles: ['EMPLOYEE'] as UserRole[] },
    { href: '/home/admin',     label: '⚙️ Admin',     roles: ['ADMIN'] as UserRole[] },
    { href: '/home/owner',     label: '🏪 Cabang',    roles: ['OWNER'] as UserRole[] },
  ]

  const roleLabel = role === 'OWNER' ? '👑 Owner'
    : role === 'ADMIN' ? '🛡️ Admin'
    : '👤 Pegawai'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0">
        <Link href="/home" className="flex items-center gap-2">
          <span>🍽️</span>
          <span className="font-bold text-sm hidden sm:block">kasir-dapur</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems
            .filter(item => !role || item.roles.includes(role))
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

        <div className="flex items-center gap-2">
          {/* Info sesi — nama + role + cabang */}
          {displayName && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-orange-400">{displayName}</span>
              <span className="text-xs text-gray-600">
                {roleLabel}{branchName ? ` · ${branchName}` : ''}
              </span>
            </div>
          )}

          {/* Bell notifikasi */}
          <div className="relative">
            <button onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
              🔔
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full
                  text-white text-xs font-black flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {showNotifPanel && (
              <div className="absolute right-0 top-9 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
                  <span className="text-sm font-bold">Notifikasi</span>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} className="text-xs text-orange-400">Tandai semua dibaca</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0
                    ? <p className="text-xs text-gray-600 text-center py-6">Tidak ada notifikasi baru</p>
                    : notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-gray-800 last:border-0">
                        <p className="text-sm text-white font-semibold">🍽️ Pesanan Siap!</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(n.orders as any)?.order_number} — Meja {(n.orders as any)?.table_number}
                        </p>
                      </div>
                    ))
                  }
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

      <main className="flex-1 flex flex-col min-h-0">{children}</main>
    </div>
  )
}