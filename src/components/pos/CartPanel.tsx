'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCartStore } from '@/store/cart.store'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'

export function CartPanel() {
  const { items, tableNumber, paymentMethod, decrementItem, removeItem,
          setTableNumber, setPaymentMethod, clearCart, getTotal, isReadyToCheckout }
    = useCartStore()
  const [submitting, setSubmitting] = useState(false)

  const handleCheckout = async () => {
    if (!isReadyToCheckout() || submitting) return
    setSubmitting(true)
    try {
      // Step 1: INSERT ke tabel orders
      const { data: order, error: e1 } = await supabase
        .from('orders')
        .insert({ table_number: tableNumber, total_price: getTotal(), payment_method: paymentMethod })
        .select().single()
      if (e1) throw e1

      // Step 2: INSERT semua item sekaligus
      const { error: e2 } = await supabase.from('order_items').insert(
        items.map(i => ({
          order_id: order.id, menu_id: i.menuId,
          menu_name: i.menuName, unit_price: i.unitPrice,   // snapshot!
          quantity: i.quantity, notes: i.notes
        }))
      )
      if (e2) throw e2

      // Step 3: Berhasil — bersihkan cart
      clearCart()
      toast.success(`✅ ${order.order_number} dikirim ke dapur!`,
        { description: `Meja ${tableNumber} · ${formatRupiah(getTotal())} via ${paymentMethod}` })
    } catch {
      toast.error('❌ Gagal submit — cek koneksi internet')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between">
        <h2 className="font-bold">🛒 Pesanan</h2>
        {items.length > 0 && <button onClick={clearCart} className="text-xs text-red-400">Kosongkan</button>}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {items.length === 0
          ? <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4">
              <span className="text-5xl mb-3">🛒</span>
              <p className="text-sm text-center">Tap menu untuk tambah pesanan</p>
            </div>
          : items.map(item => (
              <div key={item.menuId} className="px-4 py-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.menuName}</p>
                    <p className="text-xs text-orange-400">{formatRupiah(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => decrementItem(item.menuId)} className="w-7 h-7 rounded bg-gray-700 text-white font-bold">−</button>
                    <span className="w-5 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => useCartStore.getState().setQuantity(item.menuId, item.quantity+1)} className="w-7 h-7 rounded bg-gray-700 text-white font-bold">+</button>
                    <button onClick={() => removeItem(item.menuId)} className="w-7 h-7 rounded bg-gray-800 text-red-400 text-xs">✕</button>
                  </div>
                </div>
              </div>
            ))
        }
      </div>

      <div className="border-t border-gray-800 px-4 py-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-400">Total</span>
          <span className="text-xl font-black">{formatRupiah(getTotal())}</span>
        </div>
        <input placeholder="Nomor Meja *" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"/>
        <div className="grid grid-cols-2 gap-2">
          {(['CASH', 'QRIS'] as const).map(m => (
            <button key={m} onClick={() => setPaymentMethod(m)}
              className={`py-2.5 rounded-lg text-sm font-bold ${paymentMethod===m?'bg-orange-600 text-white':'bg-gray-800 text-gray-400'}`}>
              {m === 'CASH' ? '💵 Cash' : '📱 QRIS'}
            </button>
          ))}
        </div>
        <button onClick={handleCheckout} disabled={!isReadyToCheckout() || submitting}
          className={`w-full py-4 rounded-xl text-base font-black uppercase tracking-wider
            ${isReadyToCheckout() && !submitting ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
          {submitting ? 'Memproses...' : '✓ Bayar & Kirim ke Dapur'}
        </button>
      </div>
    </div>
  )
}