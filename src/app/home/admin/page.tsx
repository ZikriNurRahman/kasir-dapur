'use client'
// src/app/home/admin/page.tsx
// UPDATE dari src/app/admin/page.tsx:
// - Path pindah ke /home/admin
// - Tambah kolom 'Stok' di tabel menu
// - Tambah input stok di form tambah/edit menu
// - Hapus field image dari form (image_url sudah dihapus dari DB)
// - Header dihapus (sudah ada di HomeLayout)

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { Menu } from '@/types/database'

type Tab = 'menus' | 'report'

export default function AdminPage() {
  const [tab,        setTab]        = useState<Tab>('menus')
  const [menus,      setMenus]      = useState<Menu[]>([])
  // UPDATE: tambah field stock di form, hapus field image
  const [form,       setForm]       = useState({
    name: '', price: '', category: 'Makanan', stock: '0'
  })
  const [editId,     setEditId]     = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [report,     setReport]     = useState<{
    total: number; revenue: number; cash: number; qris: number
  } | null>(null)

  const fetchMenus = async () => {
    const { data } = await supabase
      .from('menus')
      .select('*')
      .order('category')
      .order('name')
    if (data) setMenus(data as Menu[])
  }

  useEffect(() => { fetchMenus() }, [])

  // Ambil laporan untuk tanggal yang dipilih
  useEffect(() => {
    const fetchReport = async () => {
      const { data } = await supabase
        .from('orders')
        .select('total_price, payment_method')
        .gte('created_at', `${reportDate}T00:00:00`)
        .lte('created_at', `${reportDate}T23:59:59`)
        .eq('status', 'COMPLETED')

      if (data) setReport({
        total:   data.length,
        revenue: data.reduce((s, o) => s + Number(o.total_price), 0),
        cash:    data.filter(o => o.payment_method === 'CASH').length,
        qris:    data.filter(o => o.payment_method === 'QRIS').length,
      })
    }
    fetchReport()
  }, [reportDate])

  const handleSubmit = async () => {
    if (!form.name || !form.price) {
      toast.error('Nama dan harga wajib diisi')
      return
    }

    // UPDATE: sertakan stock di payload
    const payload = {
      name:     form.name,
      price:    parseFloat(form.price),
      category: form.category,
      stock:    parseInt(form.stock) || 0,   // ← field baru
    }

    if (editId) {
      await supabase.from('menus').update(payload).eq('id', editId)
      toast.success('Menu diupdate')
    } else {
      await supabase.from('menus').insert(payload)
      toast.success('Menu ditambahkan')
    }

    setForm({ name: '', price: '', category: 'Makanan', stock: '0' })
    setEditId(null)
    setShowForm(false)
    fetchMenus()
  }

  const toggleAvail = async (m: Menu) => {
    await supabase
      .from('menus')
      .update({ is_available: !m.is_available })
      .eq('id', m.id)
    toast.success(`${m.name} → ${!m.is_available ? 'Tersedia' : 'Habis'}`)
    fetchMenus()
  }

  // UPDATE stok langsung dari tabel tanpa buka form — quick action
  const updateStock = async (m: Menu, delta: number) => {
    const newStock = Math.max(0, m.stock + delta) // tidak boleh negatif
    await supabase
      .from('menus')
      .update({ stock: newStock })
      .eq('id', m.id)
    // Update state lokal langsung agar tidak perlu fetch ulang
    setMenus(prev => prev.map(menu =>
      menu.id === m.id ? { ...menu, stock: newStock } : menu
    ))
  }

  const deleteMenu = async (m: Menu) => {
    if (!confirm(`Hapus "${m.name}"?`)) return
    await supabase.from('menus').delete().eq('id', m.id)
    toast.success('Dihapus')
    fetchMenus()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">

      {/* Tab navigasi */}
      <div className="flex gap-2 mb-6">
        {(['menus', 'report'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-orange-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {t === 'menus' ? '🍜 Kelola Menu' : '📊 Laporan'}
          </button>
        ))}
      </div>

      {/* ═══ TAB MENU ═══ */}
      {tab === 'menus' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Daftar Menu</h2>
            <button
              onClick={() => {
                setEditId(null)
                setForm({ name: '', price: '', category: 'Makanan', stock: '0' })
                setShowForm(true)
              }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors"
            >
              + Tambah Menu
            </button>
          </div>

          {/* Form tambah / edit */}
          {showForm && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Nama Menu *"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                    text-sm focus:outline-none focus:border-orange-500"
                />
                <input
                  type="number"
                  placeholder="Harga *"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                    text-sm focus:outline-none focus:border-orange-500"
                />

                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm"
                >
                  {['Makanan', 'Minuman', 'Snack'].map(c =>
                    <option key={c}>{c}</option>
                  )}
                </select>

                {/* UPDATE: input stok */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 shrink-0">Stok awal:</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                      text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors"
                >
                  Simpan
                </button>
              </div>
            </div>
          )}

          {/* Tabel menu */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  {['Nama', 'Kategori', 'Harga', 'Stok', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {menus.map(m => (
                  <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{m.name}</td>
                    <td className="px-4 py-3 text-gray-400">{m.category}</td>
                    <td className="px-4 py-3 text-orange-400 font-mono">
                      {formatRupiah(m.price)}
                    </td>

                    {/* UPDATE: kolom stok dengan tombol +/- */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateStock(m, -1)}
                          className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold"
                        >−</button>
                        <span className={`w-8 text-center font-bold text-sm ${
                          m.stock === 0
                            ? 'text-red-400'
                            : m.stock <= 5
                              ? 'text-yellow-400'
                              : 'text-white'
                        }`}>
                          {m.stock}
                        </span>
                        <button
                          onClick={() => updateStock(m, +1)}
                          className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold"
                        >+</button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAvail(m)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                          m.is_available
                            ? 'bg-green-900 text-green-400 hover:bg-green-800'
                            : 'bg-red-900 text-red-400 hover:bg-red-800'
                        }`}
                      >
                        {m.is_available ? 'Tersedia' : 'Habis'}
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditId(m.id)
                            setForm({
                              name:     m.name,
                              price:    String(m.price),
                              category: m.category,
                              stock:    String(m.stock), // ← sertakan stok
                            })
                            setShowForm(true)
                          }}
                          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMenu(m)}
                          className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-400 transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB LAPORAN ═══ */}
      {tab === 'report' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-lg font-bold">Laporan Penjualan</h2>
            <input
              type="date"
              value={reportDate}
              onChange={e => setReportDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:border-orange-500"
            />
          </div>

          {report && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {([
                ['🧾', `${report.total} pesanan`,      'Total Transaksi'],
                ['💰', formatRupiah(report.revenue),   'Total Pendapatan'],
                ['💵', `${report.cash} pesanan`,       'Bayar Cash'],
                ['📱', `${report.qris} pesanan`,       'Bayar QRIS'],
              ] as const).map(([ico, val, lbl]) => (
                <div key={String(lbl)} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="text-3xl mb-2">{ico}</div>
                  <div className="text-xl font-black text-white">{val}</div>
                  <div className="text-xs text-gray-500 mt-1">{lbl}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}