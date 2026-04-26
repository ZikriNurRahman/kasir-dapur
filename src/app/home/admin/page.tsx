'use client'
// src/app/home/admin/page.tsx
// CHANGED: Admin tidak bisa assign role ADMIN/OWNER — hanya OWNER yang bisa
// CHANGED: Settings — store_name dan store_address read-only untuk ADMIN
// CHANGED: StaffRow bisa edit username dan reset password
// CHANGED: Form tambah pegawai — ADMIN hanya bisa pilih role EMPLOYEE

import { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Menu, Category, Order, Profile, UserRole } from '@/types/database'

type Tab = 'menus' | 'categories' | 'staff' | 'report' | 'settings'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

// ─── STAFF ROW ─────────────────────────────────────────────────────────────
// CHANGED: Prop tambahan isOwner untuk control tombol role
// CHANGED: Tambah mode edit username dan reset password
function StaffRow({ staff, isOwner, onRoleChange, onDataChange, onDelete }: {
  staff:        Profile
  isOwner:      boolean
  onRoleChange: (id: string, role: UserRole) => void
  onDataChange: () => void
  onDelete: (id: string, name: string) => void
}) {
  const [editMode,    setEditMode]    = useState<'name' | 'username' | 'password' | null>(null)
  const [nameVal,     setNameVal]     = useState(staff.display_name)
  const [usernameVal, setUsernameVal] = useState(staff.username || '')
  const [passwordVal, setPasswordVal] = useState('')
  const [oldPasswordVal, setOldPasswordVal] = useState('')
  const [saving,      setSaving]      = useState(false)

  const save = async () => {
    if (!editMode) return
    setSaving(true)

    const body: Record<string, string> = { targetUserId: staff.id }
    if (editMode === 'name')     body.displayName = nameVal
    if (editMode === 'username') body.username    = usernameVal
    if (editMode === 'password') {
      if (passwordVal.length < 6) {
        toast.error('Password minimal 6 karakter'); setSaving(false); return
      }
      if (passwordVal === oldPasswordVal && oldPasswordVal !== '') {
        toast.error('Password baru tidak boleh sama dengan password lama'); setSaving(false); return
      }
      body.newPassword = passwordVal
    }

    const res = await fetch('/api/admin/update-employee', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { toast.error(data.error || 'Gagal menyimpan'); return }
    toast.success('Data diupdate')
    setEditMode(null)
    setPasswordVal('')
    onDataChange()
  }

  // CHANGED: Role yang bisa di-assign tergantung isOwner:
  // OWNER: bisa assign OWNER, ADMIN, EMPLOYEE
  // ADMIN: tidak bisa ganti role sama sekali (hanya read)
  const allowedRoles: UserRole[] = isOwner ? ['OWNER', 'ADMIN', 'EMPLOYEE'] : []

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">

        {/* Info pegawai + edit inline */}
        <div className="flex-1 space-y-2">
          {/* Display Name */}
          <div className="flex items-center gap-2">
            {editMode === 'name' ? (
              <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"/>
            ) : (
              <span className="font-semibold text-white text-sm">{staff.display_name || <span className="text-gray-500 italic">Belum ada nama</span>}</span>
            )}
            {editMode === 'name'
              ? <><button onClick={save} disabled={saving} className="px-2 py-1 bg-orange-600 rounded text-xs font-bold">{saving?'...':'Simpan'}</button>
                  <button onClick={() => setEditMode(null)} className="px-2 py-1 bg-gray-700 rounded text-xs">Batal</button></>
              : <button onClick={() => setEditMode('name')} className="text-xs text-gray-500 hover:text-gray-300">✏️ nama</button>
            }
          </div>

          {/* Username */}
          <div className="flex items-center gap-2">
            {editMode === 'username' ? (
              <input autoFocus value={usernameVal} onChange={e => setUsernameVal(e.target.value)}
                placeholder="username baru"
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-orange-500"/>
            ) : (
              <span className="text-xs text-gray-500 font-mono">@{staff.username || '(no username)'}</span>
            )}
            {editMode === 'username'
              ? <><button onClick={save} disabled={saving} className="px-2 py-1 bg-orange-600 rounded text-xs font-bold">{saving?'...':'Simpan'}</button>
                  <button onClick={() => setEditMode(null)} className="px-2 py-1 bg-gray-700 rounded text-xs">Batal</button></>
              : <button onClick={() => setEditMode('username')} className="text-xs text-gray-500 hover:text-gray-300">✏️ username</button>
            }
          </div>

          {/* Reset Password */}
          <div className="flex items-center gap-2">
            {editMode === 'password' ? (
              <div className="flex flex-col gap-1.5 flex-1">
                <input type="password" value={oldPasswordVal}
                  onChange={e => setOldPasswordVal(e.target.value)}
                  placeholder="password lama (untuk verifikasi)"
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500" />
                <input autoFocus type="password" value={passwordVal}
                  onChange={e => setPasswordVal(e.target.value)}
                  placeholder="password baru (min 6 karakter)"
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500" />
              </div>
            ) : null}
            {editMode === 'password'
              ? <>
                <button onClick={save} disabled={saving} className="px-2 py-1 bg-orange-600 rounded text-xs font-bold">
                  {saving ? '...' : 'Simpan'}
                </button>
                <button onClick={() => { setEditMode(null); setPasswordVal(''); setOldPasswordVal('') }}
                  className="px-2 py-1 bg-gray-700 rounded text-xs">Batal</button>
              </>
              : <button onClick={() => setEditMode('password')} className="text-xs text-gray-500 hover:text-red-400">🔑 reset password</button>
            }
          </div>
        </div>

        {/* Role buttons — CHANGED: hanya tampil kalau isOwner */}
        <div className="flex flex-col items-end gap-2">
          {/* Badge role saat ini */}
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            staff.role === 'OWNER' ? 'bg-orange-900 text-orange-400'
            : staff.role === 'ADMIN' ? 'bg-purple-900 text-purple-400'
            : 'bg-gray-700 text-gray-300'}`}>
            {staff.role === 'OWNER' ? '👑' : staff.role === 'ADMIN' ? '🛡️' : '👤'} {staff.role}
          </span>

          {/* Tombol ubah role — hanya untuk OWNER */}
          {allowedRoles.length > 0 && (
            <div className="flex gap-1">
              {allowedRoles.map(r => (
                <button key={r} onClick={() => onRoleChange(staff.id, r)}
                  disabled={staff.role === r}
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                    staff.role === r ? 'opacity-30 cursor-not-allowed bg-gray-700'
                    : r === 'OWNER' ? 'bg-gray-800 hover:bg-orange-900 text-gray-400 hover:text-orange-400'
                    : r === 'ADMIN' ? 'bg-gray-800 hover:bg-purple-900 text-gray-400 hover:text-purple-400'
                    : 'bg-gray-800 hover:bg-blue-900 text-gray-400 hover:text-blue-400'}`}>
                  {r === 'OWNER' ? '👑' : r === 'ADMIN' ? '🛡️' : '👤'} {r}
                </button>
              ))}
            </div>
          )}
        </div>


      </div>
      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end">
        <button
          onClick={() => onDelete(staff.id, staff.display_name || staff.username || 'Pegawai ini')}
          className="px-3 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-950
      rounded-lg transition-colors font-semibold">
          🗑️ Hapus Pegawai
        </button>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
