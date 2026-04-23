// src/app/api/admin/create-employee/route.ts
// API endpoint untuk admin mendaftarkan pegawai
// Hanya bisa dipanggil oleh OWNER/ADMIN (dicek dari session)
// Pegawai dibuat dengan email format: username@branch.kasirdapur.internal
// (email tidak real, hanya untuk keperluan Supabase Auth)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Admin client dengan service role — bisa buat user baru
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // JANGAN expose ke client!
  )
}

export async function POST(request: NextRequest) {
  try {
    // 1. Cek apakah requester adalah OWNER/ADMIN
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek role di profiles
    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['OWNER', 'ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'Hanya OWNER/ADMIN yang bisa buat pegawai' }, { status: 403 })
    }

    // 2. Parse request body
    const { username, password, displayName, role, branchId } = await request.json()

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'username, password, dan displayName wajib diisi' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // 3. Generate email internal (bukan email real)
    // Format: username@kasirdapur.internal
    const internalEmail = `${username.toLowerCase().replace(/\s+/g, '-')}@kasirdapur.internal`

    // 4. Buat user di Supabase Auth via Admin API
    const adminClient = getAdminClient()

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email:          internalEmail,
      password:       password,
      email_confirm:  true, // langsung verify, tidak perlu email verifikasi
      user_metadata:  { display_name: displayName, username },
    })

    if (createError) {
      // Kalau email sudah dipakai (username duplikat)
      if (createError.message.includes('already')) {
        return NextResponse.json({ error: `Username "${username}" sudah dipakai` }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // 5. Update profiles tabel (dibuat otomatis via trigger Supabase)
    const targetBranchId = branchId || profile.branch_id

    await adminClient
      .from('profiles')
      .update({
        role:         role || 'EMPLOYEE',
        display_name: displayName,
        branch_id:    targetBranchId,
        username:     username,
      })
      .eq('id', newUser.user.id)

    return NextResponse.json({
      success: true,
      message: `Pegawai "${displayName}" berhasil dibuat`,
      userId:  newUser.user.id,
    })

  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}