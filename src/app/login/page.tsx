'use client'
// src/app/login/page.tsx
// UPDATE: halaman baru — form login dengan email + password
//
// Pakai supabase.auth.signInWithPassword() dari client browser
// Setelah berhasil, router.push('/home') untuk redirect

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Terjemahkan pesan error Supabase ke bahasa Indonesia
      if (error.message.includes('Invalid login credentials')) {
        setError('Email atau password salah.')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Email belum diverifikasi. Cek inbox kamu.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    await supabase.auth.refreshSession()

    // Login berhasil → ke homepage
    router.push('/home')
    router.refresh() // Refresh agar middleware dapat sesi terbaru
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / judul */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">kasir-dapur</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk ke akun tokomu</p>
        </div>

        {/* Form login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@toko.com"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Tampilkan error kalau ada */}
          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800
              disabled:text-gray-600 text-white font-bold py-3 rounded-lg
              transition-colors text-sm"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        {/* Link ke register */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Belum punya akun?{' '}
          <Link href="/register" className="text-orange-400 hover:text-orange-300 font-semibold">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  )
}