import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Lipsesc variabilele VITE_SUPABASE_URL sau VITE_SUPABASE_ANON_KEY. Verifică fișierul .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
