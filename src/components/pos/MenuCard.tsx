'use client'
import { useCartStore } from '@/store/cart.store'
import { formatRupiah } from '@/lib/utils'
import type { Menu } from '@/types/database'

export function MenuCard({ menu }: { menu: Menu }) {
  const { addItem, items } = useCartStore()
  const cartQty = items.find(i => i.menuId === menu.id)?.quantity ?? 0

  return (
    <button onClick={() => menu.is_available && addItem(menu)} disabled={!menu.is_available}
      className={`relative flex flex-col rounded-xl border text-left transition-all active:scale-95 overflow-hidden
        ${menu.is_available
          ? 'bg-gray-800 border-gray-700 hover:border-orange-500 cursor-pointer'
          : 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'}`}>

      {/* Gambar */}
      <div className="w-full aspect-square bg-gray-700 flex items-center justify-center text-4xl text-gray-500">
        {menu.image_url
          ? <img src={menu.image_url} alt={menu.name} className="w-full h-full object-cover"/>
          : '🍽️'}
        {!menu.is_available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs font-bold text-red-400 bg-red-950 px-2 py-1 rounded">HABIS</span>
          </div>
        )}
      </div>

      <div className="p-2.5">
        <p className="text-sm font-semibold text-white line-clamp-2">{menu.name}</p>
        <p className="text-sm font-bold text-orange-400 mt-1">{formatRupiah(menu.price)}</p>
      </div>

      {/* Badge qty di cart */}
      {cartQty > 0 && (
        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-black text-white">
          {cartQty}
        </div>
      )}
    </button>
  )
}