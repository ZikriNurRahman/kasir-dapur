'use client'
// src/components/pos/MenuCard.tsx
// V3 UPDATE:
// - HAPUS semua UI gambar/image placeholder — bersih tanpa kotak kosong
// - Card sekarang lebih compact: hanya nama, harga, stok
// - Responsive untuk layar kecil

import { useCartStore } from '@/store/cart.store'
import { formatRupiah } from '@/lib/utils'
import type { Menu } from '@/types/database'

export function MenuCard({ menu }: { menu: Menu }) {
  const { addItem, items } = useCartStore()
  const cartQty   = items.find(i => i.menuId === menu.id)?.quantity ?? 0
  const outOfStock = menu.stock <= 0
  const disabled   = !menu.is_available || outOfStock

  const stockColor = outOfStock
    ? 'text-red-400'
    : menu.stock <= 5
      ? 'text-yellow-400'
      : 'text-green-400'

  return (
    <button
      onClick={() => !disabled && addItem(menu)}
      disabled={disabled}
      className={`
        relative flex flex-col justify-between rounded-xl border text-left
        transition-all active:scale-95 p-3 min-h-[90px]
        ${disabled
          ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
          : 'bg-gray-800 border-gray-700 hover:border-orange-500 cursor-pointer'
        }
      `}
    >
      {/* Nama menu */}
      <p className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-2">
        {menu.name}
      </p>

      {/* Harga dan stok */}
      <div>
        <p className="text-sm font-bold text-orange-400">{formatRupiah(menu.price)}</p>
        <p className={`text-xs font-medium mt-0.5 ${stockColor}`}>
          {outOfStock ? 'Habis' : `Stok: ${menu.stock}`}
        </p>
      </div>

      {/* Overlay kalau tidak tersedia */}
      {disabled && (
        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
          <span className="text-xs font-bold text-red-300 bg-red-950/80 px-2 py-1 rounded">
            {outOfStock ? 'HABIS' : 'N/A'}
          </span>
        </div>
      )}

      {/* Badge qty di cart */}
      {cartQty > 0 && (
        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-orange-500
          flex items-center justify-center text-xs font-black text-white shadow-lg">
          {cartQty}
        </div>
      )}
    </button>
  )
}