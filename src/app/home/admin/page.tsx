'use client'
// src/app/home/admin/page.tsx
// V3 UPDATE (perubahan besar):
// - Tab baru: Kategori (CRUD categories)
// - Tab baru: Pegawai (kelola role + display name)
// - Tab baru: Pengaturan Toko (store_settings untuk struk)
// - Laporan: 90 hari terakhir + riwayat order per transaksi + ekspor CSV
// - Responsive untuk mobile

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { Menu, Category, Order, Profile, StoreSettings, UserRole } from '@/types/database'

type Tab = 'menus' | 'categories' | 'staff' | 'report' | 'settings'

// ═══ HELPER ═══
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('menus')

  // ── MENUS ──
  const [menus,    setMenus]    = useState<Menu[]>([])
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: '', stock: '0' })
  const [editMenuId, setEditMenuId] = useState<string | null>(null)
  const [showMenuForm, setShowMenuForm] = useState(false)

  // ── CATEGORIES ──
  const [categories,   setCategories]   = useState<Category[]>([])
  const [catForm,      setCatForm]      = useState({ name: '', sort_order: '0' })
  const [editCatId,    setEditCatId]    = useState<string | null>(null)
  const [showCatForm,  setShowCatForm]  = useState(false)

  // ── STAFF ──
  const [staff, setStaff] = useState<(Profile & { email: string })[]>([])

  // ── REPORT ──
  const [reportRange, setReportRange]   = useState<'today' | '7d' | '30d' | '90d'>('7d')
  const [reportData,  setReportData]    = useState<{
    total: number; revenue: number; cash: number; qris: number
    topMenus: { name: string; qty: number }[]
    bottomMenus: { name: string; qty: number }[]
  } | null>(null)
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [historyPage,  setHistoryPage]  = useState(1)
  const PAGE_SIZE = 20

  // ── SETTINGS ──
  const [settings,    setSettings]    = useState<StoreSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState({
    store_name: '', store_address: '', store_social: '', footer_text: ''
  })

  // ══════════════════════════════════════
  // FETCH FUNCTIONS
  // ══════════════════════════════════════

  const fetchMenus = useCallback(async () => {
    const { data } = await supabase.from('menus').select('*').order('category').order('name')
    if (data) setMenus(data as Menu[])
  }, [])

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    if (data) setCategories(data as Category[])
  }, [])

  const fetchStaff = useCallback(async () => {
    // Join profiles dengan email dari auth.users via RPC atau views
    // Karena auth.users tidak bisa di-query langsung dari client,
    // kita ambil profiles saja dan email bisa diisi dari metadata
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    if (data) {
      // Untuk mendapatkan email, perlu query auth.users dari server side
      // Di sini kita tampilkan data yang tersedia
      setStaff(data.map(p => ({ ...p, email: '(lihat Supabase Auth)' })) as (Profile & { email: string })[])
    }
  }, [])

  const fetchReport = useCallback(async () => {
    const now   = new Date()
    const from  = new Date(now)
    if      (reportRange === 'today') from.setHours(0, 0, 0, 0)
    else if (reportRange === '7d')    from.setDate(now.getDate() - 7)
    else if (reportRange === '30d')   from.setDate(now.getDate() - 30)
    else if (reportRange === '90d')   from.setDate(now.getDate() - 90)

    const fromISO = from.toISOString()

    // Query orders completed
    const { data: orders } = await supabase
      .from('orders')
      .select('total_price, payment_method, created_at, order_number, customer_name, served_by_name')
      .gte('created_at', fromISO)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })

    // Query untuk top menu
    const { data: items } = await supabase
      .from('order_items')
      .select('menu_name, quantity, orders!inner(created_at, status)')
      .gte('orders.created_at', fromISO)
      .eq('orders.status', 'COMPLETED')

    if (orders) {
      // Agregasi top/bottom menu
      const menuMap: Record<string, number> = {}
      items?.forEach(item => {
        menuMap[item.menu_name] = (menuMap[item.menu_name] ?? 0) + item.quantity
      })
      const menuArr = Object.entries(menuMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)

      setReportData({
        total:       orders.length,
        revenue:     orders.reduce((s, o) => s + Number(o.total_price), 0),
        cash:        orders.filter(o => o.payment_method === 'CASH').length,
        qris:        orders.filter(o => o.payment_method === 'QRIS').length,
        topMenus:    menuArr.slice(0, 5),
        bottomMenus: menuArr.slice(-5).reverse(),
      })
    }
  }, [reportRange])

  const fetchOrderHistory = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .range((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE - 1)

    if (data) setOrderHistory(data as Order[])
  }, [historyPage])

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single()
    if (data) {
      setSettings(data as StoreSettings)
      setSettingsForm({
        store_name:    data.store_name,
        store_address: data.store_address,
        store_social:  data.store_social,
        footer_text:   data.footer_text,
      })
    }
  }, [])

  useEffect(() => { fetchMenus(); fetchCategories() }, [fetchMenus, fetchCategories])
  useEffect(() => { if (tab === 'staff')    fetchStaff()    }, [tab, fetchStaff])
  useEffect(() => { if (tab === 'report')   { fetchReport(); fetchOrderHistory() } }, [tab, fetchReport, fetchOrderHistory])
  useEffect(() => { if (tab === 'settings') fetchSettings() }, [tab, fetchSettings])
  useEffect(() => { if (tab === 'report')   fetchReport()  }, [reportRange, tab, fetchReport])
  useEffect(() => { if (tab === 'report')   fetchOrderHistory() }, [historyPage, tab, fetchOrderHistory])

  // ══════════════════════════════════════
  // MENU ACTIONS
  // ══════════════════════════════════════

  const handleMenuSubmit = async () => {
    if (!menuForm.name || !menuForm.price) { toast.error('Nama dan harga wajib diisi'); return }
    const payload = {
      name:     menuForm.name,
      price:    parseFloat(menuForm.price),
      category: menuForm.category || (categories[0]?.name ?? 'Makanan'),
      stock:    parseInt(menuForm.stock) || 0,
    }
    if (editMenuId) {
      await supabase.from('menus').update(payload).eq('id', editMenuId)
      toast.success('Menu diupdate')
    } else {
      await supabase.from('menus').insert(payload)
      toast.success('Menu ditambahkan')
    }
    setMenuForm({ name: '', price: '', category: '', stock: '0' })
    setEditMenuId(null); setShowMenuForm(false); fetchMenus()
  }

  const toggleAvail = async (m: Menu) => {
    await supabase.from('menus').update({ is_available: !m.is_available }).eq('id', m.id)
    toast.success(`${m.name} → ${!m.is_available ? 'Tersedia' : 'Habis'}`)
    fetchMenus()
  }

  const updateStock = async (m: Menu, delta: number) => {
    const newStock = Math.max(0, m.stock + delta)
    await supabase.from('menus').update({ stock: newStock }).eq('id', m.id)
    setMenus(prev => prev.map(x => x.id === m.id ? { ...x, stock: newStock } : x))
  }

  const deleteMenu = async (m: Menu) => {
    if (!confirm(`Hapus "${m.name}"?`)) return
    await supabase.from('menus').delete().eq('id', m.id)
    toast.success('Dihapus'); fetchMenus()
  }

  // ══════════════════════════════════════
  // CATEGORY ACTIONS
  // ══════════════════════════════════════

  const handleCatSubmit = async () => {
    if (!catForm.name) { toast.error('Nama kategori wajib diisi'); return }
    const payload = { name: catForm.name, sort_order: parseInt(catForm.sort_order) || 0 }
    if (editCatId) {
      await supabase.from('categories').update(payload).eq('id', editCatId)
      toast.success('Kategori diupdate')
    } else {
      await supabase.from('categories').insert(payload)
      toast.success('Kategori ditambahkan')
    }
    setCatForm({ name: '', sort_order: '0' }); setEditCatId(null); setShowCatForm(false); fetchCategories()
  }

  const deleteCat = async (c: Category) => {
    if (!confirm(`Hapus kategori "${c.name}"? Menu dengan kategori ini tidak terhapus.`)) return
    await supabase.from('categories').delete().eq('id', c.id)
    toast.success('Kategori dihapus'); fetchCategories()
  }

  // ══════════════════════════════════════
  // STAFF ACTIONS
  // ══════════════════════════════════════

  const updateStaffRole = async (staffId: string, newRole: UserRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', staffId)
    toast.success('Role diupdate'); fetchStaff()
  }

  const updateDisplayName = async (staffId: string, name: string) => {
    await supabase.from('profiles').update({ display_name: name }).eq('id', staffId)
    toast.success('Nama diupdate'); fetchStaff()
  }

  // ══════════════════════════════════════
  // SETTINGS ACTIONS
  // ══════════════════════════════════════

  const handleSettingsSave = async () => {
    await supabase.from('store_settings').upsert({ id: 1, ...settingsForm })
    toast.success('Pengaturan disimpan'); fetchSettings()
  }

  // ══════════════════════════════════════
  // EXPORT CSV
  // ══════════════════════════════════════

  const exportCSV = async () => {
    const now   = new Date()
    const from  = new Date(now)
    from.setDate(now.getDate() - 90) // 90 hari terakhir

    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })

    if (!orders || orders.length === 0) { toast.error('Tidak ada data untuk diekspor'); return }

    const rows: string[][] = [
      ['No. Order', 'Tanggal', 'Pelanggan', 'Dilayani Oleh', 'Jenis', 'Meja', 'Pesanan', 'Total', 'Pembayaran', 'Status']
    ]

    orders.forEach((o: Order) => {
      const pesanan = o.order_items
        ?.map(i => `${i.quantity}x ${i.menu_name}`)
        .join(' | ') ?? ''

      rows.push([
        o.order_number,
        formatDate(o.created_at),
        o.customer_name || '-',
        o.served_by_name || '-',
        o.order_type === 'DINE_IN' ? 'Di Sini' : 'Bungkus',
        o.table_number || '-',
        pesanan,
        String(o.total_price),
        o.payment_method,
        o.status,
      ])
    })

    // Buat file CSV dan trigger download
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM untuk Excel
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `laporan-kasir-dapur-90hari-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV berhasil didownload!')
  }

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════

  const tabs: { id: Tab; label: string }[] = [
    { id: 'menus',      label: '🍜 Menu'       },
    { id: 'categories', label: '🏷️ Kategori'   },
    { id: 'staff',      label: '👥 Pegawai'    },
    { id: 'report',     label: '📊 Laporan'    },
    { id: 'settings',   label: '⚙️ Toko'       },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">

      {/* Tab navigasi — horizontal scroll di mobile */}
      <div className="flex gap-1.5 md:gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap
              transition-colors shrink-0 ${
              tab === t.id
                ? 'bg-orange-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: MENUS ═══ */}
      {tab === 'menus' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold">Daftar Menu</h2>
            <button
              onClick={() => { setEditMenuId(null); setMenuForm({ name: '', price: '', category: categories[0]?.name ?? '', stock: '0' }); setShowMenuForm(true) }}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold"
            >
              + Tambah
            </button>
          </div>

          {showMenuForm && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
              <input
                placeholder="Nama Menu *"
                value={menuForm.name}
                onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
              <input
                type="number" placeholder="Harga *"
                value={menuForm.price}
                onChange={e => setMenuForm({ ...menuForm, price: e.target.value })}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
              <input
                type="number" placeholder="Stok awal"
                value={menuForm.stock} min="0"
                onChange={e => setMenuForm({ ...menuForm, stock: e.target.value })}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
              {/* Dropdown kategori dari DB */}
              <select
                value={menuForm.category}
                onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm"
              >
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <div className="col-span-2 flex gap-2 justify-end">
                <button onClick={() => setShowMenuForm(false)} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
                <button onClick={handleMenuSubmit} className="px-4 py-2 bg-orange-600 rounded-lg text-sm font-bold">Simpan</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  {['Nama', 'Kategori', 'Harga', 'Stok', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-3 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {menus.map(m => (
                  <tr key={m.id} className="hover:bg-gray-800/30">
                    <td className="px-3 py-2.5 font-medium text-white text-xs md:text-sm">{m.name}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{m.category}</td>
                    <td className="px-3 py-2.5 text-orange-400 font-mono text-xs">{formatRupiah(m.price)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateStock(m, -1)} className="w-5 h-5 rounded bg-gray-700 text-white text-xs font-bold">−</button>
                        <span className={`w-7 text-center font-bold text-xs ${m.stock === 0 ? 'text-red-400' : m.stock <= 5 ? 'text-yellow-400' : 'text-white'}`}>
                          {m.stock}
                        </span>
                        <button onClick={() => updateStock(m, +1)} className="w-5 h-5 rounded bg-gray-700 text-white text-xs font-bold">+</button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleAvail(m)}
                        className={`px-2 py-1 rounded-full text-xs font-bold ${m.is_available ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}
                      >
                        {m.is_available ? 'Tersedia' : 'Habis'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setEditMenuId(m.id); setMenuForm({ name: m.name, price: String(m.price), category: m.category, stock: String(m.stock) }); setShowMenuForm(true) }}
                          className="px-2 py-1 bg-gray-700 rounded text-xs"
                        >Edit</button>
                        <button onClick={() => deleteMenu(m)} className="px-2 py-1 bg-red-900 rounded text-xs text-red-400">Hapus</button>
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
      {tab === 'categories' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold">Kelola Kategori</h2>
            <button
              onClick={() => { setEditCatId(null); setCatForm({ name: '', sort_order: String(categories.length + 1) }); setShowCatForm(true) }}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold"
            >
              + Tambah
            </button>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-xs text-gray-500 mb-4">
            💡 Urutan ditentukan oleh angka Sort Order — semakin kecil, semakin duluan tampil di POS.
          </div>

          {showCatForm && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 flex gap-3">
              <input
                placeholder="Nama Kategori *"
                value={catForm.name}
                onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
              <input
                type="number" placeholder="Urutan"
                value={catForm.sort_order}
                onChange={e => setCatForm({ ...catForm, sort_order: e.target.value })}
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
              <button onClick={() => setShowCatForm(false)} className="px-3 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
              <button onClick={handleCatSubmit} className="px-3 py-2 bg-orange-600 rounded-lg text-sm font-bold">Simpan</button>
            </div>
          )}

          <div className="space-y-2">
            {categories.map(c => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-white">{c.name}</div>
                  <div className="text-xs text-gray-500">Urutan: {c.sort_order}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditCatId(c.id); setCatForm({ name: c.name, sort_order: String(c.sort_order) }); setShowCatForm(true) }}
                    className="px-3 py-1.5 bg-gray-700 rounded text-xs"
                  >Edit</button>
                  <button onClick={() => deleteCat(c)} className="px-3 py-1.5 bg-red-900 rounded text-xs text-red-400">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: STAFF ═══ */}
      {tab === 'staff' && (
        <div>
          <h2 className="text-base font-bold mb-4">Kelola Pegawai</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-xs text-gray-500 mb-4">
            💡 Display Name adalah nama yang tampil di KDS dan struk.
          </div>
          <div className="space-y-2">
            {staff.map(s => (
              <StaffRow key={s.id} staff={s} onRoleChange={updateStaffRole} onNameChange={updateDisplayName} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: REPORT ═══ */}
      {tab === 'report' && (
        <div>
          {/* Kontrol */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <h2 className="text-base font-bold">Laporan Penjualan</h2>
            <div className="flex gap-1.5">
              {(['today', '7d', '30d', '90d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setReportRange(r); setHistoryPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    reportRange === r ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {r === 'today' ? 'Hari Ini' : r === '7d' ? '7 Hari' : r === '30d' ? '30 Hari' : '90 Hari'}
                </button>
              ))}
            </div>
            <button
              onClick={exportCSV}
              className="ml-auto px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-bold transition-colors"
            >
              ⬇️ Ekspor CSV
            </button>
          </div>

          {/* Kartu ringkasan */}
          {reportData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {([
                  ['🧾', `${reportData.total}`,              'Total Order'],
                  ['💰', formatRupiah(reportData.revenue),   'Total Pendapatan'],
                  ['💵', `${reportData.cash} order`,         'Bayar Cash'],
                  ['📱', `${reportData.qris} order`,         'Bayar QRIS'],
                ] as const).map(([ico, val, lbl]) => (
                  <div key={lbl} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="text-2xl mb-1">{ico}</div>
                    <div className="text-lg font-black text-white">{val}</div>
                    <div className="text-xs text-gray-500">{lbl}</div>
                  </div>
                ))}
              </div>

              {/* Top & Bottom Menu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-sm font-bold mb-3 text-green-400">🔥 Menu Paling Laku</div>
                  {reportData.topMenus.length === 0
                    ? <p className="text-xs text-gray-500">Belum ada data</p>
                    : reportData.topMenus.map((m, i) => (
                      <div key={m.name} className="flex justify-between items-center py-1 text-sm">
                        <span className="text-gray-300">{i + 1}. {m.name}</span>
                        <span className="font-bold text-white">{m.qty}x</span>
                      </div>
                    ))}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-sm font-bold mb-3 text-red-400">📉 Menu Paling Jarang</div>
                  {reportData.bottomMenus.length === 0
                    ? <p className="text-xs text-gray-500">Belum ada data</p>
                    : reportData.bottomMenus.map((m, i) => (
                      <div key={m.name} className="flex justify-between items-center py-1 text-sm">
                        <span className="text-gray-300">{i + 1}. {m.name}</span>
                        <span className="font-bold text-white">{m.qty}x</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Riwayat transaksi */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold">Riwayat Transaksi</h3>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-40"
                >← Prev</button>
                <span className="px-3 py-1.5 text-gray-400">Hal. {historyPage}</span>
                <button
                  onClick={() => setHistoryPage(p => p + 1)}
                  disabled={orderHistory.length < PAGE_SIZE}
                  className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-40"
                >Next →</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                <thead className="bg-gray-800 text-gray-400 uppercase">
                  <tr>
                    {['No. Order', 'Waktu', 'Pelanggan', 'Pelayan', 'Pesanan', 'Total', 'Bayar', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {orderHistory.map(o => (
                    <tr key={o.id} className="hover:bg-gray-800/30">
                      <td className="px-3 py-2 font-mono font-bold text-orange-400">{o.order_number}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-400">{formatDate(o.created_at)}</td>
                      <td className="px-3 py-2">{o.customer_name || '-'}</td>
                      <td className="px-3 py-2">{o.served_by_name || '-'}</td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <div className="truncate text-gray-400">
                          {o.order_items?.map(i => `${i.quantity}x ${i.menu_name}`).join(', ')}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-bold text-white whitespace-nowrap">{formatRupiah(o.total_price)}</td>
                      <td className="px-3 py-2 text-gray-400">{o.payment_method}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          o.status === 'COMPLETED' ? 'bg-green-900 text-green-400'
                          : o.status === 'CANCELLED' ? 'bg-red-900 text-red-400'
                          : 'bg-yellow-900 text-yellow-400'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: SETTINGS ═══ */}
      {tab === 'settings' && (
        <div>
          <h2 className="text-base font-bold mb-4">Pengaturan Toko</h2>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nama Toko</label>
              <input
                value={settingsForm.store_name}
                onChange={e => setSettingsForm({ ...settingsForm, store_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Alamat Toko</label>
              <input
                placeholder="Jl. Contoh No. 123, Padang"
                value={settingsForm.store_address}
                onChange={e => setSettingsForm({ ...settingsForm, store_address: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Sosial Media (opsional)</label>
              <input
                placeholder="@nama_instagram"
                value={settingsForm.store_social}
                onChange={e => setSettingsForm({ ...settingsForm, store_social: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Teks Penutup Struk</label>
              <input
                placeholder="Terima kasih, sampai jumpa lagi!"
                value={settingsForm.footer_text}
                onChange={e => setSettingsForm({ ...settingsForm, footer_text: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              onClick={handleSettingsSave}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ SUB-KOMPONEN: StaffRow ═══
// Dipisah agar tiap baris punya state edit sendiri
function StaffRow({
  staff,
  onRoleChange,
  onNameChange,
}: {
  staff: Profile & { email: string }
  onRoleChange: (id: string, role: UserRole) => void
  onNameChange: (id: string, name: string) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(staff.display_name)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
      <div className="flex-1">
        <div className="text-xs text-gray-500 mb-1">{staff.email}</div>
        {editingName ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama tampil (misal: Budi)"
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={() => { onNameChange(staff.id, name); setEditingName(false) }}
              className="px-3 py-1 bg-orange-600 rounded text-xs font-bold"
            >Simpan</button>
            <button
              onClick={() => { setName(staff.display_name); setEditingName(false) }}
              className="px-3 py-1 bg-gray-700 rounded text-xs"
            >Batal</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">
              {staff.display_name || <span className="text-gray-500 italic">Belum ada nama</span>}
            </span>
            <button onClick={() => setEditingName(true)} className="text-xs text-gray-500 hover:text-gray-300">✏️</button>
          </div>
        )}
      </div>

      {/* Toggle role */}
      <div className="flex gap-2">
        {(['OWNER', 'EMPLOYEE'] as UserRole[]).map(r => (
          <button
            key={r}
            onClick={() => onRoleChange(staff.id, r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              staff.role === r
                ? r === 'OWNER' ? 'bg-orange-600 text-white' : 'bg-blue-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {r === 'OWNER' ? '👑 Owner' : '👤 Pegawai'}
          </button>
        ))}
      </div>
    </div>
  )
}