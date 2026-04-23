'use client'
// src/hooks/useCurrentUser.ts
// Hook reusable untuk dapat info user yang sedang login
// Dipakai di CartPanel (served_by), HomeLayout (role check), dll

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface CurrentUser {
  id:          string
  email:       string
  profile:     Profile | null
  loading:     boolean
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    id: '', email: '', profile: null, loading: true
  })

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUser({ id: '', email: '', profile: null, loading: false })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      setUser({
        id:      authUser.id,
        email:   authUser.email ?? '',
        profile: profile as Profile | null,
        loading: false,
      })
    }

    fetchUser()

    // Subscribe perubahan auth (logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser()
    })

    return () => subscription.unsubscribe()
  }, [])

  return user
}