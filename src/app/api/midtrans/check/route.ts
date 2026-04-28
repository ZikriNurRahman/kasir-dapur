// Cek status transaksi Midtrans secara manual
// GET /api/midtrans/check?orderId=STR-XXXXXXX
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const serverKey = process.env.MIDTRANS_SERVER_KEY!
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const baseUrl = isProduction
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'

  // Hit Midtrans API untuk cek status
  const res = await fetch(`${baseUrl}/v2/${orderId}/status`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(serverKey + ':').toString('base64'),
    },
  })

  const data = await res.json()
  const { transaction_status, fraud_status } = data

  const isSuccess =
    transaction_status === 'settlement' ||
    (transaction_status === 'capture' && fraud_status === 'accept')

  // Kalau memang sudah dibayar, update DB sekalian
  if (isSuccess) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await supabase
      .from('orders')
      .update({ status: 'PENDING' })
      .eq('order_number', orderId)
      .in('status', ['PENDING_PAYMENT', 'CANCELLED'])
  }

  return NextResponse.json({
    transaction_status,
    fraud_status,
    isSuccess,
  })
}