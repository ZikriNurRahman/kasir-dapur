'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    // Kalau ada @, anggap email. Kalau tidak, konversi ke format internal
    const email = identifier.includes('@')
      ? identifier
      : `${identifier.toLowerCase().replace(/\s+/g, '-')}@kasirdapur.internal`

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message.includes('Invalid login credentials')
        ? 'Username/email atau password salah.'
        : error.message)
      setLoading(false)
      return
    }

    await supabase.auth.refreshSession()
    router.push('/home')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">kasir-dapur</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk ke akunmu</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Username atau Email
            </label>
            <input type="text" value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="username atau email@toko.com"
              required autoComplete="username"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Password</label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
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
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Pemilik toko baru?{' '}
          <Link href="/register" className="text-orange-400 hover:text-orange-300 font-semibold">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  )
}