function AdminPageContent() {
  const searchParams   = useSearchParams()
  const { id: userId, profile } = useCurrentUser()

  const branchFromUrl  = searchParams.get('branch')
  const activeBranchId = branchFromUrl || profile?.branch_id || null
  const isOwner        = profile?.role === 'OWNER'
  // CHANGED: isAdmin flag untuk restrict beberapa UI
  const isAdmin        = profile?.role === 'ADMIN'

  const [tab, setTab] = useState<Tab>('menus')

  const [menus,        setMenus]        = useState<Menu[]>([])
  const [menuForm,     setMenuForm]     = useState({ name: '', price: '', category: '', stock: '0' })
  const [editMenuId,   setEditMenuId]   = useState<string | null>(null)
  const [showMenuForm, setShowMenuForm] = useState(false)

  const [categories,   setCategories]   = useState<Category[]>([])
  const [catForm,      setCatForm]      = useState({ name: '', sort_order: '0' })
  const [editCatId,    setEditCatId]    = useState<string | null>(null)
  const [showCatForm,  setShowCatForm]  = useState(false)

  const [staff,        setStaff]        = useState<Profile[]>([])
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff,     setNewStaff]     = useState({
    username: '', password: '', displayName: '',
    // CHANGED: ADMIN hanya bisa pilih EMPLOYEE, tidak bisa ADMIN
    role: 'EMPLOYEE' as UserRole,
  })
  const [addingStaff,  setAddingStaff]  = useState(false)

  const [reportRange,  setReportRange]  = useState<'today'|'7d'|'30d'|'90d'>('7d')
  const [reportData, setReportData] = useState<{
    total: number, revenue: number, cash: number, qris: number,
    topMenus: { name: string, qty: number }[], bottomMenus: { name: string, qty: number }[]
  } | null>(null)
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [searchInvoice, setSearchInvoice] = useState('')
  const [filterPelayan, setFilterPelayan] = useState('all')
  const reportChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const PAGE_SIZE = 20

  const getFromDate = (range: 'today' | '7d' | '30d' | '90d') => {
    const now = new Date(); const from = new Date(now)
    if (range === 'today') from.setHours(0, 0, 0, 0)
    else if (range === '7d') from.setDate(now.getDate() - 7)
    else if (range === '30d') from.setDate(now.getDate() - 30)
    else from.setDate(now.getDate() - 90)
    return from.toISOString()
  }

  const [settingsForm, setSettingsForm] = useState({
    store_name: '', store_address: '', store_social: '', footer_text: '',
  })

  const fetchMenus = useCallback(async () => {
    if (!activeBranchId) return
    const { data } = await supabase.from('menus').select('*')
      .eq('branch_id', activeBranchId).order('category').order('name')
    if (data) setMenus(data as Menu[])
  }, [activeBranchId])

  const fetchCategories = useCallback(async () => {
    if (!activeBranchId) return
    const { data } = await supabase.from('categories').select('*')
      .eq('branch_id', activeBranchId).order('sort_order')
    if (data) setCategories(data as Category[])
  }, [activeBranchId])

  const fetchStaff = useCallback(async () => {
    if (!activeBranchId) return
    const { data } = await supabase.from('profiles').select('*')
      .eq('branch_id', activeBranchId).order('created_at')
    if (data) setStaff(data as Profile[])
  }, [activeBranchId])

  const fetchReport = useCallback(async () => {
    if (!activeBranchId) return
    const fromISO = getFromDate(reportRange)

    const { data: orders } = await supabase.from('orders')
      .select('total_price, payment_method')
      .eq('branch_id', activeBranchId)
      .gte('created_at', fromISO)
      .eq('status', 'COMPLETED')

    const { data: items } = await supabase.from('order_items')
      .select('menu_name, quantity, orders!inner(created_at, status, branch_id)')
      .eq('orders.branch_id', activeBranchId)
      .gte('orders.created_at', fromISO)
      .eq('orders.status', 'COMPLETED')

    if (orders) {
      const menuMap: Record<string, number> = {}
      items?.forEach(i => { menuMap[i.menu_name] = (menuMap[i.menu_name] ?? 0) + i.quantity })
      const menuArr = Object.entries(menuMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty)
      setReportData({
        total: orders.length,
        revenue: orders.reduce((s, o) => s + Number(o.total_price), 0),
        cash: orders.filter(o => o.payment_method === 'CASH').length,
        qris: orders.filter(o => o.payment_method === 'QRIS').length,
        topMenus: menuArr.slice(0, 5),
        bottomMenus: menuArr.slice(-5).reverse(),
      })
    }
  }, [activeBranchId, reportRange])

  const fetchOrderHistory = useCallback(async () => {
    if (!activeBranchId) return
    const fromISO = getFromDate(reportRange)   // ← tambah filter tanggal

    const { data } = await supabase
      .from('orders').select('*, order_items(*)')
      .eq('branch_id', activeBranchId)
      .gte('created_at', fromISO)             // ← filter by range
      .order('created_at', { ascending: false })
      .range((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE - 1)
    if (data) setOrderHistory(data as Order[])
  }, [activeBranchId, historyPage, reportRange])

  const fetchSettings = useCallback(async () => {
    if (!activeBranchId) return
    const { data } = await supabase.from('store_settings').select('*')
      .eq('branch_id', activeBranchId).maybeSingle()
    if (data) setSettingsForm({
      store_name: data.store_name, store_address: data.store_address,
      store_social: data.store_social, footer_text: data.footer_text,
    })
  }, [activeBranchId])

  useEffect(() => { fetchMenus(); fetchCategories() }, [fetchMenus, fetchCategories])
  useEffect(() => { if (tab === 'staff') fetchStaff() }, [tab, fetchStaff])
  useEffect(() => {
    if (tab !== 'report' || !activeBranchId) return

    // Cleanup channel lama
    if (reportChannelRef.current) {
      supabase.removeChannel(reportChannelRef.current)
      reportChannelRef.current = null
    }

    const channel = supabase.channel(`report-${activeBranchId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',   // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'orders',
        filter: `branch_id=eq.${activeBranchId}`,
      }, () => {
        // Re-fetch saat ada perubahan order di branch ini
        fetchReport()
        fetchOrderHistory()
      })
      .subscribe()

    reportChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      reportChannelRef.current = null
    }
  }, [tab, activeBranchId, fetchReport, fetchOrderHistory])
  useEffect(() => { if (tab === 'settings') fetchSettings() }, [tab, fetchSettings])
  useEffect(() => {
    if (tab === 'report' && activeBranchId) {
      setHistoryPage(1)
      fetchReport()
      fetchOrderHistory()
    }
  }, [tab, activeBranchId, reportRange])
  useEffect(() => {
    if (tab === 'report' && activeBranchId) fetchOrderHistory()
  }, [historyPage, fetchOrderHistory])

  useEffect(() => {
    if (tab !== 'report' || !activeBranchId) return
    if (reportChannelRef.current) {
      supabase.removeChannel(reportChannelRef.current)
      reportChannelRef.current = null
    }
    const channel = supabase.channel(`report-${activeBranchId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `branch_id=eq.${activeBranchId}`,
      }, () => { fetchReport(); fetchOrderHistory() })
      .subscribe()
    reportChannelRef.current = channel
    return () => { supabase.removeChannel(channel); reportChannelRef.current = null }
  }, [tab, activeBranchId])

  // ── MARK AS COMPLETE ──
  const markComplete = async (orderId: string) => {
    const { error } = await supabase.from('orders')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) toast.error(error.message)
    else toast.success('Order ditandai selesai')
    // Realtime akan otomatis refresh, tapi fetch manual sebagai fallback:
    fetchOrderHistory()
    fetchReport()
  }

  // ── FILTER CLIENT-SIDE untuk tabel laporan ──
  const filteredOrders = orderHistory.filter(o => {
    const matchInvoice = !searchInvoice
      || o.order_number.toLowerCase().includes(searchInvoice.toLowerCase())
    const matchPelayan = filterPelayan === 'all'
      || o.served_by_name === filterPelayan
    return matchInvoice && matchPelayan
  })

  // Daftar unik pelayan dari orderHistory:
  const pelayanList = Array.from(new Set(
    orderHistory.map(o => o.served_by_name).filter(Boolean)
  ))

  // ── ACTIONS ──

  const handleMenuSubmit = async () => {
    if (!menuForm.name || !menuForm.price) { toast.error('Nama dan harga wajib diisi'); return }
    const payload = { name: menuForm.name, price: parseFloat(menuForm.price),
      category: menuForm.category||(categories[0]?.name??'Makanan'),
      stock: parseInt(menuForm.stock)||0, branch_id: activeBranchId }
    if (editMenuId) { await supabase.from('menus').update(payload).eq('id', editMenuId); toast.success('Menu diupdate') }
    else            { await supabase.from('menus').insert(payload); toast.success('Menu ditambahkan') }
    setMenuForm({name:'',price:'',category:'',stock:'0'}); setEditMenuId(null); setShowMenuForm(false); fetchMenus()
  }

  const toggleAvail = async (m: Menu) => {
    await supabase.from('menus').update({is_available:!m.is_available}).eq('id', m.id)
    toast.success(`${m.name} → ${!m.is_available?'Tersedia':'Habis'}`); fetchMenus()
  }

  const updateStock = async (m: Menu, delta: number) => {
    const newStock = Math.max(0, m.stock+delta)
    await supabase.from('menus').update({stock:newStock}).eq('id', m.id)
    setMenus(prev => prev.map(x => x.id===m.id ? {...x, stock:newStock} : x))
  }

  const deleteMenu = async (m: Menu) => {
    if (!confirm(`Hapus "${m.name}"?`)) return
    await supabase.from('menus').delete().eq('id', m.id); toast.success('Dihapus'); fetchMenus()
  }

  const handleCatSubmit = async () => {
    if (!catForm.name) { toast.error('Nama kategori wajib diisi'); return }
    const payload = {name:catForm.name, sort_order:parseInt(catForm.sort_order)||0, branch_id:activeBranchId}
    if (editCatId) { await supabase.from('categories').update(payload).eq('id', editCatId); toast.success('Kategori diupdate') }
    else           { await supabase.from('categories').insert(payload); toast.success('Kategori ditambahkan') }
    setCatForm({name:'',sort_order:'0'}); setEditCatId(null); setShowCatForm(false); fetchCategories()
  }

  const deleteCat = async (c: Category) => {
    // Hitung berapa menu yang akan terhapus
    const { count } = await supabase
      .from('menus')
      .select('*', { count: 'exact', head: true })
      .eq('category', c.name)
      .eq('branch_id', activeBranchId)

    const menuCount = count ?? 0
    const msg = menuCount > 0
      ? `Hapus kategori "${c.name}"?\n\n⚠️ Ini akan menghapus ${menuCount} menu yang terkait!`
      : `Hapus kategori "${c.name}"?`

    if (!confirm(msg)) return

    // Hapus semua menu di kategori ini dulu
    if (menuCount > 0) {
      await supabase.from('menus').delete()
        .eq('category', c.name)
        .eq('branch_id', activeBranchId)
    }

    // Baru hapus kategorinya
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) { toast.error(error.message); return }

    toast.success(`Kategori "${c.name}" dan ${menuCount} menu terkait dihapus`)
    fetchCategories()
    fetchMenus()   // refresh tabel menu juga
  }

  const handleAddStaff = async () => {
    const {username, password, displayName, role: staffRole} = newStaff
    if (!username||!password||!displayName) { toast.error('Semua field wajib diisi'); return }
    if (password.length<6) { toast.error('Password minimal 6 karakter'); return }
    if (!activeBranchId) { toast.error('Branch tidak ditemukan'); return }
    setAddingStaff(true)
    try {
      const res = await fetch('/api/admin/create-employee', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({username, password, displayName, role: staffRole, branchId: activeBranchId}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${displayName} berhasil didaftarkan!`)
      setNewStaff({username:'',password:'',displayName:'',role:'EMPLOYEE'})
      setShowAddStaff(false); fetchStaff()
    } catch (err:any) { toast.error(err.message||'Gagal mendaftarkan pegawai') }
    finally { setAddingStaff(false) }
  }

  const updateStaffRole = async (id: string, role: UserRole) => {
    await supabase.from('profiles').update({role}).eq('id', id)
    toast.success('Role diupdate'); fetchStaff()
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Hapus pegawai "${staffName}"?\n\nAkun ini akan dihapus permanen dan tidak bisa dikembalikan.`)) return
    try {
      const res = await fetch('/api/admin/delete-employee', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: staffId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${staffName} berhasil dihapus`)
      fetchStaff()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus pegawai')
    }
  }

  const exportCSV = () => {
    if (!orderHistory.length) { toast.error('Tidak ada data untuk diekspor'); return }
    const rows = [
      ['No. Order', 'Tanggal', 'Pelanggan', 'Dilayani', 'Jenis', 'Meja', 'Total', 'Bayar', 'Status'],
      ...orderHistory.map(o => [
        o.order_number,
        formatDate(o.created_at),
        o.customer_name || '-',
        o.served_by_name || '-',
        o.order_type === 'DINE_IN' ? 'Makan di Sini' : 'Bungkus',
        o.order_type === 'TAKEAWAY' ? '-' : o.table_number,
        o.total_price,
        o.payment_method,
        o.status,
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `laporan-${reportRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const printReceiptFromReport = async (order: Order) => {
    const { data: settings } = await supabase
      .from('store_settings').select('*')
      .eq('branch_id', activeBranchId!).maybeSingle()

    const rp = (n: number) => new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(n)

    const cashRcv = order.cash_received || 0
    const chg = cashRcv - order.total_price
    const timeStr = new Date(order.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const items = order.order_items ?? []

    const itemRows = items.map(i => `
    <tr>
      <td style="padding:2px 4px">${i.menu_name}${i.notes ? `<br/><span style="font-size:10px;color:#888">↳ ${i.notes}</span>` : ''}
        <br/><span style="font-size:10px;color:#888">${rp(i.unit_price)}</span></td>
      <td style="padding:2px 4px;text-align:center">${i.quantity}</td>
      <td style="padding:2px 4px;text-align:right">${rp(i.unit_price * i.quantity)}</td>
    </tr>`).join('')

    const cashSection = order.payment_method === 'CASH' && cashRcv > 0
      ? `<tr><td colspan="2" style="padding:2px 4px;color:#555">Bayar</td><td style="padding:2px 4px;text-align:right">${rp(cashRcv)}</td></tr>
       <tr><td colspan="2" style="padding:2px 4px;font-weight:bold">Kembali</td><td style="padding:2px 4px;text-align:right;font-weight:bold">${rp(Math.max(0, chg))}</td></tr>`
      : order.payment_method === 'LATER'
        ? `<tr><td colspan="3" style="text-align:center;color:#D97706;font-weight:bold;padding:4px">⏰ BELUM LUNAS</td></tr>`
        : ''

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Struk ${order.order_number}</title>
    <style>*{box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:6px}
    .center{text-align:center}.divider{border-top:1px dashed #000;margin:5px 0}
    table{width:100%;border-collapse:collapse}th{font-size:11px;border-bottom:1px solid #000;padding:2px 4px;text-align:left}
    .total-row td{font-weight:bold;border-top:1px dashed #000;padding-top:4px;font-size:13px}
    @media print{body{margin:0}}</style></head><body>
    <div class="center">
      <div style="font-size:16px;font-weight:900">${settings?.store_name ?? 'kasir-dapur'}</div>
      ${settings?.store_address ? `<div style="font-size:11px;color:#555">${settings.store_address}</div>` : ''}
      ${settings?.store_social ? `<div style="font-size:11px;color:#555">${settings.store_social}</div>` : ''}
    </div>
    <div class="divider"></div>
    <table><tbody>
      <tr><td style="color:#555">No. Order</td><td style="font-weight:bold;text-align:right">${order.order_number}</td></tr>
      <tr><td style="color:#555">Tanggal</td><td style="text-align:right">${timeStr}</td></tr>
      <tr><td style="color:#555">Jenis</td><td style="text-align:right">${order.order_type === 'DINE_IN' ? 'Makan di Sini' : 'Bungkus'}</td></tr>
      <tr><td style="color:#555">Meja</td><td style="text-align:right">${order.order_type === 'TAKEAWAY' ? '-' : order.table_number}</td></tr>
      ${order.customer_name ? `<tr><td style="color:#555">Pelanggan</td><td style="text-align:right">${order.customer_name}</td></tr>` : ''}
      ${order.served_by_name ? `<tr><td style="color:#555">Dilayani</td><td style="text-align:right">${order.served_by_name}</td></tr>` : ''}
    </tbody></table>
    <div class="divider"></div>
    <table>
      <thead><tr><th>Menu</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr class="total-row"><td colspan="2">TOTAL</td><td style="text-align:right">${rp(order.total_price)}</td></tr>
        <tr><td colspan="2" style="padding:2px 4px;color:#555">Pembayaran</td><td style="padding:2px 4px;text-align:right">${order.payment_method}</td></tr>
        ${cashSection}
      </tfoot>
    </table>
    <div class="divider"></div>
    <div class="center" style="margin-top:8px;font-size:12px">${settings?.footer_text ?? 'Terima kasih!'}</div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
    </body></html>`

    const win = window.open('', '_blank', 'width=400,height=600')
    if (win) { win.document.write(html); win.document.close() }
  }

  // CHANGED: Settings save — bedakan field yang boleh admin edit
  const handleSettingsSave = async () => {
    if (!activeBranchId) return

    const updateData = isOwner
      ? settingsForm
      : { store_social: settingsForm.store_social, footer_text: settingsForm.footer_text }

    const { error } = await supabase.from('store_settings')
      .upsert({ branch_id: activeBranchId, ...updateData }, { onConflict: 'branch_id' })

    if (error) { toast.error(error.message); return }

    // ← FIX: sync nama dan alamat ke tabel branches juga (biar card di owner page ikut update)
    if (isOwner) {
      await supabase.from('branches').update({
        name: settingsForm.store_name,
        address: settingsForm.store_address,
      }).eq('id', activeBranchId)
    }

    toast.success('Pengaturan disimpan')

    // Juga refresh settings form biar tampilan profile toko langsung update
    fetchSettings()
  }

  const tabs: {id:Tab,label:string}[] = [
    {id:'menus',label:'🍜 Menu'},{id:'categories',label:'🏷️ Kategori'},
    {id:'staff',label:'👥 Pegawai'},{id:'report',label:'📊 Laporan'},
    {id:'settings',label:'⚙️ Toko'},
  ]

  if (!activeBranchId) return (
    <div className="flex items-center justify-center h-full text-gray-600 p-8 text-center">
      <div>
        <div className="text-5xl mb-4">⚠️</div>
        <p className="font-bold text-white mb-2">Cabang tidak ditemukan</p>
        <p className="text-sm">Akun ini belum ditugaskan ke cabang manapun.</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">

      {isOwner && (
        <a href="/home/owner" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-4">
          ← Kembali ke daftar cabang
        </a>
      )}

      <div className="flex gap-1.5 md:gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap
              transition-colors shrink-0 ${tab===t.id
                ?'bg-orange-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: MENUS ═══ */}
      {tab==='menus' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold">Daftar Menu</h2>
            <button onClick={()=>{setEditMenuId(null);setMenuForm({name:'',price:'',category:categories[0]?.name??'',stock:'0'});setShowMenuForm(true)}}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold">+ Tambah</button>
          </div>
          {showMenuForm && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
              <input placeholder="Nama Menu *" value={menuForm.name}
                onChange={e=>setMenuForm({...menuForm,name:e.target.value})}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"/>
              <input type="number" placeholder="Harga *" value={menuForm.price}
                onChange={e=>setMenuForm({...menuForm,price:e.target.value})}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"/>
              <input type="number" placeholder="Stok" value={menuForm.stock} min="0"
                onChange={e=>setMenuForm({...menuForm,stock:e.target.value})}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"/>
              <select value={menuForm.category} onChange={e=>setMenuForm({...menuForm,category:e.target.value})}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm">
                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <div className="col-span-2 flex gap-2 justify-end">
                <button onClick={()=>setShowMenuForm(false)} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
                <button onClick={handleMenuSubmit} className="px-4 py-2 bg-orange-600 rounded-lg text-sm font-bold">Simpan</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>{['Nama','Kategori','Harga','Stok','Status','Aksi'].map(h=><th key={h} className="px-3 py-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {menus.map(m=>(
                  <tr key={m.id} className="hover:bg-gray-800/30">
                    <td className="px-3 py-2.5 font-medium text-white text-xs">{m.name}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{m.category}</td>
                    <td className="px-3 py-2.5 text-orange-400 font-mono text-xs">{formatRupiah(m.price)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={()=>updateStock(m,-1)} className="w-5 h-5 rounded bg-gray-700 text-xs font-bold">−</button>
                        <span className={`w-7 text-center font-bold text-xs ${m.stock===0?'text-red-400':m.stock<=5?'text-yellow-400':'text-white'}`}>{m.stock}</span>
                        <button onClick={()=>updateStock(m,+1)} className="w-5 h-5 rounded bg-gray-700 text-xs font-bold">+</button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={()=>toggleAvail(m)}
                        className={`px-2 py-1 rounded-full text-xs font-bold ${m.is_available?'bg-green-900 text-green-400':'bg-red-900 text-red-400'}`}>
                        {m.is_available?'Tersedia':'Habis'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <button onClick={()=>{setEditMenuId(m.id);setMenuForm({name:m.name,price:String(m.price),category:m.category,stock:String(m.stock)});setShowMenuForm(true)}}
                          className="px-2 py-1 bg-gray-700 rounded text-xs">Edit</button>
                        <button onClick={()=>deleteMenu(m)} className="px-2 py-1 bg-red-900 rounded text-xs text-red-400">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: CATEGORIES ═══ */}
      {tab==='categories' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold">Kelola Kategori</h2>
            <button onClick={()=>{setEditCatId(null);setCatForm({name:'',sort_order:String(categories.length+1)});setShowCatForm(true)}}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold">+ Tambah</button>
          </div>
          {showCatForm && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 flex gap-3">
              <input placeholder="Nama Kategori *" value={catForm.name}
                onChange={e=>setCatForm({...catForm,name:e.target.value})}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
              <input type="number" placeholder="Urutan" value={catForm.sort_order}
                onChange={e=>setCatForm({...catForm,sort_order:e.target.value})}
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
              <button onClick={()=>setShowCatForm(false)} className="px-3 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
              <button onClick={handleCatSubmit} className="px-3 py-2 bg-orange-600 rounded-lg text-sm font-bold">Simpan</button>
            </div>
          )}
          <div className="space-y-2">
            {categories.map(c=>(
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-white">{c.name}</div>
                  <div className="text-xs text-gray-500">Urutan: {c.sort_order}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setEditCatId(c.id);setCatForm({name:c.name,sort_order:String(c.sort_order)});setShowCatForm(true)}}
                    className="px-3 py-1.5 bg-gray-700 rounded text-xs">Edit</button>
                  <button onClick={()=>deleteCat(c)} className="px-3 py-1.5 bg-red-900 rounded text-xs text-red-400">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: STAFF ═══ */}
      {tab==='staff' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold">Kelola Pegawai</h2>
            <button onClick={()=>setShowAddStaff(true)}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold">
              + Daftarkan Pegawai
            </button>
          </div>

          {showAddStaff && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold mb-3">👤 Daftarkan Pegawai Baru</h3>
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 mb-3">
                💡 Pegawai login cukup pakai username + password — tidak perlu email
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Username *" value={newStaff.username}
                  onChange={e=>setNewStaff({...newStaff,username:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
                <input type="password" placeholder="Password * (min 6)" value={newStaff.password}
                  onChange={e=>setNewStaff({...newStaff,password:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
                <input placeholder="Nama Lengkap *" value={newStaff.displayName}
                  onChange={e=>setNewStaff({...newStaff,displayName:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
                <select value={newStaff.role}
                  onChange={e=>setNewStaff({...newStaff,role:e.target.value as UserRole})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  {/* CHANGED: Admin hanya bisa pilih EMPLOYEE. Owner bisa pilih ADMIN juga */}
                  <option value="EMPLOYEE">👤 Pegawai (EMPLOYEE)</option>
                  {isOwner && <option value="ADMIN">🛡️ Admin (ADMIN)</option>}
                </select>
              </div>
              {isAdmin && (
                <p className="text-xs text-yellow-600 mt-2">
                  ⚠️ Admin hanya bisa mendaftarkan pegawai dengan role EMPLOYEE. Upgrade ke ADMIN hanya bisa dilakukan oleh Owner.
                </p>
              )}
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={()=>setShowAddStaff(false)} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
                <button onClick={handleAddStaff} disabled={addingStaff}
                  className="px-4 py-2 bg-orange-600 rounded-lg text-sm font-bold disabled:opacity-50">
                  {addingStaff ? 'Mendaftarkan...' : '+ Daftarkan'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {staff.map(s => (
              <StaffRow
                key={s.id}
                staff={s}
                isOwner={isOwner}
                onRoleChange={updateStaffRole}
                onDataChange={fetchStaff}
                onDelete={handleDeleteStaff}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: REPORT ═══ */}
      {tab === 'report' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-base font-bold">Laporan Penjualan</h2>
            <div className="flex gap-1.5">
              {(['today', '7d', '30d', '90d'] as const).map(r => (
                <button key={r} onClick={() => { setReportRange(r); setHistoryPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${reportRange === r ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {r === 'today' ? 'Hari Ini' : r === '7d' ? '7 Hari' : r === '30d' ? '30 Hari' : '90 Hari'}
                </button>
              ))}
            </div>
            {/* ← Export CSV kembali */}
            <button onClick={exportCSV}
              className="ml-auto px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-300">
              ⬇️ Export CSV
            </button>
          </div>

          {/* Summary cards */}
          {reportData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                ['🧾', `${reportData.total}`, 'Total Order'],
                ['💰', formatRupiah(reportData.revenue), 'Pendapatan'],
                ['💵', `${reportData.cash} order`, 'Cash'],
                ['📱', `${reportData.qris} order`, 'QRIS'],
              ].map(([ico, val, lbl]) => (
                <div key={String(lbl)} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-2xl mb-1">{ico}</div>
                  <div className="text-lg font-black text-white">{val}</div>
                  <div className="text-xs text-gray-500">{lbl}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-3">
            <input placeholder="🔍 Cari nomor invoice..." value={searchInvoice}
              onChange={e => setSearchInvoice(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs
          text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 w-48"/>
            <select value={filterPelayan} onChange={e => setFilterPelayan(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="all">Semua Pelayan</option>
              {pelayanList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(searchInvoice || filterPelayan !== 'all') && (
              <button onClick={() => { setSearchInvoice(''); setFilterPelayan('all') }}
                className="px-3 py-1.5 bg-gray-700 rounded-lg text-xs text-gray-400">✕ Reset</button>
            )}
            <span className="ml-auto text-xs text-gray-600 self-center">
              {filteredOrders.length} order{(searchInvoice || filterPelayan !== 'all') ? ' (difilter)' : ''}
            </span>
          </div>

          {/* Tabel — tambah kolom Jenis dan Struk */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <thead className="bg-gray-800 text-gray-400 uppercase">
                <tr>
                  {['No. Order', 'Waktu', 'Pelanggan', 'Pelayan', 'Jenis', 'Total', 'Bayar', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-800/30">
                    <td className="px-3 py-2 font-mono font-bold text-orange-400">{o.order_number}</td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td className="px-3 py-2">{o.customer_name || '-'}</td>
                    <td className="px-3 py-2">{o.served_by_name || '-'}</td>
                    {/* ← kolom Jenis baru */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${o.order_type === 'DINE_IN'
                        ? 'bg-blue-900 text-blue-400'
                        : 'bg-amber-900 text-amber-400'}`}>
                        {o.order_type === 'DINE_IN' ? '🪑 Dine In' : '📦 Bungkus'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold">{formatRupiah(o.total_price)}</td>
                    <td className="px-3 py-2 text-gray-400">{o.payment_method}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        o.status === 'COMPLETED' ? 'bg-green-900 text-green-400'
                          : o.status === 'CANCELLED' ? 'bg-red-900 text-red-400'
                            : 'bg-yellow-900 text-yellow-400'}`}>
                        {o.status}
                      </span>
                    </td>
                    {/* ← kolom Aksi dengan struk + selesai */}
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 min-w-[120px]">
                        <button onClick={() => printReceiptFromReport(o)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                          Struk
                        </button>
                        {o.status === 'READY' && (
                          <button onClick={() => markComplete(o.id)}
                            className="px-2 py-1 bg-green-900 hover:bg-green-800 text-green-400
                        rounded text-xs font-bold whitespace-nowrap">
                            Selesai
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <div className="text-center text-gray-600 py-8 text-sm">
                {searchInvoice || filterPelayan !== 'all' ? 'Tidak ada order yang cocok dengan filter' : 'Belum ada order'}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-3 text-xs">
            <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
              className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-40">← Prev</button>
            <span className="px-3 py-1.5 text-gray-400">Hal. {historyPage}</span>
            <button onClick={() => setHistoryPage(p => p + 1)} disabled={orderHistory.length < PAGE_SIZE}
              className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* ═══ TAB: SETTINGS ═══ */}
      {tab==='settings' && (
        <div>
          <h2 className="text-base font-bold mb-1">Pengaturan Toko</h2>
          {/* CHANGED: Info untuk admin bahwa sebagian field read-only */}
          {isAdmin && (
            <p className="text-xs text-yellow-600 mb-4">
              ⚠️ Nama dan alamat toko hanya bisa diubah oleh Owner. Kamu bisa edit sosial media dan teks penutup struk.
            </p>
          )}

          {/* ── Profile toko saat ini (read) ── */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 mb-5 flex items-center gap-4">
            <div className="text-4xl">🏪</div>
            <div>
              <div className="font-bold text-white text-base">
                {settingsForm.store_name || 'Belum diatur'}
              </div>
              {settingsForm.store_address && (
                <div className="text-xs text-gray-400 mt-0.5">📍 {settingsForm.store_address}</div>
              )}
              {settingsForm.store_social && (
                <div className="text-xs text-gray-400 mt-0.5">📱 {settingsForm.store_social}</div>
              )}
              <div className="text-xs text-gray-600 mt-1 italic">
                "{settingsForm.footer_text}"
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4 max-w-lg">

            {/* Nama Toko — read-only untuk admin */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Nama Toko {isAdmin && <span className="text-gray-600">(hanya Owner)</span>}
              </label>
              <input
                value={settingsForm.store_name}
                onChange={e => isOwner && setSettingsForm({...settingsForm, store_name: e.target.value})}
                disabled={isAdmin}
                placeholder="kasir-dapur"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500
                  ${isAdmin
                    ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 border-gray-700'}`}
              />
            </div>

            {/* Alamat — read-only untuk admin */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Alamat {isAdmin && <span className="text-gray-600">(hanya Owner)</span>}
              </label>
              <input
                value={settingsForm.store_address}
                onChange={e => isOwner && setSettingsForm({...settingsForm, store_address: e.target.value})}
                disabled={isAdmin}
                placeholder="Jl. Contoh No. 1"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500
                  ${isAdmin
                    ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 border-gray-700'}`}
              />
            </div>

            {/* Sosial Media — bisa diedit admin */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Sosial Media</label>
              <input value={settingsForm.store_social}
                onChange={e => setSettingsForm({...settingsForm, store_social: e.target.value})}
                placeholder="@instagram"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"/>
            </div>

            {/* Footer Struk — bisa diedit admin */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Teks Penutup Struk</label>
              <input value={settingsForm.footer_text}
                onChange={e => setSettingsForm({...settingsForm, footer_text: e.target.value})}
                placeholder="Terima kasih!"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"/>
            </div>

            <button onClick={handleSettingsSave}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold">
              Simpan Pengaturan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-600">Memuat...</div>}>
      <AdminPageContent/>
    </Suspense>
  )
}