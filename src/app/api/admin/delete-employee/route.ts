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

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requesterProfile } = await supabaseUser
      .from('profiles').select('role, branch_id').eq('id', user.id).single()

    if (!requesterProfile || !['OWNER', 'ADMIN'].includes(requesterProfile.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { targetUserId } = await request.json()
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId wajib diisi' }, { status: 400 })

    const adminClient = getAdminClient()

    // Cek target
    const { data: targetProfile } = await adminClient
      .from('profiles').select('role, branch_id').eq('id', targetUserId).single()

    // Tidak bisa hapus diri sendiri
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
    }
    // Tidak bisa hapus OWNER
    if (targetProfile?.role === 'OWNER') {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun Owner' }, { status: 403 })
    }
    // ADMIN hanya bisa hapus di cabang sendiri, dan tidak bisa hapus sesama ADMIN
    if (requesterProfile.role === 'ADMIN') {
      if (targetProfile?.branch_id !== requesterProfile.branch_id) {
        return NextResponse.json({ error: 'Tidak bisa hapus pegawai cabang lain' }, { status: 403 })
      }
      if (targetProfile?.role === 'ADMIN') {
        return NextResponse.json({ error: 'Admin tidak bisa hapus sesama Admin' }, { status: 403 })
      }
    }

    // Hapus dari auth.users (otomatis hapus profiles juga karena FK cascade)
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true, message: 'Pegawai berhasil dihapus' })

  } catch (err) {
    console.error('Delete employee error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}