'use client'
// src/components/pos/CartPanel.tsx
// V3 UPDATE:
// - Tambah served_by_name (dari prop)
// - Untuk QRIS: buat order PENDING_PAYMENT → call Midtrans → tampilkan QR
// - Untuk Cash: input "uang diterima" → hitung kembalian
// - Setelah checkout berhasil: tombol cetak struk → ReceiptModal
// - Responsive: padding dan ukuran tombol lebih baik di mobile

import { useState } from 'react'
import { toast } from 'sonner'
import { useCartStore } from '@/store/cart.store'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import { ReceiptModal } from './ReceiptModal'
import type { Order, OrderType } from '@/types/database'

interface Props {
  servedByName: string   // nama kasir yang sedang login
  servedById:   string   // user id kasir
}

export function CartPanel({ servedByName, servedById }: Props) {
  const {
    items, tableNumber, paymentMethod, customerName, orderType,
    decrementItem, removeItem, setTableNumber, setPaymentMethod,
    setCustomerName, setOrderType, setItemNotes,
    clearCart, getTotal, isReadyToCheckout,
  } = useCartStore()

  const [submitting,    setSubmitting]    = useState(false)
  const [editNotesId,   setEditNotesId]   = useState<string | null>(null)
  const [cashReceived,  setCashReceived]  = useState('')       // input uang cash
  const [lastOrder,     setLastOrder]     = useState<Order | null>(null) // untuk struk
  const [showReceipt,   setShowReceipt]   = useState(false)
  const [qrisData,      setQrisData]      = useState<{qrString: string; orderId: string} | null>(null)

  const total    = getTotal()
  const cashNum  = parseFloat(cashReceived) || 0
  const change   = cashNum - total

  const handleCheckout = async () => {
    if (!isReadyToCheckout() || submitting) return

    // Validasi cash: uang yang diterima harus >= total
    if (paymentMethod === 'CASH' && cashNum > 0 && cashNum < total) {
      toast.error('Uang yang diterima kurang dari total!')
      return
    }

    setSubmitting(true)
    try {
      if (paymentMethod === 'CASH') {
        await checkoutCash()
      } else {
        await checkoutQris()
      }
    } catch (err) {
      console.error(err)
      toast.error('❌ Gagal checkout — cek koneksi')
    } finally {
      setSubmitting(false)
    }
  }

  const checkoutCash = async () => {
    // Buat order langsung PENDING (langsung ke dapur)
    const { data: order, error: e1 } = await supabase
      .from('orders')
      .insert({
        table_number:    tableNumber,
        customer_name:   customerName,
        order_type:      orderType,
        total_price:     total,
        payment_method:  'CASH',
        status:          'PENDING',
        served_by:       servedById   || null,
        served_by_name:  servedByName || '',
      })
      .select('*, order_items(*)')
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

    // Fetch order lengkap dengan items untuk struk
    const { data: fullOrder } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order.id)
      .single()

    toast.success(`✅ ${order.order_number} dikirim ke dapur!`)
    setLastOrder(fullOrder as Order)
    setShowReceipt(true)
    clearCart()
    setCashReceived('')
  }

  const checkoutQris = async () => {
    // Step 1: buat order dengan status PENDING_PAYMENT
    const { data: order, error: e1 } = await supabase
      .from('orders')
      .insert({
        table_number:    tableNumber,
        customer_name:   customerName,
        order_type:      orderType,
        total_price:     total,
        payment_method:  'QRIS',
        status:          'PENDING_PAYMENT',
        served_by:       servedById   || null,
        served_by_name:  servedByName || '',
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

    // Step 2: call API route untuk generate QR Midtrans
    const res = await fetch('/api/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId:     order.order_number,
        grossAmount: total,
        dbOrderId:   order.id,
      }),
    })

    if (!res.ok) {
      // Kalau Midtrans gagal, update order ke CANCELLED
      await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', order.id)
      throw new Error('Midtrans gagal generate QR')
    }

    const { qrString } = await res.json()
    // Tampilkan QR code — pelanggan scan, setelah bayar webhook akan update status ke PENDING
    setQrisData({ qrString, orderId: order.order_number })
    clearCart()
    toast.info('📱 Scan QR untuk membayar', { duration: 5000 })
  }

  // Kalau QR sudah dibayar (user tutup modal QR)
  const handleQrisClose = () => {
    setQrisData(null)
    toast.success('Pembayaran diproses, pesanan dikirim ke dapur setelah konfirmasi!')
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-sm">🛒 Pesanan</h2>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Kosongkan
            </button>
          )}
        </div>

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
                    <button
                      onClick={() => decrementItem(item.menuId)}
                      className="w-6 h-6 rounded bg-gray-700 text-white font-bold text-sm"
                    >−</button>
                    <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                    <button
                      onClick={() => useCartStore.getState().setQuantity(item.menuId, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-gray-700 text-white font-bold text-sm"
                    >+</button>
                    <button
                      onClick={() => removeItem(item.menuId)}
                      className="w-6 h-6 rounded bg-gray-800 text-red-400 text-xs ml-0.5"
                    >✕</button>
                  </div>
                </div>
                {/* Input catatan per item */}
                {editNotesId === item.menuId ? (
                  <input
                    autoFocus
                    placeholder="Catatan (tidak pedas, dll...)"
                    value={item.notes}
                    onChange={e => setItemNotes(item.menuId, e.target.value)}
                    onBlur={() => setEditNotesId(null)}
                    className="mt-1.5 w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5
                      text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                ) : (
                  <button
                    onClick={() => setEditNotesId(item.menuId)}
                    className="mt-1 text-xs text-gray-600 hover:text-gray-400"
                  >
                    {item.notes ? `📝 ${item.notes}` : '+ Catatan'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Form checkout */}
        <div className="border-t border-gray-800 px-3 py-3 space-y-2.5">
          {/* Total */}
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-xl font-black">{formatRupiah(total)}</span>
          </div>

          {/* Nama pembeli */}
          <input
            placeholder="Nama pembeli (opsional)"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
              text-sm focus:outline-none focus:border-orange-500"
          />

          {/* Nomor meja */}
          <input
            placeholder="Nomor Meja *"
            value={tableNumber}
            onChange={e => setTableNumber(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
              text-sm focus:outline-none focus:border-orange-500"
          />

          {/* Tipe order */}
          <div className="grid grid-cols-2 gap-2">
            {([
              ['DINE_IN',  '🪑 Di Sini'],
              ['TAKEAWAY', '🥡 Bungkus'],
            ] as [OrderType, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setOrderType(val)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                  orderType === val
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Metode pembayaran */}
          <div className="grid grid-cols-2 gap-2">
            {(['CASH', 'QRIS'] as const).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                  paymentMethod === m
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {m === 'CASH' ? '💵 Cash' : '📱 QRIS'}
              </button>
            ))}
          </div>

          {/* Input uang cash + info kembalian */}
          {paymentMethod === 'CASH' && (
            <div>
              <input
                type="number"
                placeholder="Uang diterima (opsional)"
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                  text-sm focus:outline-none focus:border-orange-500"
              />
              {cashNum > 0 && total > 0 && (
                <div className={`mt-1.5 text-xs font-bold text-right ${
                  change >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {change >= 0
                    ? `Kembalian: ${formatRupiah(change)}`
                    : `Kurang: ${formatRupiah(-change)}`
                  }
                </div>
              )}
            </div>
          )}

          {/* Nama kasir yang melayani — info saja, tidak bisa diubah */}
          {servedByName && (
            <div className="text-xs text-gray-600 text-right">
              Dilayani oleh: <span className="text-gray-400">{servedByName}</span>
            </div>
          )}

          {/* Tombol checkout */}
          <button
            onClick={handleCheckout}
            disabled={!isReadyToCheckout() || submitting}
            className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wider
              transition-colors ${
                isReadyToCheckout() && !submitting
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
          >
            {submitting
              ? 'Memproses...'
              : paymentMethod === 'QRIS'
                ? '📱 Generate QR & Kirim'
                : '✓ Bayar & Kirim ke Dapur'
            }
          </button>
        </div>
      </div>

      {/* Modal struk */}
      {showReceipt && lastOrder && (
        <ReceiptModal
          order={lastOrder}
          cashReceived={cashNum > 0 ? cashNum : undefined}
          onClose={() => { setShowReceipt(false); setLastOrder(null) }}
        />
      )}

      {/* Modal QR Midtrans */}
      {qrisData && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center text-black">
            <h3 className="font-bold text-lg mb-1">Scan QRIS</h3>
            <p className="text-sm text-gray-500 mb-4">Order: {qrisData.orderId}</p>
            {/* QR code dari QRIS string menggunakan Google Chart API */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrisData.qrString)}`}
              alt="QR Code"
              className="mx-auto mb-4 rounded-lg"
              width={200}
              height={200}
            />
            <p className="text-xs text-gray-500 mb-4">
              Pesanan akan otomatis masuk dapur setelah pembayaran berhasil
            </p>
            <button
              onClick={handleQrisClose}
              className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl text-sm"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </>
  )
}