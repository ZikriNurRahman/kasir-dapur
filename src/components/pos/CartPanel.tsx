'use client'
// src/components/pos/CartPanel.tsx
// UPDATE dari sebelumnya:
// - Tambah input nama pembeli (customer_name)
// - Tambah pilihan Makan di Tempat vs Bungkus (order_type)
// - Tambah tombol untuk input catatan per item (notes)
// - Update handleCheckout untuk kirim field baru ke DB

import { useState } from 'react'
import { toast } from 'sonner'
import { useCartStore } from '@/store/cart.store'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { OrderType } from '@/types/database'

export function CartPanel() {
  const {
    items, tableNumber, paymentMethod, customerName, orderType,
    decrementItem, removeItem, setTableNumber, setPaymentMethod,
    setCustomerName, setOrderType, setItemNotes,
    clearCart, getTotal, isReadyToCheckout,
  } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  // Track item mana yang sedang dibuka input notesnya
  const [editNotesId, setEditNotesId] = useState<string | null>(null)

  const handleCheckout = async () => {
    if (!isReadyToCheckout() || submitting) return
    setSubmitting(true)

    try {
      // Step 1: INSERT ke tabel orders — sekarang dengan customer_name & order_type
      const { data: order, error: e1 } = await supabase
        .from('orders')
        .insert({
          table_number:   tableNumber,
          customer_name:  customerName,   // ← field baru
          order_type:     orderType,       // ← field baru
          total_price:    getTotal(),
          payment_method: paymentMethod,
        })
        .select()
        .single()
      if (e1) throw e1

      // Step 2: INSERT semua item sekaligus
      const { error: e2 } = await supabase.from('order_items').insert(
        items.map(i => ({
          order_id:   order.id,
          menu_id:    i.menuId,
          menu_name:  i.menuName,
          unit_price: i.unitPrice,
          quantity:   i.quantity,
          notes:      i.notes,   // catatan per item
        }))
      )
      if (e2) throw e2

      // Step 3: Berhasil — bersihkan cart
      clearCart()
      toast.success(`✅ ${order.order_number} dikirim ke dapur!`, {
        description: `${customerName || 'Tanpa nama'} · Meja ${tableNumber} · ${formatRupiah(getTotal())} via ${paymentMethod}`,
      })
    } catch {
      toast.error('❌ Gagal submit — cek koneksi internet')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header cart */}
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
        <h2 className="font-bold text-sm">🛒 Pesanan</h2>
        {items.length > 0 && (
          <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">
            Kosongkan
          </button>
        )}
      </div>

      {/* List item di cart */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4">
            <span className="text-5xl mb-3">🛒</span>
            <p className="text-sm text-center">Tap menu untuk tambah pesanan</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.menuId} className="px-4 py-3">
              <div className="flex justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.menuName}</p>
                  <p className="text-xs text-orange-400">{formatRupiah(item.unitPrice)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => decrementItem(item.menuId)}
                    className="w-7 h-7 rounded bg-gray-700 text-white font-bold text-sm"
                  >−</button>
                  <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => useCartStore.getState().setQuantity(item.menuId, item.quantity + 1)}
                    className="w-7 h-7 rounded bg-gray-700 text-white font-bold text-sm"
                  >+</button>
                  <button
                    onClick={() => removeItem(item.menuId)}
                    className="w-7 h-7 rounded bg-gray-800 text-red-400 text-xs"
                  >✕</button>
                </div>
              </div>

              {/* Tombol untuk tambah/edit catatan item */}
              {editNotesId === item.menuId ? (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    placeholder="Catatan (tidak pedas, dll...)"
                    value={item.notes}
                    onChange={e => setItemNotes(item.menuId, e.target.value)}
                    onBlur={() => setEditNotesId(null)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5
                      text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditNotesId(item.menuId)}
                  className="mt-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {item.notes ? `📝 ${item.notes}` : '+ Catatan'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bagian bawah — input info order + tombol checkout */}
      <div className="border-t border-gray-800 px-4 py-4 space-y-3">
        {/* Total harga */}
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Total</span>
          <span className="text-xl font-black">{formatRupiah(getTotal())}</span>
        </div>

        {/* Nama pembeli — opsional tapi berguna untuk KDS */}
        <input
          placeholder="Nama pembeli (opsional)"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
            text-sm focus:outline-none focus:border-orange-500"
        />

        {/* Nomor meja — wajib */}
        <input
          placeholder="Nomor Meja *"
          value={tableNumber}
          onChange={e => setTableNumber(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
            text-sm focus:outline-none focus:border-orange-500"
        />

        {/* Makan di tempat vs Bungkus */}
        <div className="grid grid-cols-2 gap-2">
          {([
            ['DINE_IN',  '🪑 Makan di Sini'],
            ['TAKEAWAY', '🥡 Bungkus'],
          ] as [OrderType, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setOrderType(val)}
              className={`py-2.5 rounded-lg text-xs font-bold transition-colors ${
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
              className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${
                paymentMethod === m
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {m === 'CASH' ? '💵 Cash' : '📱 QRIS'}
            </button>
          ))}
        </div>

        {/* Tombol checkout */}
        <button
          onClick={handleCheckout}
          disabled={!isReadyToCheckout() || submitting}
          className={`w-full py-4 rounded-xl text-base font-black uppercase tracking-wider
            transition-colors ${
              isReadyToCheckout() && !submitting
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
        >
          {submitting ? 'Memproses...' : '✓ Bayar & Kirim ke Dapur'}
        </button>
      </div>
    </div>
  )
}