'use client'
// src/app/home/kds/page.tsx
// V3 UPDATE:
// - FIX: WebSocket tidak connect tanpa refresh → tambah reconnect logic
// - FIX: order_items sekarang masuk supabase_realtime publication (via migration)
// - NEW: bunyi notifikasi saat pesanan baru masuk (Web Audio API)
// - NEW: tampilkan served_by_name di OrderCard

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { OrderCard } from '@/components/kds/OrderCard'
import type { Order } from '@/types/database'

export default function KDSPage() {
  const [orders,    setOrders]    = useState<Order[]>([])
  const [connected, setConnected] = useState(false)

  // AudioContext disimpan di ref — bisa dipakai berkali-kali tanpa re-create
  const audioCtxRef = useRef<AudioContext | null>(null)
  // Ref untuk channel — dipakai di cleanup
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Init AudioContext saat pertama kali user interaksi dengan halaman
  // Browser tidak boleh create AudioContext sebelum ada user gesture
  useEffect(() => {
    const init = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
    }
    document.addEventListener('click',      init, { once: true })
    document.addEventListener('touchstart', init, { once: true })
    return () => {
      document.removeEventListener('click',      init)
      document.removeEventListener('touchstart', init)
    }
  }, [])

  // Bunyi dua nada naik — khas notifikasi dapur
  const playNewOrderSound = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return

    const playBeep = (startTime: number, frequency: number, duration = 0.25) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.4, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    // Dua beep: 660Hz → 880Hz
    playBeep(ctx.currentTime,        660)
    playBeep(ctx.currentTime + 0.25, 880)
  }, [])

  const fetchPending = useCallback(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles').select('branch_id').eq('id', user.id).single()

  let query = supabase.from('orders').select('*, order_items(*)')
    .eq('status', 'PENDING').order('created_at', { ascending: true })

  if (profile?.branch_id) query = query.eq('branch_id', profile.branch_id)

  const { data } = await query
  if (data) setOrders(data as Order[])
}, [])
  const setupChannel = useCallback(() => {
    // Hapus channel lama kalau ada
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('kds-realtime-v3')  // nama unik agar tidak bentrok dengan channel lama

      // INSERT order baru dari kasir
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          // Hanya tampilkan order yang PENDING (bukan PENDING_PAYMENT)
          if (payload.new.status !== 'PENDING') return

          // Fetch dengan join order_items
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setOrders(prev => [...prev, data as Order])
            playNewOrderSound() // 🔔 bunyi!
          }
        }
      )

      // UPDATE order — kalau status berubah dari PENDING_PAYMENT ke PENDING (setelah QRIS bayar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.new.status === 'PENDING' && payload.old.status === 'PENDING_PAYMENT') {
            // Order baru masuk setelah pembayaran QRIS berhasil
            const { data } = await supabase
              .from('orders')
              .select('*, order_items(*)')
              .eq('id', payload.new.id)
              .single()
            if (data) {
              setOrders(prev => [...prev, data as Order])
              playNewOrderSound()
            }
          } else if (payload.new.status !== 'PENDING') {
            // Order selesai/dibatalkan → hapus dari board
            setOrders(prev => prev.filter(o => o.id !== payload.new.id))
          }
        }
      )

      // UPDATE order_items — ceklis per item dari OrderCard
      // Ini hanya berfungsi setelah menjalankan migration-v3.sql
      // (menambahkan order_items ke supabase_realtime publication)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' },
        (payload) => {
          setOrders(prev => prev.map(order => ({
            ...order,
            order_items: order.order_items?.map(item =>
              item.id === payload.new.id
                ? { ...item, is_ready: payload.new.is_ready }
                : item
            ),
          })))
        }
      )

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false)
          // Coba reconnect setelah 3 detik
          setTimeout(() => setupChannel(), 3_000)
        } else if (status === 'CLOSED') {
          setConnected(false)
        }
      })

    channelRef.current = channel
  }, [playNewOrderSound])

  useEffect(() => {
    fetchPending()
    setupChannel()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [fetchPending, setupChannel])

  const handleMarkReady = async (orderId: string) => {
    // Trigger di DB akan otomatis kurangi stok (lihat migration-v3.sql)
    await supabase.from('orders').update({ status: 'READY' }).eq('id', orderId)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <h1 className="text-lg md:text-xl font-bold">🍳 DAPUR</h1>
        <div className="flex items-center gap-3">
          <span className="text-2xl md:text-3xl font-black text-orange-400">
            {orders.length}
          </span>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}/>
            <span className="text-xs text-gray-400 hidden sm:block">
              {connected ? 'LIVE' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Area pesanan — horizontal scroll di desktop, vertical di mobile */}
      <main className="flex-1 p-3 md:p-5 overflow-x-auto overflow-y-auto">
        {orders.length === 0 ? (
          <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-gray-700">
            <span className="text-6xl md:text-8xl mb-4">✅</span>
            <p className="text-xl md:text-2xl font-bold">Semua Pesanan Selesai</p>
          </div>
        ) : (
          // flex-wrap: di layar kecil card bisa wrap ke bawah
          <div className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onMarkReady={handleMarkReady}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}