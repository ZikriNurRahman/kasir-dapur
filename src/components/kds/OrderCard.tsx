'use client'
// src/components/kds/OrderCard.tsx
// V3 UPDATE:
// - Tampilkan served_by_name (nama kasir yang melayani)
// - Responsive: card lebih kecil di layar kecil

import { useEffect, useState } from 'react'
import { getTimerStyle, formatTime, cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types/database'

interface Props {
  order:       Order
  onMarkReady: (id: string) => Promise<void>
}

export function OrderCard({ order, onMarkReady }: Props) {
  const [, setTick]   = useState(0)
  const [loading, setLoading] = useState(false)

  // Re-render tiap 30 detik agar warna timer update otomatis
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const style      = getTimerStyle(order.created_at)
  const items      = order.order_items ?? []
  const allReady   = items.length > 0 && items.every(i => i.is_ready)
  const readyCount = items.filter(i => i.is_ready).length

  const handleToggleItem = async (itemId: string, currentReady: boolean) => {
    await supabase
      .from('order_items')
      .update({ is_ready: !currentReady })
      .eq('id', itemId)
    // State update handle oleh Realtime listener di kds/page.tsx
  }

  const handleReady = async () => {
    if (!allReady || loading) return
    if (!confirm(`Tandai ${order.order_number} SIAP?`)) return
    setLoading(true)
    await onMarkReady(order.id)
    setLoading(false)
  }

  return (
    <div className={cn(
      'flex flex-col rounded-xl border-2 p-4 md:p-5',
      'w-full sm:min-w-[270px] sm:max-w-[320px] shrink-0',
      style.bg, style.border, style.blink && 'animate-pulse'
    )}>

      {/* Header card */}
      <div className="flex justify-between mb-3">
        <div>
          <div className="text-3xl md:text-4xl font-black">{order.order_number}</div>
          <div className="text-lg md:text-xl font-bold text-gray-300">
            Meja {order.table_number}
          </div>
          {order.customer_name && (
            <div className="text-sm text-gray-400 mt-0.5">
              👤 {order.customer_name}
            </div>
          )}
          {/* V3 NEW: nama kasir yang melayani */}
          {order.served_by_name && (
            <div className="text-xs text-gray-500 mt-0.5">
              🧑‍💼 {order.served_by_name}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 ml-2">
          <div className={cn('text-2xl font-black', style.text)}>{style.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{formatTime(order.created_at)}</div>
          <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
            order.order_type === 'TAKEAWAY'
              ? 'bg-blue-900 text-blue-400'
              : 'bg-gray-700 text-gray-400'
          }`}>
            {order.order_type === 'TAKEAWAY' ? '🥡 Bungkus' : '🪑 Di Sini'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">Progress masak</span>
        <span className={`text-xs font-bold ${allReady ? 'text-green-400' : 'text-gray-400'}`}>
          {readyCount}/{items.length}
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            allReady ? 'bg-green-500' : 'bg-orange-500'
          }`}
          style={{ width: items.length > 0 ? `${(readyCount / items.length) * 100}%` : '0%' }}
        />
      </div>

      <div className="h-px bg-gray-700 mb-3"/>

      {/* Daftar item + ceklis */}
      <div className="flex-1 space-y-2 mb-4">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => handleToggleItem(item.id, item.is_ready)}
            className={cn(
              'w-full flex gap-3 items-start p-2 rounded-lg text-left transition-all active:scale-95',
              item.is_ready
                ? 'bg-green-950/50 opacity-60'
                : 'bg-gray-800/40 hover:bg-gray-700/40'
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
              item.is_ready ? 'bg-green-500 border-green-500' : 'border-gray-600'
            )}>
              {item.is_ready && <span className="text-white text-xs font-black">✓</span>}
            </div>
            <div className="flex-1">
              <div className={cn(
                'text-base md:text-lg font-bold transition-all',
                item.is_ready ? 'line-through text-gray-600' : 'text-white'
              )}>
                {item.quantity}× {item.menu_name}
              </div>
              {item.notes && (
                <div className="text-sm text-yellow-400 italic mt-0.5">⚠️ {item.notes}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Tombol SIAP SAJI */}
      <button
        onClick={handleReady}
        disabled={!allReady || loading}
        className={cn(
          'w-full py-3 md:py-4 rounded-xl text-base md:text-lg font-black uppercase tracking-wider',
          'transition-all active:scale-95',
          allReady && !loading
            ? 'bg-green-500 hover:bg-green-400 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        )}
      >
        {loading
          ? '...'
          : allReady
            ? '✓ SIAP SAJI'
            : `Ceklis dulu (${readyCount}/${items.length})`
        }
      </button>
    </div>
  )
}