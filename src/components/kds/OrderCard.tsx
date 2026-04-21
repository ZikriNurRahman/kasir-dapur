'use client'
// src/components/kds/OrderCard.tsx
// UPDATE dari sebelumnya:
// - Tambah ceklis per item — dapur klik ✓ per menu satu-satu
// - Tombol "SIAP SAJI" hanya aktif kalau SEMUA item sudah diceklis
// - Saat item diceklis → update is_ready = true di DB (via supabase)
// - Tampilkan customer_name dan order_type (DINE_IN/TAKEAWAY)

import { useEffect, useState } from 'react'
import { getTimerStyle, formatTime, cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types/database'

interface Props {
  order:       Order
  onMarkReady: (id: string) => Promise<void>
}

export function OrderCard({ order, onMarkReady }: Props) {
  // Re-render tiap 30 detik agar warna timer otomatis update
  const [, setTick]  = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const style = getTimerStyle(order.created_at)
  const items = order.order_items ?? []

  // Semua item harus is_ready = true sebelum bisa klik "Siap Saji"
  const allReady   = items.length > 0 && items.every(i => i.is_ready)
  const readyCount = items.filter(i => i.is_ready).length

  // Ceklis satu item → update is_ready di DB
  // Supabase Realtime di KDS page akan subscribe perubahan ini
  // sehingga semua KDS (kalau ada lebih dari satu layar) sync otomatis
  const handleToggleItem = async (itemId: string, currentReady: boolean) => {
    await supabase
      .from('order_items')
      .update({ is_ready: !currentReady })
      .eq('id', itemId)
    // Tidak perlu update state lokal — listener di kds/page.tsx yang handle
  }

  const handleReady = async () => {
    if (!allReady || loading) return
    if (!confirm(`Tandai ${order.order_number} (Meja ${order.table_number}) SIAP?`)) return
    setLoading(true)
    await onMarkReady(order.id)
    setLoading(false)
  }

  return (
    <div className={cn(
      'flex flex-col rounded-xl border-2 p-5 min-w-[290px] max-w-[330px] shrink-0',
      style.bg, style.border, style.blink && 'animate-pulse'
    )}>

      {/* Header — nomor order, meja, nama pembeli, timer */}
      <div className="flex justify-between mb-3">
        <div>
          <div className="text-4xl font-black">{order.order_number}</div>
          <div className="text-xl font-bold text-gray-300">Meja {order.table_number}</div>
          {/* Nama pembeli — tampilkan kalau ada */}
          {order.customer_name && (
            <div className="text-sm text-gray-400 mt-0.5">👤 {order.customer_name}</div>
          )}
        </div>
        <div className="text-right shrink-0 ml-2">
          <div className={cn('text-2xl font-black', style.text)}>{style.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{formatTime(order.created_at)}</div>
          {/* Badge tipe order — DINE_IN atau TAKEAWAY */}
          <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
            order.order_type === 'TAKEAWAY'
              ? 'bg-blue-900 text-blue-400'
              : 'bg-gray-700 text-gray-400'
          }`}>
            {order.order_type === 'TAKEAWAY' ? '🥡 Bungkus' : '🪑 Di Sini'}
          </div>
        </div>
      </div>

      {/* Progress ceklis — "2/3 selesai" */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">Progress masak</span>
        <span className={`text-xs font-bold ${allReady ? 'text-green-400' : 'text-gray-400'}`}>
          {readyCount}/{items.length}
        </span>
      </div>

      {/* Progress bar visual */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            allReady ? 'bg-green-500' : 'bg-orange-500'
          }`}
          style={{ width: items.length > 0 ? `${(readyCount / items.length) * 100}%` : '0%' }}
        />
      </div>

      <div className="h-px bg-gray-700 mb-4"/>

      {/* Daftar item dengan ceklis per item */}
      <div className="flex-1 space-y-2 mb-5">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => handleToggleItem(item.id, item.is_ready)}
            className={cn(
              'w-full flex gap-3 items-start p-2 rounded-lg text-left transition-all',
              item.is_ready
                ? 'bg-green-950/50 opacity-60'
                : 'bg-gray-800/40 hover:bg-gray-700/40 active:scale-98'
            )}
          >
            {/* Checkbox visual */}
            <div className={cn(
              'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
              item.is_ready
                ? 'bg-green-500 border-green-500'
                : 'border-gray-600'
            )}>
              {item.is_ready && <span className="text-white text-xs font-black">✓</span>}
            </div>

            <div className="flex-1">
              <div className={cn(
                'text-lg font-bold transition-all',
                item.is_ready ? 'line-through text-gray-600' : 'text-white'
              )}>
                {item.quantity}× {item.menu_name}
              </div>
              {/* Catatan item — kalau ada */}
              {item.notes && (
                <div className="text-sm text-yellow-400 italic mt-0.5">⚠️ {item.notes}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Tombol SIAP SAJI — disable kalau belum semua item diceklis */}
      <button
        onClick={handleReady}
        disabled={!allReady || loading}
        className={cn(
          'w-full py-4 rounded-xl text-lg font-black uppercase tracking-wider',
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