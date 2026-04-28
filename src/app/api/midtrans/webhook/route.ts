// src/app/api/midtrans/webhook/route.ts
// Webhook dari Midtrans — dipanggil saat status pembayaran berubah
//
// Setup di Midtrans Dashboard:
// Settings → Configuration → Payment Notification URL:
// https://nama-toko.vercel.app/api/midtrans/webhook
//
// Untuk testing lokal: gunakan ngrok atau Midtrans Simulator

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// Gunakan service role key untuk webhook — agar bisa update tanpa RLS block
// NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role — jangan di-expose ke client!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verifikasi signature Midtrans
    // Format: sha512(order_id + status_code + gross_amount + server_key)
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const signatureKey = body.order_id + body.status_code + body.gross_amount + serverKey
    const expectedSig  = createHash('sha512').update(signatureKey).digest('hex')

    if (body.signature_key !== expectedSig) {
      console.error('Invalid Midtrans signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { order_id, transaction_status, fraud_status } = body

    // Tentukan apakah pembayaran berhasil
    // - transaction_status: 'settlement' atau 'capture' = berhasil
    // - fraud_status: 'accept' = tidak ada fraud (hanya ada di kartu kredit)
    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept')

    const isFailed =
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'

    const supabase = getAdminSupabase()

    if (isSuccess) {
      // Pembayaran berhasil → update order dari PENDING_PAYMENT ke PENDING
      // KDS akan menerima order ini via Realtime
      const { error } = await supabase
        .from('orders')
        .update({ status: 'PENDING' })
        .eq('order_number', order_id)          // order_id Midtrans = order_number kita
        .eq('status', ['PENDING_PAYMENT', 'CANCELLED'])       // safety check

      if (error) console.error('Supabase update error:', error)
      else console.log(`Order ${order_id} berhasil dibayar → PENDING`)

    } else if (isFailed) {
      // Pembayaran gagal/dibatalkan → update ke CANCELLED
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('order_number', order_id)
        .eq('status', 'PENDING_PAYMENT')

      if (error) console.error('Supabase update error:', error)
      else console.log(`Order ${order_id} dibatalkan`)
    }

    // Midtrans mengharapkan HTTP 200 sebagai tanda webhook diterima
    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}