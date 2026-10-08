import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { pinToPassword } from '../lib/pin'
import type { Profile } from '../lib/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(data as Profile | null)
    setLoading(false)
  }

  async function loginWithPin(pin: string): Promise<{ error: string | null }> {
    // Look up the profile by PIN
    const { data: profileData, error: lookupError } = await supabase
      .from('profiles')
      .select('*')
      .eq('pin_code', pin)
      .single()

    if (lookupError || !profileData) {
      return { error: 'Cod PIN invalid' }
    }

    // Sign in using the username as email (convention: username@colete.local).
    // Parola e derivata din PIN (vezi src/lib/pin.ts). Conturile vechi, setate
    // manual in SQL cu crypt(pin), au parola = PIN-ul brut — incercam si asa.
    const email = `${profileData.username}@colete.local`
    for (const password of [pinToPassword(pin), pin]) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (!signInError) return { error: null }
    }

    return { error: 'Autentificare eșuată. Verifică codul PIN.' }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return { user, profile, loading, loginWithPin, logout }
}
