'use client'
// src/components/pos/MenuCard.tsx
// UPDATE dari sebelumnya:
// - Hapus tampilan gambar (image_url sudah tidak ada di DB)
// - Tambah badge stok — hijau kalau banyak, kuning kalau ≤5, merah kalau 0
// - Kalau stok = 0, otomatis disable meski is_available = true

import { useCartStore } from '@/store/cart.store'
import { formatRupiah } from '@/lib/utils'
import type { Menu } from '@/types/database'

export function MenuCard({ menu }: { menu: Menu }) {
  const { addItem, items } = useCartStore()
  const cartQty  = items.find(i => i.menuId === menu.id)?.quantity ?? 0

  // Menu tidak bisa dipesan kalau habis stok ATAU is_available = false
  const outOfStock = menu.stock <= 0
  const disabled   = !menu.is_available || outOfStock

  // Warna badge stok
  const stockBadge = outOfStock
    ? 'bg-red-900 text-red-400'
    : menu.stock <= 5
      ? 'bg-yellow-900 text-yellow-400'
      : 'bg-green-900 text-green-400'

  return (
    <button
      onClick={() => !disabled && addItem(menu)}
      disabled={disabled}
      className={`relative flex flex-col rounded-xl border text-left
        transition-all active:scale-95 overflow-hidden
        ${disabled
          ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
          : 'bg-gray-800 border-gray-700 hover:border-orange-500 cursor-pointer'}`}
    >
      {/* Area ikon (ganti gambar dengan emoji/warna) */}
      <div className="w-full aspect-square bg-gray-700 flex items-center justify-center relative">
        <span className="text-4xl text-gray-500">🍽️</span>

        {/* Overlay "HABIS" kalau tidak tersedia */}
        {disabled && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs font-bold text-red-400 bg-red-950 px-2 py-1 rounded">
              {outOfStock ? 'STOK HABIS' : 'TIDAK TERSEDIA'}
            </span>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-1">
        <p className="text-sm font-semibold text-white line-clamp-2">{menu.name}</p>
        <p className="text-sm font-bold text-orange-400">{formatRupiah(menu.price)}</p>

        {/* Badge stok */}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${stockBadge}`}>
          Stok: {menu.stock}
        </span>
      </div>

      {/* Badge jumlah di cart */}
      {cartQty > 0 && (
        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-orange-500
          flex items-center justify-center text-xs font-black text-white">
          {cartQty}
        </div>
      )}
    </button>
  )
}