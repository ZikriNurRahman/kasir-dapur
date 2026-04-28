import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { orderId, grossAmount, dbOrderId, items } = await request.json()

    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      return NextResponse.json(
        { error: 'MIDTRANS_SERVER_KEY belum di-set di environment variables' },
        { status: 500 }
      )
    }

    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const baseUrl      = isProduction
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com'

    const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64')

    // Snap API — sama seperti Safiya Veil
    const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method:  'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: Math.round(grossAmount),
        },
        // Batasi hanya QRIS — sesuai payment method yang aktif
        enabled_payments: ['other_qris'],
        custom_field1: dbOrderId,
      }),
    })

    const data = await response.json()
    console.log('[Midtrans Snap] Response:', JSON.stringify(data, null, 2))

    if (!response.ok || data.error_messages?.length > 0) {
      return NextResponse.json(
        { error: data.error_messages?.[0] ?? `Snap error (${response.status})` },
        { status: 400 }
      )
    }

    // Snap response: { token, redirect_url }
    return NextResponse.json({
      snapToken: data.token,
      snapUrl: data.redirect_url,
      orderId,
    })

  } catch (error) {
    console.error('[Midtrans Snap] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}