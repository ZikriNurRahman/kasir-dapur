// src/app/api/admin/create-employee/route.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabaseUser
      .from('profiles').select('role, branch_id').eq('id', user.id).single()

    if (!profile || !['OWNER', 'ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'Hanya OWNER/ADMIN yang bisa buat pegawai' }, { status: 403 })
    }

    const { username, password, displayName, role, branchId } = await request.json()

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: 'username, password, dan displayName wajib diisi' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // ADMIN hanya boleh buat EMPLOYEE
    const requestedRole = role || 'EMPLOYEE'
    if (profile.role === 'ADMIN' && requestedRole !== 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'Admin hanya bisa mendaftarkan pegawai dengan role EMPLOYEE.' },
        { status: 403 }
      )
    }
    if (requestedRole === 'OWNER') {
      return NextResponse.json(
        { error: 'Role OWNER tidak bisa dibuat lewat fitur ini' },
        { status: 403 }
      )
    }

    const targetBranchId = branchId || profile.branch_id
    if (!targetBranchId) {
      return NextResponse.json({ error: 'Branch ID tidak ditemukan' }, { status: 400 })
    }

    // Ambil slug cabang untuk format email
    const adminClient = getAdminClient()
    const { data: branch } = await adminClient
      .from('branches').select('code').eq('id', targetBranchId).single()

    if (!branch) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    // Format email: username.slug@kasir.app
    const cleanUsername = username.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const branchCodeLower = branch.code.toLowerCase()
    const internalEmail = `${cleanUsername}.${branchCodeLower}@kasir.app`

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email:         internalEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, username: cleanUsername },
    })

    if (createError) {
      if (createError.message.includes('already')) {
        return NextResponse.json(
          { error: `Username "${username}" sudah dipakai di cabang ini` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    await adminClient.from('profiles').update({
      role:         requestedRole,
      display_name: displayName,
      branch_id:    targetBranchId,
      username: cleanUsername,
    }).eq('id', newUser.user.id)

    return NextResponse.json({
      success: true,
      message: `Pegawai "${displayName}" berhasil dibuat`,
      userId:  newUser.user.id,
      // Informasi untuk ditampilkan ke admin
      loginInfo: {
        username: cleanUsername,
        branchCode: branch.code,
        email: internalEmail,
      },
    })

  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}