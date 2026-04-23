'use client'
// src/components/pos/ReceiptModal.tsx
// Komponen struk yang bisa dicetak
// Gunakan window.print() dengan CSS @media print untuk tampilkan hanya struk

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import type { Order, StoreSettings } from '@/types/database'

interface Props {
  order:       Order
  cashReceived?: number // kalau bayar cash, berapa uang yang diterima
  onClose:     () => void
}

export function ReceiptModal({ order, cashReceived, onClose }: Props) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const items = order.order_items ?? []
  const change = cashReceived ? cashReceived - order.total_price : 0

  useEffect(() => {
    supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data as StoreSettings)
      })
  }, [])

  const handlePrint = () => window.print()

  // Format tanggal + waktu — e.g. "22 Apr 2026, 14:35"
  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('id-ID', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      {/* CSS hanya untuk mode print — sembunyikan semua kecuali struk */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-content,
          #receipt-content * { visibility: visible !important; }
          #receipt-content {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;   /* ukuran kertas struk standar */
            padding: 4mm !important;
            font-size: 11px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Overlay background */}
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 no-print">
        {/* Modal container */}
        <div className="bg-white text-black rounded-xl w-full max-w-xs overflow-y-auto max-h-[90vh]">

          {/* Konten struk — ini yang akan dicetak */}
          <div id="receipt-content" className="p-5 font-mono text-xs">

            {/* Header toko */}
            <div className="text-center mb-3">
              <div className="text-base font-black">
                {settings?.store_name ?? 'kasir-dapur'}
              </div>
              {settings?.store_address && (
                <div className="text-xs text-gray-600 mt-0.5">{settings.store_address}</div>
              )}
              {settings?.store_social && (
                <div className="text-xs text-gray-500">{settings.store_social}</div>
              )}
            </div>

            {/* Garis pemisah */}
            <div className="border-t border-dashed border-gray-400 my-2"/>

            {/* Info order */}
            <div className="space-y-0.5 text-xs mb-2">
              <div className="flex justify-between">
                <span className="text-gray-500">No. Order</span>
                <span className="font-bold">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal</span>
                <span>{formatDateTime(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jenis</span>
                <span>{order.order_type === 'DINE_IN' ? 'Makan di Sini' : 'Bungkus'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Meja</span>
                <span>{order.order_type === 'TAKEAWAY' ? '-' : order.table_number}</span>
              </div>
              {order.customer_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Pelanggan</span>
                  <span>{order.customer_name}</span>
                </div>
              )}
              {order.served_by_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Dilayani</span>
                  <span>{order.served_by_name}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2"/>

            {/* Tabel pesanan — 3 kolom: menu | qty | total */}
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-0.5 font-semibold">Menu</th>
                  <th className="text-center py-0.5 font-semibold w-6">Qty</th>
                  <th className="text-right py-0.5 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="py-0.5 pr-2">
                      <div>{item.menu_name}</div>
                      {item.notes && (
                        <div className="text-gray-500 italic text-xs">↳ {item.notes}</div>
                      )}
                      <div className="text-gray-400">{formatRupiah(item.unit_price)}</div>
                    </td>
                    <td className="py-0.5 text-center">{item.quantity}</td>
                    <td className="py-0.5 text-right font-medium">
                      {formatRupiah(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-gray-400 my-2"/>

            {/* Total dan pembayaran */}
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between font-black text-sm">
                <span>TOTAL</span>
                <span>{formatRupiah(order.total_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pembayaran</span>
                <span className="font-semibold">{order.payment_method}</span>
              </div>
              {/* Kembalian — hanya untuk Cash */}
              {order.payment_method === 'CASH' && cashReceived && cashReceived > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bayar</span>
                    <span>{formatRupiah(cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Kembali</span>
                    <span>{formatRupiah(change)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 mt-2 mb-3"/>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500">
              <p>{settings?.footer_text ?? 'Terima kasih, sampai jumpa lagi! 🍽️'}</p>
            </div>
          </div>

          {/* Tombol aksi — tidak akan tercetak (class no-print) */}
          <div className="p-4 border-t border-gray-200 flex gap-3 no-print">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg
                text-sm font-semibold text-gray-700 transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg
                text-sm font-bold text-white transition-colors"
            >
              🖨️ Cetak
            </button>
          </div>
        </div>
      </div>
    </>
  )
}