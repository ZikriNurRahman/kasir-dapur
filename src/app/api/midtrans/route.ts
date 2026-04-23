// src/app/api/midtrans/route.ts
// API route untuk generate QRIS Midtrans
//
// Kenapa server-side?
// MIDTRANS_SERVER_KEY tidak boleh expose ke browser.
// Server-side route ini yang call Midtrans API dengan server key.
//
// Midtrans Core API QRIS:
// Sandbox URL: https://api.sandbox.midtrans.com/v2/charge
// Production:  https://api.midtrans.com/v2/charge
//
// Env yang dibutuhkan di .env.local:
// MIDTRANS_SERVER_KEY=Mid-server-xxxxx
// MIDTRANS_IS_PRODUCTION=false

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { orderId, grossAmount, dbOrderId } = await request.json()

    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      return NextResponse.json(
        { error: 'MIDTRANS_SERVER_KEY belum di-set di environment variables' },
        { status: 500 }
      )
    }

    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const baseUrl      = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    // Encode server key ke base64 untuk header Authorization
    // Format: "Basic " + base64(serverKey + ":")
    const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64')

    // Buat charge QRIS ke Midtrans Core API
    const response = await fetch(`${baseUrl}/v2/charge`, {
      method:  'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: {
          order_id:     orderId,     // nomor order dari kasir-dapur
          gross_amount: grossAmount, // total dalam Rupiah (integer)
        },
        // Tambahan metadata — opsional tapi berguna untuk rekonsiliasi
        custom_field1: dbOrderId,   // id order di database kita
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Midtrans error:', data)
      return NextResponse.json(
        { error: data.status_message ?? 'Midtrans error' },
        { status: 400 }
      )
    }

    // Midtrans response untuk QRIS:
    // data.qr_string — string yang dipakai untuk generate QR code
    // data.transaction_id — ID transaksi Midtrans
    // data.transaction_status — harusnya "pending"

    return NextResponse.json({
      qrString:      data.qr_string,
      transactionId: data.transaction_id,
      orderId:       orderId,
    })

  } catch (error) {
    console.error('Midtrans API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}