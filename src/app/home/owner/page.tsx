'use client'
// src/app/home/owner/page.tsx
// CHANGED: Tambah section "Daftar Owner" — info siapa saja yang punya role OWNER

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Branch, Profile } from '@/types/database'

export default function OwnerPage() {
  const router = useRouter()
  const [userId,   setUserId]   = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading,  setLoading]  = useState(true)

  const [showForm,   setShowForm]   = useState(false)
  const [branchForm, setBranchForm] = useState({ name: '', address: '', slug: '', code: '' })
  const [saving,     setSaving]     = useState(false)

  const [branchAdmins, setBranchAdmins] = useState<Record<string, Profile[]>>({})

  // CHANGED: State untuk daftar semua owner
  const [owners, setOwners] = useState<Profile[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
    }
    init()
  }, [])

  const fetchBranches = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase.from('branches').select('*')
      .eq('owner_id', userId).eq('is_active', true).order('created_at')
    if (data) setBranches(data as Branch[])
    setLoading(false)
  }, [userId])

  const fetchAdminsForBranches = useCallback(async (branchList: Branch[]) => {
    if (branchList.length === 0) return
    const ids = branchList.map(b => b.id)
    const { data } = await supabase.from('profiles').select('*')
      .in('branch_id', ids).eq('role', 'ADMIN')
    if (data) {
      const map: Record<string, Profile[]> = {}
      data.forEach((p: Profile) => {
        if (!p.branch_id) return
        if (!map[p.branch_id]) map[p.branch_id] = []
        map[p.branch_id].push(p)
      })
      setBranchAdmins(map)
    }
  }, [])

  // CHANGED: Fetch semua profile yang punya role OWNER
  const fetchOwners = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'OWNER')
    if (data) setOwners(data as Profile[])
  }, [])

  useEffect(() => { fetchBranches(); fetchOwners() }, [fetchBranches, fetchOwners])
  useEffect(() => { if (branches.length > 0) fetchAdminsForBranches(branches) }, [branches, fetchAdminsForBranches])

  const handleCreateBranch = async () => {
    if (!branchForm.name || !branchForm.slug || !branchForm.code) {
      toast.error('Nama, kode (3 huruf), dan slug wajib diisi'); return
    }
    const cleanCode = branchForm.code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()
    if (cleanCode.length !== 3) {
      toast.error('Kode cabang harus tepat 3 huruf/angka'); return
    }
    setSaving(true)
    try {
      const slug = branchForm.slug.toLowerCase().replace(/\s+/g, '-')
      const { data, error } = await supabase.from('branches').insert({
        owner_id: userId,
        name: branchForm.name,
        address: branchForm.address,
        slug,
      code: cleanCode,   // ← simpan kode
    }).select().single()

    if (error) throw new Error(error.message)

    await supabase.from('store_settings').insert({
      branch_id: data.id,
      store_name: branchForm.name,
      store_address: branchForm.address,
      footer_text: 'Terima kasih, sampai jumpa lagi! 🍽️',
    })

      toast.success(`Cabang "${branchForm.name}" (${cleanCode}) berhasil dibuat!`)
      setBranchForm({ name: '', address: '', slug: '', code: '' })
      setShowForm(false)
      fetchBranches()
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat cabang')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBranch = async (b: Branch) => {
    if (!confirm(`Nonaktifkan cabang "${b.name}"? Data tidak akan dihapus.`)) return
    await supabase.from('branches').update({ is_active: false }).eq('id', b.id)
    toast.success('Cabang dinonaktifkan')
    fetchBranches()
  }

  const handleMasukCabang = (branchId: string) => {
    router.push(`/home/admin?branch=${branchId}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">🏪 Kelola Cabang</h1>
          <p className="text-xs text-gray-500 mt-0.5">Klik cabang untuk masuk ke panel admin cabang tersebut</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors">
          + Cabang Baru
        </button>
      </div>

      {/* CHANGED: Banner daftar owner — info siapa saja yang punya role OWNER */}
      {owners.length > 0 && (
        <div className="bg-gray-900 border border-purple-900/50 rounded-xl p-4 mb-6">
          <p className="text-xs font-bold text-purple-400 mb-3">👑 Pemilik Akun (OWNER)</p>
          <div className="flex flex-wrap gap-2">
            {owners.map(o => (
              <div key={o.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                  ${o.id === userId
                    ? 'bg-purple-900/60 border border-purple-700 text-purple-300'
                    : 'bg-gray-800 text-gray-400'}`}>
                <span className="font-bold">{o.display_name || o.username || 'Tanpa Nama'}</span>
                {o.username && <span className="text-gray-600 font-mono">@{o.username}</span>}
                {o.id === userId && <span className="text-purple-500">(Kamu)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form cabang baru */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold mb-4">Buat Cabang Baru</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nama Cabang *</label>
              <input value={branchForm.name}
                onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="Cabang Utama"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Kode Cabang * <span className="text-gray-600">(3 huruf, contoh: PDG)</span>
              </label>
              <input
                value={branchForm.code}
                onChange={e => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase().slice(0, 3) })}
                placeholder="PDG"
                maxLength={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
      font-mono tracking-widest focus:outline-none focus:border-orange-500"/>
              <p className="text-xs text-gray-600 mt-1">
                Dipakai untuk kode invoice (misal PDG-0K3H2X1) dan login pegawai
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slug (ID unik) *</label>
              <input value={branchForm.slug}
                onChange={e => setBranchForm({ ...branchForm, slug: e.target.value })}
                placeholder="cabang-utama"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
              <p className="text-xs text-gray-600 mt-1">Huruf kecil, gunakan tanda hubung</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Alamat</label>
              <input value={branchForm.address}
                onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                placeholder="Jl. Contoh No. 1, Padang"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"/>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-700 rounded-lg text-sm">Batal</button>
            <button onClick={handleCreateBranch} disabled={saving}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 rounded-lg text-sm font-bold">
              {saving ? 'Menyimpan...' : 'Buat Cabang'}
            </button>
          </div>
        </div>
      )}

      {/* Daftar cabang */}
      {loading ? (
        <div className="text-center text-gray-600 py-12">Memuat cabang...</div>
      ) : branches.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <div className="text-5xl mb-4">🏪</div>
          <p className="font-bold text-white mb-2">Belum ada cabang</p>
          <p className="text-sm">Buat cabang pertama untuk mulai menggunakan kasir-dapur</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map(branch => {
            const admins = branchAdmins[branch.id] ?? []
            return (
              <div key={branch.id}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{branch.name}</h3>
                    {branch.address && (
                      <p className="text-xs text-gray-500 mt-0.5">{branch.address}</p>
                    )}
                    <p className="text-xs text-gray-700 mt-0.5 font-mono">/{branch.slug}</p>
                    <p className="text-xs font-mono font-bold text-orange-900 mt-0.5">
                      Kode: {branch.code}
                    </p>,
                  </div>
                  <button onClick={() => handleDeleteBranch(branch)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
                    Nonaktifkan
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Admin bertugas:</p>
                  {admins.length === 0 ? (
                    <p className="text-xs text-yellow-600 italic">Belum ada admin — tambahkan dari panel admin cabang ini</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {admins.map(a => (
                        <span key={a.id}
                          className="px-2 py-0.5 bg-purple-950 text-purple-400 rounded-full text-xs font-medium">
                          🛡️ {a.display_name || a.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={() => handleMasukCabang(branch.id)}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors text-white">
                  Kelola Cabang →
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}