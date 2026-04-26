'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type LoginMode = 'owner' | 'staff'

export default function LoginPage() {
  const router = useRouter()

  const [mode,        setMode]        = useState<LoginMode>('owner')
  const [email,       setEmail]       = useState('')        // mode owner
  const [username,    setUsername]    = useState('')        // mode staff
  const [branchCode,  setBranchCode]  = useState('')        // mode staff
  const [password,    setPassword]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    let loginEmail: string

    if (mode === 'owner') {
      loginEmail = email.trim()
    } else {
      // Format: username.kodecabang@kasir.app
      const uname = username.trim().toLowerCase().replace(/\s+/g, '')
      const bcode = branchCode.trim().toLowerCase().replace(/\s+/g, '')
      loginEmail = `${uname}.${bcode}@kasir.app`
    }

    const { error } = await supabase.auth.signInWithPassword({
      email:    loginEmail,
      password,
    })

    if (error) {
      setError(
        error.message.includes('Invalid login credentials')
          ? mode === 'owner'
            ? 'Email atau password salah.'
            : 'Username, kode cabang, atau password salah.'
          : error.message
      )
      setLoading(false)
      return
    }

    await supabase.auth.refreshSession()
    router.push('/home')
    router.refresh()
  }

  const inputClass = `w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
    text-sm text-white placeholder-gray-600
    focus:outline-none focus:border-orange-500 transition-colors`

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">kasir-dapur</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk ke akunmu</p>
        </div>

        {/* Toggle mode */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 gap-1">
          <button
            type="button"
            onClick={() => { setMode('owner'); setError('') }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'owner'
                ? 'bg-orange-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}>
            👑 Masuk sebagai Pemilik
          </button>
          <button
            type="button"
            onClick={() => { setMode('staff'); setError('') }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'staff'
                ? 'bg-orange-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}>
            👤 Admin / Pegawai
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">

          {mode === 'owner' ? (
            /* ── Mode Pemilik ── */
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@toko.com"
                required autoComplete="email"
                className={inputClass}/>
            </div>
          ) : (
            /* ── Mode Admin / Pegawai ── */
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Username</label>
                <input
                  type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="contoh: budi"
                  required autoComplete="username"
                  className={inputClass}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Kode Cabang
                </label>
                <input
                  type="text" value={branchCode}
                  onChange={e => setBranchCode(e.target.value)}
                  placeholder="contoh: pdg"
                  required
                  className={inputClass}/>
                <p className="text-xs text-gray-600 mt-1">
                  Kode cabang diberikan oleh pemilik atau admin toko
                </p>
              </div>
            </>
          )}

          {/* Password — sama untuk keduanya */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className={inputClass}/>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800
              disabled:text-gray-600 text-white font-bold py-3 rounded-lg transition-colors text-sm">
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        {mode === 'owner' && (
          <p className="text-center text-sm text-gray-600 mt-6">
            Belum punya toko?{' '}
            <Link href="/register" className="text-orange-400 hover:text-orange-300 font-semibold">
              Daftar di sini
            </Link>
          </p>
        )}

      </div>
    </div>
  )
}