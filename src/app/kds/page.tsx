// 'use client'
// import { useEffect, useState, useCallback } from 'react'
// import { supabase } from '@/lib/supabase'
// import { OrderCard } from '@/components/kds/OrderCard'
// import type { Order } from '@/types/database'

// export default function KDSPage() {
//   const [orders, setOrders] = useState<Order[]>([])
//   const [connected, setConnected] = useState(false)

//   // Ambil semua order PENDING yang sudah ada saat halaman dibuka
//   const fetchPending = useCallback(async () => {
//     const { data } = await supabase
//       .from('orders')
//       .select('*, order_items(*)')
//       .eq('status', 'PENDING')
//       .order('created_at', { ascending: true }) // FIFO — pertama masuk, pertama keluar
//     if (data) setOrders(data as Order[])
//   }, [])

//   useEffect(() => {
//     fetchPending()

//     // Subscribe ke semua perubahan di tabel orders via WebSocket
//     const channel = supabase
//       .channel('kds-realtime')

//       // Event INSERT — pesanan baru dari kasir
//       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
//         async (payload) => {
//           // Payload INSERT tidak menyertakan order_items, fetch ulang dengan join
//           const { data } = await supabase
//             .from('orders').select('*, order_items(*)')
//             .eq('id', payload.new.id).single()
//           if (data) setOrders(prev => [...prev, data as Order])
//         }
//       )

//       // Event UPDATE — status berubah (misalnya READY atau COMPLETED)
//       .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
//         (payload) => {
//           // Kalau tidak PENDING lagi, hapus dari board
//           if (payload.new.status !== 'PENDING') {
//             setOrders(prev => prev.filter(o => o.id !== payload.new.id))
//           }
//         }
//       )

//       .subscribe(status => setConnected(status === 'SUBSCRIBED'))

//     // Cleanup saat komponen unmount (pindah halaman)
//     return () => { supabase.removeChannel(channel) }
//   }, [fetchPending])

//   // Dipanggil dari OrderCard saat dapur klik "Siap Saji"
//   const handleMarkReady = async (orderId: string) => {
//     await supabase.from('orders').update({ status: 'READY' }).eq('id', orderId)
//     // Tidak perlu update state manual — listener UPDATE di atas yang handle
//   }

//   return (
//     <div className="min-h-screen bg-gray-950 text-white flex flex-col">

//       {/* Header status bar */}
//       <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
//         <h1 className="text-xl font-bold">🍳 DAPUR</h1>
//         <div className="flex items-center gap-4">
//           <span className="text-3xl font-black text-orange-400">{orders.length}</span>
//           <div className="flex items-center gap-2">
//             <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/>
//             <span className="text-xs text-gray-400">{connected ? 'LIVE' : 'Reconnecting...'}</span>
//           </div>
//         </div>
//       </header>

//       <main className="flex-1 p-5 overflow-x-auto">
//         {orders.length === 0 ? (
//           <div className="h-full flex flex-col items-center justify-center text-gray-700">
//             <span className="text-8xl mb-4">✅</span>
//             <p className="text-2xl font-bold">Semua Pesanan Selesai</p>
//           </div>
//         ) : (
//           <div className="flex gap-4 h-full">
//             {orders.map(order => (
//               <OrderCard key={order.id} order={order} onMarkReady={handleMarkReady} />
//             ))}
//           </div>
//         )}
//       </main>
//     </div>
//   )
// }