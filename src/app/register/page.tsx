'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')   // display name pemilik
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Semua yang daftar lewat halaman ini otomatis jadi OWNER
        data: { role: 'OWNER', display_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Email ini sudah terdaftar. Coba masuk.')
      } else if (error.message.includes('Password should be')) {
        setError('Password minimal 6 karakter.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-white mb-2">Cek Email Kamu</h2>
          <p className="text-gray-400 text-sm mb-2">
            Kami kirim link verifikasi ke{' '}
            <strong className="text-white">{email}</strong>.
          </p>
          <p className="text-gray-500 text-xs mb-6">
            Klik link di email untuk mengaktifkan akun pemilik tokomu.
          </p>
          <Link href="/login" className="text-orange-400 hover:text-orange-300 text-sm font-semibold">
            ← Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">kasir-dapur</h1>
          <p className="text-gray-500 text-sm mt-1">Daftar sebagai Pemilik Toko</p>
        </div>

        <div className="bg-orange-950/40 border border-orange-900/50 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-orange-400 font-semibold">👑 Akun Pemilik</p>
          <p className="text-xs text-gray-500 mt-1">
            Halaman ini khusus untuk pemilik toko. Admin dan pegawai didaftarkan langsung oleh pemilik dari dalam aplikasi.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nama Lengkap</label>
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama pemilik toko"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@toko.com"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 karakter"
              required minLength={6}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800
              disabled:text-gray-600 text-white font-bold py-3 rounded-lg transition-colors text-sm">
            {loading ? 'Mendaftar...' : 'Daftar sebagai Pemilik'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-orange-400 hover:text-orange-300 font-semibold">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}