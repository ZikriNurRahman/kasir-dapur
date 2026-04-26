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

  // Detect branch param dari URL (untuk OWNER yang lagi di panel admin cabang)
  const [ownerBranchParam, setOwnerBranchParam] = useState<string | null>(null)

  const [ownerActiveBranchName, setOwnerActiveBranchName] = useState('')


  // Update ownerBranchParam setiap kali pathname berubah
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const branchParam = params.get('branch')
      setOwnerBranchParam(branchParam)

      // Fetch nama cabang untuk owner yang lagi di branch
      if (branchParam && role === 'OWNER') {
        supabase.from('branches').select('name').eq('id', branchParam).single()
          .then(({ data }) => { if (data) setOwnerActiveBranchName(data.name) })
      } else {
        setOwnerActiveBranchName('')
      }
    }
  }, [pathname, role])

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (!session) {
        // Reset state lama biar info akun tidak tertinggal
        setRole(null)
        setDisplayName('')
        setUserId('')
        setBranchName('')
        router.replace('/login')
      } else {
        // Akun baru login → re-fetch data user terbaru
        fetchUser()
      }
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
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
        const notif = payload.new as OrderNotification
        const { data: order } = await supabase
          .from('orders')
          .select('order_number, table_number, customer_name')
          .eq('id', notif.order_id)
          .single()
        if (!cancelled) {
          setNotifications(prev => [{ ...notif, orders: order } as OrderNotification, ...prev])
        }
      })
      // FIX: tambah listener UPDATE — hapus dari state lokal kalau is_read jadi true
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'order_notifications', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.new.is_read === true) {
          // Langsung hapus dari state tanpa perlu fetch ulang
          setNotifications(prev => prev.filter(n => n.id !== payload.new.id))
        }
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

  // OWNER yang sedang di admin panel suatu cabang → tampilkan POS & KDS
  const ownerInBranch = role === 'OWNER' && ownerBranchParam != null && pathname.startsWith('/home/admin')

  // Nav items — POS/KDS hanya muncul untuk:
  // 1. ADMIN dan EMPLOYEE (selalu)
  // 2. OWNER yang sedang dalam konteks admin panel cabang
  const showPosKds = role === 'ADMIN' || role === 'EMPLOYEE' || ownerInBranch

  // Link POS/KDS untuk owner: sertakan branch param agar context tidak hilang
  const posHref = ownerInBranch ? `/home/pos?branch=${ownerBranchParam}` : '/home/pos'
  const kdsHref = ownerInBranch ? `/home/kds?branch=${ownerBranchParam}` : '/home/kds'

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
          {/* POS & KDS — tampil untuk ADMIN/EMPLOYEE atau OWNER yang lagi di branch */}
          {role !== null && showPosKds && (
            <>
              <Link href={posHref}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${pathname.startsWith('/home/pos')
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                🖥️ POS
              </Link>
              <Link href={kdsHref}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${pathname.startsWith('/home/kds')
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                🍳 Dapur
              </Link>
            </>
          )}

          {/* Dashboard — hanya EMPLOYEE */}
          {role !== null && role === 'EMPLOYEE' && (
            <Link href="/home/dashboard"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${pathname.startsWith('/home/dashboard')
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              📊 Dashboard
            </Link>
          )}

          {/* Admin — ADMIN dan OWNER yang dalam konteks branch */}
          {role !== null && (role === 'ADMIN' || ownerInBranch) && (
            <Link
              href={ownerInBranch
                ? `/home/admin?branch=${ownerBranchParam}`
                : '/home/admin'}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${pathname.startsWith('/home/admin')
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              ⚙️ Admin
            </Link>
          )}

          {/* Cabang — hanya OWNER, dan hanya ketika tidak sedang di dalam branch */}
          {role === 'OWNER' && (
            <Link href="/home/owner"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${pathname.startsWith('/home/owner')
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              🏪 Cabang
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {displayName && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-orange-400">{displayName}</span>
              <span className="text-xs text-gray-600">
                {roleLabel}
                {/* Untuk owner yang lagi di branch, tampilkan nama cabang */}
                {ownerInBranch && ownerActiveBranchName
                  ? ` · ${ownerActiveBranchName}`
                  : branchName ? ` · ${branchName}` : ''
                }
              </span>
            </div>
          )}

          {/* Bell notif — sembunyikan untuk OWNER di /home/owner */}
          {(role !== 'OWNER' || ownerInBranch) && (
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
                      <button onClick={markAllRead} className="text-xs text-orange-400">
                        Tandai semua dibaca
                      </button>
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
          )}

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