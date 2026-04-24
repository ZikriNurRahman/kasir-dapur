// src/app/home/dashboard/page.tsx
// Halaman baru — dashboard performa employee
// Berisi: pesanan yang dilayani sendiri + filter tanggal + cetak struk

'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { Order } from '@/types/database'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export default function EmployeeDashboardPage() {
  const [userId,    setUserId]    = useState<string>('')
  const [userName,  setUserName]  = useState<string>('')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [orders,    setOrders]    = useState<Order[]>([])
  const [summary,   setSummary]   = useState<{total:number,revenue:number,cash:number,qris:number} | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: p } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
      setUserName(p?.display_name || user.email?.split('@')[0] || '')
    }
    getUser()
  }, [])

  const fetchMyOrders = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('served_by', userId)  // hanya pesanan yang dilayani dia
      .gte('created_at', `${reportDate}T00:00:00`)
      .lte('created_at', `${reportDate}T23:59:59`)
      .order('created_at', { ascending: false })

    if (data) {
      setOrders(data as Order[])
      setSummary({
        total:   data.length,
        revenue: data.reduce((s,o) => s + Number(o.total_price), 0),
        cash:    data.filter(o => o.payment_method === 'CASH').length,
        qris:    data.filter(o => o.payment_method === 'QRIS').length,
      })
    }
    setLoading(false)
  }, [userId, reportDate])

  useEffect(() => { fetchMyOrders() }, [fetchMyOrders])

  // Print struk — sama dengan di CartPanel
  const printReceipt = async (order: Order) => {
    const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 1).single()
    const cashRcv = order.cash_received || 0
    const chg     = cashRcv - order.total_price
    const rp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n)
    const timeStr = new Date(order.created_at).toLocaleString('id-ID', {
      day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'
    })
    const items = order.order_items ?? []
    const storeName = settings?.store_name ?? 'kasir-dapur'

    const itemRows = items.map(i => `
      <tr>
        <td style="padding:2px 4px">${i.menu_name}
          ${i.notes ? `<br/><span style="color:#888;font-size:10px">↳ ${i.notes}</span>` : ''}
          <br/><span style="color:#888;font-size:10px">${rp(i.unit_price)}</span>
        </td>
        <td style="padding:2px 4px;text-align:center">${i.quantity}</td>
        <td style="padding:2px 4px;text-align:right">${rp(i.unit_price * i.quantity)}</td>
      </tr>
    `).join('')

    const cashSection = order.payment_method === 'CASH' && cashRcv > 0
      ? `<tr><td colspan="2" style="padding:2px 4px;color:#555">Bayar</td><td style="padding:2px 4px;text-align:right">${rp(cashRcv)}</td></tr>
         <tr><td colspan="2" style="padding:2px 4px;font-weight:bold">Kembali</td><td style="padding:2px 4px;text-align:right;font-weight:bold">${rp(Math.max(0,chg))}</td></tr>`
      : ''

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Struk ${order.order_number}</title>
      <style>*{box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:6px;color:#000}.center{text-align:center}.divider{border-top:1px dashed #000;margin:5px 0}table{width:100%;border-collapse:collapse}th{font-size:11px;border-bottom:1px solid #000;padding:2px 4px;text-align:left}.total-row td{font-weight:bold;border-top:1px dashed #000;padding-top:4px;font-size:13px}@media print{body{margin:0}}</style>
      </head><body>
      <div class="center"><div style="font-size:16px;font-weight:900">${storeName}</div>
      ${settings?.store_address ? `<div style="font-size:11px;color:#555">${settings.store_address}</div>` : ''}
      ${settings?.store_social ? `<div style="font-size:11px;color:#555">${settings.store_social}</div>` : ''}</div>
      <div class="divider"></div>
      <table><tbody>
        <tr><td style="color:#555">No. Order</td><td style="font-weight:bold;text-align:right">${order.order_number}</td></tr>
        <tr><td style="color:#555">Tanggal</td><td style="text-align:right">${timeStr}</td></tr>
        <tr><td style="color:#555">Jenis</td><td style="text-align:right">${order.order_type==='DINE_IN'?'Makan di Sini':'Bungkus'}</td></tr>
        <tr><td style="color:#555">Meja</td><td style="text-align:right">${order.order_type==='TAKEAWAY'?'-':order.table_number}</td></tr>
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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-base font-bold">📊 Dashboard — {userName}</h1>
        <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm ml-auto"/>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            ['🧾', `${summary.total}`, 'Total Order'],
            ['💰', formatRupiah(summary.revenue), 'Total Nilai'],
            ['💵', `${summary.cash} order`, 'Bayar Cash'],
            ['📱', `${summary.qris} order`, 'Bayar QRIS'],
          ].map(([ico, val, lbl]) => (
            <div key={String(lbl)} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-1">{ico}</div>
              <div className="text-lg font-black text-white">{val}</div>
              <div className="text-xs text-gray-500">{lbl}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabel riwayat pesanan */}
      <h2 className="text-sm font-bold mb-3">Pesanan Hari Ini</h2>
      {loading ? (
        <div className="text-center text-gray-600 py-8">Memuat...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-600 py-8">Belum ada pesanan hari ini</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            <thead className="bg-gray-800 text-gray-400 uppercase">
              <tr>
                {['No. Order','Waktu','Pelanggan','Pesanan','Total','Bayar','Status','Aksi'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2 font-mono font-bold text-orange-400">{o.order_number}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-400">{formatDate(o.created_at)}</td>
                  <td className="px-3 py-2">{o.customer_name || '-'}</td>
                  <td className="px-3 py-2 max-w-[160px]">
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
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => printReceipt(o)}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                      🖨️ Struk
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}