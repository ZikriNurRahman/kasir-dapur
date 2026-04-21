'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { Menu } from '@/types/database'

type Tab = 'menus' | 'report'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('menus')
  const [menus, setMenus] = useState<Menu[]>([])
  const [form, setForm] = useState({ name:'', price:'', category:'Makanan' })
  const [editId, setEditId] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<{total:number,revenue:number,cash:number,qris:number}|null>(null)

  const fetchMenus = async () => {
    const { data } = await supabase.from('menus').select('*').order('category').order('name')
    if (data) setMenus(data as Menu[])
  }
  useEffect(() => { fetchMenus() }, [])

  useEffect(() => {
    const fetchReport = async () => {
      const { data } = await supabase.from('orders').select('total_price,payment_method')
        .gte('created_at', `${reportDate}T00:00:00`).lte('created_at', `${reportDate}T23:59:59`)
        .eq('status', 'COMPLETED')
      if (data) setReport({
        total: data.length,
        revenue: data.reduce((s,o) => s + Number(o.total_price), 0),
        cash: data.filter(o => o.payment_method==='CASH').length,
        qris: data.filter(o => o.payment_method==='QRIS').length
      })
    }
    fetchReport()
  }, [reportDate])

  const handleSubmit = async () => {
    if (!form.name || !form.price) { toast.error('Nama dan harga wajib diisi'); return }
    const payload = { name: form.name, price: parseFloat(form.price), category: form.category }
    if (editId) {
      await supabase.from('menus').update(payload).eq('id', editId)
      toast.success('Menu diupdate')
    } else {
      await supabase.from('menus').insert(payload)
      toast.success('Menu ditambahkan')
    }
    setForm({ name:'', price:'', category:'Makanan' }); setEditId(null); setShowForm(false); fetchMenus()
  }

  const toggleAvail = async (m: Menu) => {
    await supabase.from('menus').update({ is_available: !m.is_available }).eq('id', m.id)
    toast.success(`${m.name} → ${!m.is_available?'Tersedia':'Habis'}`); fetchMenus()
  }

  const deleteMenu = async (m: Menu) => {
    if (!confirm(`Hapus "${m.name}"?`)) return
    await supabase.from('menus').delete().eq('id', m.id)
    toast.success('Dihapus'); fetchMenus()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="px-6 py-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">⚙️ Admin — kasir-dapur</h1>
        <div className="flex gap-2">
          {(['menus', 'report'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab===t?'bg-orange-600 text-white':'bg-gray-800 text-gray-400'}`}>
              {t === 'menus' ? '🍜 Kelola Menu' : '📊 Laporan'}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {tab === 'menus' && (
          <div>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-bold">Daftar Menu</h2>
              <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-orange-600 rounded-lg text-sm font-bold">+ Tambah</button>
            </div>
            {showForm && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
                <input placeholder="Nama *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
                <input type="number" placeholder="Harga *" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  {['Makanan','Minuman','Snack'].map(c=><option key={c}>{c}</option>)}
                </select>
                <div className="flex gap-2 col-span-2 justify-end">
                  <button onClick={()=>setShowForm(false)} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
                  <button onClick={handleSubmit} className="px-4 py-2 bg-orange-600 rounded-lg text-sm font-bold">Simpan</button>
                </div>
              </div>
            )}
            <table className="w-full text-sm bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>{['Nama','Kategori','Harga','Status','Aksi'].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {menus.map(m => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium text-white">{m.name}</td>
                    <td className="px-4 py-3 text-gray-400">{m.category}</td>
                    <td className="px-4 py-3 text-orange-400 font-mono">{formatRupiah(m.price)}</td>
                    <td className="px-4 py-3">
                      <button onClick={()=>toggleAvail(m)}
                        className={`px-3 py-1 rounded-full text-xs font-bold ${m.is_available?'bg-green-900 text-green-400':'bg-red-900 text-red-400'}`}>
                        {m.is_available?'Tersedia':'Habis'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={()=>{setEditId(m.id);setForm({name:m.name,price:String(m.price),category:m.category});setShowForm(true)}}
                          className="px-3 py-1 bg-gray-700 rounded text-xs">Edit</button>
                        <button onClick={()=>deleteMenu(m)} className="px-3 py-1 bg-red-900 rounded text-xs text-red-400">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'report' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-lg font-bold">Laporan Penjualan</h2>
              <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"/>
            </div>
            {report && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['🧾',`${report.total} pesanan`,'Total Transaksi'],
                  ['💰',formatRupiah(report.revenue),'Total Pendapatan'],
                  ['💵',`${report.cash} pesanan`,'Bayar Cash'],
                  ['📱',`${report.qris} pesanan`,'Bayar QRIS']
                ].map(([ico,val,lbl]) => (
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
      </main>
    </div>
  )
}