'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { MenuGrid } from '@/components/pos/MenuGrid'
import { CartPanel } from '@/components/pos/CartPanel'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCartStore } from '@/store/cart.store'
import type { Menu, Category } from '@/types/database'

function POSContent() {
  const [menus,      setMenus]      = useState<Menu[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [category,   setCategory]   = useState('Semua')
  const [search,     setSearch]     = useState('')
  const [cartOpen,   setCartOpen]   = useState(false)
  const [branchCode, setBranchCode] = useState('')

  const { id: userId, profile } = useCurrentUser()
  const cartCount = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))
  const searchParams = useSearchParams()

  // OWNER: ambil branchId dari URL param ?branch=xxx
  // ADMIN/EMPLOYEE: ambil dari profile.branch_id
  const urlBranch = searchParams.get('branch')
  const branchId = urlBranch || profile?.branch_id || ''

  const servedByName = profile?.display_name || ''
  const servedById   = userId || ''

  useEffect(() => {
    if (!branchId) return

    const fetchMenus = async () => {
      const { data } = await supabase
        .from('menus').select('*')
        .eq('branch_id', branchId).order('name')
      if (data) setMenus(data as Menu[])
    }

    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories').select('*')
        .eq('branch_id', branchId).order('sort_order')
      if (data) setCategories(data as Category[])
    }

    const fetchBranchCode = async () => {
      const { data: branch } = await supabase
        .from('branches').select('code').eq('id', branchId).single()
      if (branch) setBranchCode(branch.code)
    }

    fetchMenus()
    fetchCategories()
    fetchBranchCode()

    const ch = supabase.channel(`pos-changes-${branchId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'menus', filter: `branch_id=eq.${branchId}` },
        fetchMenus)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `branch_id=eq.${branchId}` },
        fetchCategories)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [branchId])

  const filtered = menus.filter(m => {
    const okCat    = category === 'Semua' || m.category === category
    const okSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return okCat && okSearch
  })

  // Hanya tampil loading kalau userId sudah ada tapi branchId belum
  if (!branchId && userId) {
    return (
      <div className="h-[calc(100vh-49px)] flex items-center justify-center bg-gray-950 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm">Memuat data cabang...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-49px)] flex bg-gray-950 text-white overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 pt-3 pb-2 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-bold text-sm flex-1">Pilih Menu</h2>
            <input placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
                text-sm w-32 md:w-44 focus:outline-none focus:border-orange-500"/>
            <button onClick={() => setCartOpen(true)}
              className="relative lg:hidden bg-orange-600 hover:bg-orange-500 rounded-lg px-3 py-1.5 text-sm font-bold">
              🛒
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-orange-600
                  rounded-full text-xs font-black flex items-center justify-center">{cartCount}</span>
              )}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setCategory('Semua')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                category === 'Semua' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              Semua
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  category === cat.name ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <MenuGrid menus={filtered} />
        </div>
      </div>

      <div className="hidden lg:flex w-[320px] xl:w-[340px] shrink-0 border-l border-gray-800 bg-gray-900 flex-col">
        <CartPanel servedByName={servedByName} servedById={servedById} branchId={branchId} branchCode={branchCode} />
      </div>

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="relative bg-gray-900 rounded-t-2xl flex flex-col max-h-[85vh] z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2"/>
              <span className="font-bold text-sm mt-1">🛒 Cart</span>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CartPanel servedByName={servedByName} servedById={servedById} branchId={branchId} branchCode={branchCode} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function POSPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-49px)] flex items-center justify-center bg-gray-950 text-gray-500">
        <div className="text-center"><div className="text-4xl mb-3">⏳</div><p className="text-sm">Memuat POS...</p></div>
      </div>
    }>
      <POSContent />
    </Suspense>
  )
}