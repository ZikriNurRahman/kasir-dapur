'use client'
import { MenuCard } from './MenuCard'
import type { Menu } from '@/types/database'

export function MenuGrid({ menus }: { menus: Menu[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
      {menus.map(m => <MenuCard key={m.id} menu={m}/>)}
    </div>
  )
}