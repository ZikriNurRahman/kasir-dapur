'use client'
// src/app/register/page.tsx
// UPDATE: halaman baru — form registrasi akun baru
//
// Alur:
// 1. User isi email + password + pilih role (OWNER atau EMPLOYEE)
// 2. Supabase kirim email verifikasi
// 3. User klik link di email → callback route → masuk ke /home
//
// Kenapa ada pilihan role di sini?
// - Toko pertama kali setup: pemilik daftar sebagai OWNER
// - Pemilik bisa kasih tahu pegawai untuk daftar sebagai EMPLOYEE
// - Di produksi nanti bisa diubah: hanya OWNER yang bisa invite pegawai

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

export default function RegisterPage() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [role,      setRole]      = useState<UserRole>('EMPLOYEE')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false) // tampilkan pesan "cek email"

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Kirim role ke metadata — trigger handle_new_user() di DB akan baca ini
        // dan set role yang benar di tabel profiles
        data: { role },
        // URL yang akan dituju setelah klik link verifikasi di email
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

    // Registrasi berhasil → tampilkan instruksi verifikasi
    setSuccess(true)
    setLoading(false)
  }

  // Tampilan setelah register berhasil
  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-white mb-2">Cek Email Kamu</h2>
          <p className="text-gray-400 text-sm mb-6">
            Kami kirim link verifikasi ke <strong className="text-white">{email}</strong>.
            Klik linknya untuk mengaktifkan akun.
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

        {/* Logo / judul */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">kasir-dapur</h1>
          <p className="text-gray-500 text-sm mt-1">Buat akun baru</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
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
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 karakter"
              required
              minLength={6}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Pilih role — pemilik atau pegawai */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['OWNER',    '👑', 'Pemilik Toko', 'Akses penuh + admin'],
                ['EMPLOYEE', '👤', 'Pegawai',      'Kasir & KDS saja'],
              ] as const).map(([val, ico, label, desc]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRole(val)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    role === val
                      ? 'bg-orange-950 border-orange-600'
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-lg mb-0.5">{ico}</div>
                  <div className="text-xs font-bold text-white">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>

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
            {loading ? 'Mendaftar...' : 'Daftar'}
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