'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MenuGrid } from '@/components/pos/MenuGrid'
import { CartPanel } from '@/components/pos/CartPanel'
import type { Menu } from '@/types/database'

const CATEGORIES = ['Semua', 'Makanan', 'Minuman', 'Snack']

export default function POSPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [category, setCategory] = useState('Semua')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchMenus = async () => {
      const { data } = await supabase.from('menus').select('*').order('name')
      if (data) setMenus(data as Menu[])
    }
    fetchMenus()

    // Subscribe perubahan menu — kalau admin toggle ketersediaan, langsung update di POS
    const ch = supabase.channel('menus-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, fetchMenus)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Filter berdasarkan kategori dan search
  const filtered = menus.filter(m => {
    const okCat = category === 'Semua' || m.category === category
    const okSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return okCat && okSearch
  })

  return (
    <div className="h-screen flex bg-gray-950 text-white overflow-hidden">

      {/* Panel Kiri — Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 pt-4 pb-3 bg-gray-900 border-b border-gray-800">
          <div className="flex justify-between mb-3">
            <h1 className="font-bold text-lg">🍽️ kasir-dapur</h1>
            <input placeholder="Cari menu..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:border-orange-500"/>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0
                  ${category === cat ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MenuGrid menus={filtered}/>
        </div>
      </div>

      {/* Panel Kanan — Cart */}
      <div className="w-[340px] shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col">
        <CartPanel/>
      </div>
    </div>
  )
}