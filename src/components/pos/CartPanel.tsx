'use client'
// src/components/pos/CartPanel.tsx
// FIX V4:
// - Simpan cashReceived ke DB (cash_received kolom) agar struk bisa dicetak kapanpun
// - Fix: cashReceivedAtCheckout disimpan sebelum clearCart() dipanggil
// - FIX: modal struk tidak muncul langsung — ada tombol "Cetak Struk" di list orders
// - Tambah: mark order COMPLETED saat struk dicetak (atau tombol "Selesai")

import { useState } from 'react'
import { toast } from 'sonner'
import { useCartStore } from '@/store/cart.store'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { Order, OrderType } from '@/types/database'
import { generateOrderNumber } from '@/lib/utils'

interface Props {
  servedByName: string
  servedById:   string
  branchId:     string
  branchCode: string
}

export function CartPanel({ servedByName, servedById, branchId, branchCode }: Props) {
  const {
    items, tableNumber, paymentMethod, customerName, orderType,
    decrementItem, removeItem, setTableNumber, setPaymentMethod,
    setCustomerName, setOrderType, setItemNotes,
    clearCart, getTotal, isReadyToCheckout,
  } = useCartStore()

  const [submitting,  setSubmitting]  = useState(false)
  const [editNotesId, setEditNotesId] = useState<string | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  // V4: simpan lastOrderId — untuk tampilkan tombol cetak struk setelah berhasil
  const [lastOrderId,  setLastOrderId]  = useState<string | null>(null)
  const [lastOrderNum, setLastOrderNum] = useState<string>('')
  const [qrisData, setQrisData] = useState<{ qrString: string; orderId: string } | null>(null)

  const total   = getTotal()
  const cashNum = parseFloat(cashReceived) || 0
  const change  = cashNum - total

  const handleCheckout = async () => {
  if (!isReadyToCheckout() || submitting) return
  if (paymentMethod === 'CASH' && cashNum > 0 && cashNum < total) {
    toast.error('Uang yang diterima kurang dari total!'); return
  }
  setSubmitting(true)
  try {
    if (paymentMethod === 'CASH')       await checkoutCash()
    else if (paymentMethod === 'QRIS')  await checkoutQris()
    else                                await checkoutLater()
  } catch (err: any) {
    // Log detail lengkap — biar ketahuan error-nya apa
    console.error('Checkout error detail:', {
      message: err?.message,
      code:    err?.code,
      details: err?.details,
      hint:    err?.hint,
      full:    JSON.stringify(err),
    })
    const msg = err?.message || err?.details || err?.hint || JSON.stringify(err) || 'Unknown error'
    toast.error(`❌ ${msg}`)
  } finally {
    setSubmitting(false)
  }
}

  const orderNumber = generateOrderNumber(branchCode || 'STR')

  const checkoutCash = async () => {
    // Simpan cashNum sebelum clear — ini fix bug kembalian hilang!
    const savedCashNum = cashNum

    const { data: order, error: e1 } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        table_number:   tableNumber,
        customer_name:  customerName,
        order_type:     orderType,
        total_price:    total,
        payment_method: 'CASH',
        status:         'PENDING',
        served_by:      servedById   || null,
        served_by_name: servedByName || '',
        cash_received:  savedCashNum,  // ← simpan ke DB
        branch_id:      branchId,
      })
      .select()
      .single()
    if (e1) throw e1

    const { error: e2 } = await supabase.from('order_items').insert(
      items.map(i => ({
        order_id:   order.id,
        menu_id:    i.menuId,
        menu_name:  i.menuName,
        unit_price: i.unitPrice,
        quantity:   i.quantity,
        notes:      i.notes,
      }))
    )
    if (e2) throw e2

    // FIX ALUR: tidak langsung buka struk — simpan ID untuk tombol cetak
    setLastOrderId(order.id)
    setLastOrderNum(order.order_number)
    clearCart()
    setCashReceived('')
    toast.success(`✅ ${order.order_number} dikirim ke dapur!`, {
      description: savedCashNum > 0
        ? `Kembalian: ${formatRupiah(change)}`
        : undefined,
      action: {
        label: '🖨️ Cetak Struk',
        onClick: () => openReceipt(order.id),
      },
      duration: 8000, // beri waktu lebih panjang agar bisa klik tombol cetak
    })
  }

  const checkoutQris = async () => {

    const { data: order, error: e1 } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        table_number:   tableNumber,
        customer_name:  customerName,
        order_type:     orderType,
        total_price:    total,
        payment_method: 'QRIS',
        status:         'PENDING_PAYMENT',
        served_by:      servedById   || null,
        served_by_name: servedByName || '',
        branch_id:      branchId,
      })
      .select()
      .single()
    if (e1) throw e1

    const { error: e2 } = await supabase.from('order_items').insert(
      items.map(i => ({
        order_id:   order.id,
        menu_id:    i.menuId,
        menu_name:  i.menuName,
        unit_price: i.unitPrice,
        quantity:   i.quantity,
        notes:      i.notes,
      }))
    )
    if (e2) throw e2

    // Call API Midtrans untuk generate QR
    const res = await fetch('/api/midtrans', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        orderId:     order.order_number,
        grossAmount: Math.round(total), // Midtrans butuh integer
        dbOrderId:   order.id,
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.qrString) {
      // Rollback: cancel order jika Midtrans gagal
      await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', order.id)
      throw new Error(data.error ?? 'Midtrans gagal generate QR — pastikan MIDTRANS_SERVER_KEY sudah di-set di Vercel env')
    }

    setQrisData({ qrString: data.qrString, orderId: order.order_number })
    setLastOrderId(order.id)
    setLastOrderNum(order.order_number)
    clearCart()
    toast.info('📱 Scan QR untuk membayar', { duration: 5000 })
  }

  const checkoutLater = async () => {
  const { data: order, error: e1 } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber, 
      table_number:   tableNumber,
      customer_name:  customerName,
      order_type:     orderType,
      total_price:    total,
      payment_method: 'LATER',   // bayar nanti
      status:         'PENDING', // langsung masuk dapur
      served_by:      servedById   || null,
      served_by_name: servedByName || '',
      cash_received:  0,
      branch_id:      branchId,
    })
    .select().single()
  if (e1) throw e1

  const { error: e2 } = await supabase.from('order_items').insert(
    items.map(i => ({
      order_id:   order.id,
      menu_id:    i.menuId,
      menu_name:  i.menuName,
      unit_price: i.unitPrice,
      quantity:   i.quantity,
      notes:      i.notes,
    }))
  )
  if (e2) throw e2

  setLastOrderId(order.id)
  setLastOrderNum(order.order_number)
  clearCart()
  toast.success(`✅ ${order.order_number} dikirim ke dapur! (Bayar nanti)`, { duration: 5000 })
}

  // Buka struk dari orders yang sudah selesai — bisa dipanggil kapanpun
  const openReceipt = async (orderId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)  
      .single()
    if (data) printReceipt(data as Order)
    else toast.error('Data order tidak ditemukan')
  }

  // Print struk via window baru
  const printReceipt = (order: Order) => {
    // Fetch settings toko dulu
    supabase.from('store_settings').select('*').eq('branch_id', branchId).single().then(({ data: settings }) => {
      const cashRcv  = order.cash_received || 0
      const chg      = cashRcv - order.total_price
      const timeStr  = new Date(order.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      const items    = order.order_items ?? []
      const storeName = settings?.store_name ?? 'kasir-dapur'

      const itemRows = items.map(i => `
        <tr>
          <td style="padding:2px 4px;text-align:left">
            ${i.menu_name}
            ${i.notes ? `<br/><span style="color:#888;font-size:10px">↳ ${i.notes}</span>` : ''}
            <br/><span style="color:#888;font-size:10px">${new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(i.unit_price)}</span>
          </td>
          <td style="padding:2px 4px;text-align:center">${i.quantity}</td>
          <td style="padding:2px 4px;text-align:right">
            ${new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(i.unit_price * i.quantity)}
          </td>
        </tr>
      `).join('')

      const rp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n)

      const cashSection = order.payment_method === 'CASH' && cashRcv > 0
  ? `<tr><td colspan="2" style="padding:2px 4px;color:#555">Bayar</td><td style="padding:2px 4px;text-align:right">${rp(cashRcv)}</td></tr>
     <tr><td colspan="2" style="padding:2px 4px;font-weight:bold">Kembali</td><td style="padding:2px 4px;text-align:right;font-weight:bold">${rp(Math.max(0,chg))}</td></tr>`
  : order.payment_method === 'LATER'
    ? `<tr><td colspan="3" style="padding:4px;text-align:center;color:#D97706;font-weight:bold">⏰ BELUM LUNAS</td></tr>`
    : ''

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
        <title>Struk ${order.order_number}</title>
        <style>
          *{box-sizing:border-box}
          body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:6px;color:#000}
          .center{text-align:center}
          .divider{border-top:1px dashed #000;margin:5px 0}
          table{width:100%;border-collapse:collapse}
          th{font-size:11px;border-bottom:1px solid #000;padding:2px 4px;text-align:left}
          .total-row td{font-weight:bold;border-top:1px dashed #000;padding-top:4px;font-size:13px}
          @media print{body{margin:0}}
        </style></head><body>
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
        <div class="center" style="margin-top:8px;font-size:12px">${settings?.footer_text ?? 'Terima kasih, sampai jumpa lagi! 🍽️'}</div>
        <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
        </body></html>`

      const win = window.open('', '_blank', 'width=400,height=600')
      if (win) { win.document.write(html); win.document.close() }
    })
  }

  

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-sm text-white">🛒 Pesanan</h2>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">
              Kosongkan
            </button>
          )}
        </div>

        {/* Tombol cetak struk order terakhir — muncul setelah checkout */}
        {lastOrderId && (
          <div className="mx-3 mt-3 p-2.5 bg-green-950 border border-green-800 rounded-lg">
            <p className="text-xs text-green-400 mb-2">✅ {lastOrderNum} berhasil dikirim ke dapur</p>
            <div className="flex gap-2">
              <button
                onClick={() => openReceipt(lastOrderId)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-white"
              >
                🖨️ Cetak Struk
              </button>
              <button
                onClick={() => { setLastOrderId(null); setLastOrderNum('') }}
                className="py-2 px-3 text-gray-500 hover:text-gray-400 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* List item */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4">
              <span className="text-5xl mb-3">🛒</span>
              <p className="text-sm text-center">Tap menu untuk tambah pesanan</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.menuId} className="px-3 py-2.5">
                <div className="flex justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.menuName}</p>
                    <p className="text-xs text-orange-400">{formatRupiah(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => decrementItem(item.menuId)}
                      className="w-6 h-6 rounded bg-gray-700 text-white font-bold text-sm">−</button>
                    <span className="w-5 text-center font-bold text-sm text-white">{item.quantity}</span>
                    <button onClick={() => useCartStore.getState().setQuantity(item.menuId, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-gray-700 text-white font-bold text-sm">+</button>
                    <button onClick={() => removeItem(item.menuId)}
                      className="w-6 h-6 rounded bg-gray-800 text-red-400 text-xs">✕</button>
                  </div>
                </div>
                {editNotesId === item.menuId ? (
                  <input autoFocus placeholder="Catatan..." value={item.notes}
                    onChange={e => setItemNotes(item.menuId, e.target.value)}
                    onBlur={() => setEditNotesId(null)}
                    className="mt-1.5 w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5
                               text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"/>
                ) : (
                  <button onClick={() => setEditNotesId(item.menuId)}
                    className="mt-1 text-xs text-gray-600 hover:text-gray-400">
                    {item.notes ? `📝 ${item.notes}` : '+ Catatan'}
                  </button>
                )}
                <div className="flex justify-between mt-0.5">
                  <span className="text-xs text-gray-700">{item.quantity} × {formatRupiah(item.unitPrice)}</span>
                  <span className="text-xs font-bold text-gray-500">{formatRupiah(item.unitPrice * item.quantity)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Form checkout */}
        <div className="border-t border-gray-800 px-3 py-3 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-xl font-black text-white">{formatRupiah(total)}</span>
          </div>

          <input placeholder="Nama pembeli (opsional)" value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"/>

          <input placeholder="Nomor Meja *" value={tableNumber}
            onChange={e => setTableNumber(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"/>

          <div className="grid grid-cols-2 gap-2">
            {([['DINE_IN','🪑 Di Sini'],['TAKEAWAY','🥡 Bungkus']] as [OrderType,string][]).map(([v,l])=>(
              <button key={v} onClick={() => setOrderType(v)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors
                  ${orderType===v?'bg-orange-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">  {/* ← ganti jadi 3 kolom */}
  {(['CASH','QRIS','LATER'] as const).map(m => (
    <button key={m} onClick={() => setPaymentMethod(m)}
      className={`py-2 rounded-lg text-xs font-bold transition-colors
        ${paymentMethod===m?'bg-orange-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
      {m==='CASH' ? '💵 Cash' : m==='QRIS' ? '📱 QRIS' : '⏰ Nanti'}
    </button>
  ))}
</div>

          {paymentMethod === 'CASH' && (
            <div>
              <input type="number" placeholder="Uang diterima (Rp)" value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                           text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"/>
              {cashNum > 0 && total > 0 && (
                <div className={`mt-1 text-xs font-bold text-right ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {change >= 0 ? `Kembalian: ${formatRupiah(change)}` : `Kurang: ${formatRupiah(-change)}`}
                </div>
              )}
            </div>
          )}

          {servedByName && (
            <div className="text-xs text-gray-600">
              Dilayani: <span className="text-orange-400 font-semibold">{servedByName}</span>
            </div>
          )}

          <button onClick={handleCheckout}
            disabled={!isReadyToCheckout() || submitting}
            className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-colors
              ${isReadyToCheckout() && !submitting
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
            {submitting ? 'Memproses...'
  : paymentMethod==='QRIS' ? '📱 Generate QR & Kirim'
  : paymentMethod==='LATER' ? '⏰ Kirim ke Dapur (Bayar Nanti)'
  : '✓ Bayar & Kirim ke Dapur'}
          </button>
        </div>
      </div>

      {/* Modal QR */}
      {qrisData && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center text-black">
            <h3 className="font-bold text-lg mb-1">Scan QRIS</h3>
            <p className="text-sm text-gray-500 mb-4">Order: {qrisData.orderId}</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrisData.qrString)}`}
              alt="QR Code Pembayaran"
              className="mx-auto mb-4 rounded-lg border"
              width={220} height={220}
            />
            <p className="text-xs text-gray-400 mb-4">
              Pesanan masuk dapur otomatis setelah pembayaran terkonfirmasi
            </p>
            <div className="flex gap-2">
              <button onClick={() => openReceipt(lastOrderId!)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm">
                🖨️ Cetak Struk
              </button>
              <button onClick={() => setQrisData(null)}
                className="flex-1 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-sm">
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}