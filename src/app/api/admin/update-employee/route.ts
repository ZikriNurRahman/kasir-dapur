// src/app/api/admin/update-employee/route.ts
// API untuk edit data pegawai: display_name, username, dan reset password
// Hanya OWNER/ADMIN yang bisa, dan ADMIN tidak bisa edit pegawai yang bukan di cabangnya

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

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    // 1. Auth check
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requesterProfile } = await supabaseUser
      .from('profiles').select('role, branch_id').eq('id', user.id).single()

    if (!requesterProfile || !['OWNER', 'ADMIN'].includes(requesterProfile.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    // 2. Parse body
    const { targetUserId, displayName, username, newPassword } = await request.json()
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId wajib diisi' }, { status: 400 })

    const adminClient = getAdminClient()

    // 3. Validasi: target harus di cabang yang sama (untuk ADMIN)
    if (requesterProfile.role === 'ADMIN') {
      const { data: targetProfile } = await adminClient
        .from('profiles').select('branch_id, role').eq('id', targetUserId).single()

      // Admin tidak bisa edit orang yang berbeda cabang
      if (targetProfile?.branch_id !== requesterProfile.branch_id) {
        return NextResponse.json({ error: 'Tidak bisa edit pegawai cabang lain' }, { status: 403 })
      }
      // Admin tidak bisa edit sesama admin atau owner
      if (targetProfile?.role === 'ADMIN' || targetProfile?.role === 'OWNER') {
        return NextResponse.json({ error: 'Admin tidak bisa edit akun Admin/Owner' }, { status: 403 })
      }
    }

    // 4. Update display_name dan username di profiles
    if (displayName || username) {
      const updateData: Record<string, string> = {}
      if (displayName) updateData.display_name = displayName
      if (username)    updateData.username      = username

      const { error: profileError } = await adminClient
        .from('profiles').update(updateData).eq('id', targetUserId)

      if (profileError) {
        if (profileError.message.includes('unique')) {
          return NextResponse.json({ error: `Username "${username}" sudah dipakai` }, { status: 409 })
        }
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }

      // Sync username ke email internal juga kalau username berubah
      if (username) {
        const newEmail = `${username.toLowerCase().replace(/\s+/g, '-')}@kasirdapur.internal`
        await adminClient.auth.admin.updateUserById(targetUserId, {
          email: newEmail,
          user_metadata: { username },
        })
      }
    }

    // 5. Update password kalau ada
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
      }
      const { error: pwError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      })
      if (pwError) return NextResponse.json({ error: pwError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Data pegawai berhasil diupdate' })

  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}