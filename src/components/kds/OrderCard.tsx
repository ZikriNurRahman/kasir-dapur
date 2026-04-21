'use client'
import { useEffect, useState } from 'react'
import { getTimerStyle, formatTime, cn } from '@/lib/utils'
import type { Order } from '@/types/database'

interface Props { order: Order; onMarkReady: (id: string) => Promise<void> }

export function OrderCard({ order, onMarkReady }: Props) {
  // Re-render tiap 30 detik → warna timer otomatis update
  const [, setTick] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const style = getTimerStyle(order.created_at)

  const handleReady = async () => {
    if (!confirm(`Tandai ${order.order_number} (Meja ${order.table_number}) SIAP?`)) return
    setLoading(true)
    await onMarkReady(order.id)
    setLoading(false)
  }

  return (
    <div className={cn(
      'flex flex-col rounded-xl border-2 p-5 min-w-[280px] max-w-[320px] shrink-0',
      style.bg, style.border, style.blink && 'animate-pulse'
    )}>

      {/* Header — nomor order dan timer */}
      <div className="flex justify-between mb-4">
        <div>
          <div className="text-4xl font-black">{order.order_number}</div>
          <div className="text-2xl font-bold text-gray-300">Meja {order.table_number}</div>
        </div>
        <div className="text-right">
          <div className={cn('text-3xl font-black', style.text)}>{style.label}</div>
          <div className="text-sm text-gray-500">{formatTime(order.created_at)}</div>
        </div>
      </div>

      <div className="h-px bg-gray-700 mb-4"/>

      {/* Daftar item pesanan */}
      <div className="flex-1 space-y-3 mb-5">
        {order.order_items?.map(item => (
          <div key={item.id} className="flex gap-3">
            <span className="text-2xl font-black text-white bg-gray-700 rounded-lg px-2 min-w-[40px] text-center">
              {item.quantity}×
            </span>
            <div>
              <div className="text-xl font-bold">{item.menu_name}</div>
              {item.notes && <div className="text-base text-yellow-400 italic">⚠️ {item.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Tombol besar — mudah diklik tangan basah */}
      <button onClick={handleReady} disabled={loading}
        className={cn(
          'w-full py-4 rounded-xl text-xl font-black uppercase tracking-wider transition-all active:scale-95',
          loading ? 'bg-gray-700 text-gray-500' : 'bg-green-500 hover:bg-green-400 text-white'
        )}>
        {loading ? '...' : '✓ SIAP SAJI'}
      </button>
    </div>
  )}