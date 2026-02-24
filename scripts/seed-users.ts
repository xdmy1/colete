// Rulează: npx tsx scripts/seed-users.ts
// Creează useri de test în Supabase Auth + profiles

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://twbixwibvgxriffpfelt.supabase.co'
// Ai nevoie de SERVICE_ROLE key (nu anon!) pentru a crea useri
// Gaseste-l in Supabase Dashboard → Settings → API → service_role
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk'

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Setează SUPABASE_SERVICE_ROLE_KEY!')
  console.error('   Găsește-l în: Supabase Dashboard → Settings → API → service_role (secret)')
  console.error('')
  console.error('   Rulează așa:')
  console.error('   SUPABASE_SERVICE_ROLE_KEY="eyJ..." npx tsx scripts/seed-users.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Userii de creat ──
const USERS = [
  {
    username: 'admin',
    pin: '0000',
    role: 'admin',
    range_start: 0,
    range_end: 1000,  // adminul vede tot
  },
  {
    username: 'ion_centru',
    pin: '1234',
    role: 'driver',
    range_start: 0,
    range_end: 100,
  },
  {
    username: 'vasile_nord',
    pin: '5678',
    role: 'driver',
    range_start: 100,
    range_end: 200,
  },
  {
    username: 'mihai_sud',
    pin: '9012',
    role: 'driver',
    range_start: 200,
    range_end: 300,
  },
]

async function seed() {
  console.log('🌱 Seed: creare useri...\n')

  for (const user of USERS) {
    const email = `${user.username}@colete.local`

    // 1. Creează user în Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: user.pin,
      email_confirm: true, // confirmă automat, fără email
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`⏭️  ${user.username} — deja există, skip`)
        continue
      }
      console.error(`❌ ${user.username}: ${authError.message}`)
      continue
    }

    const userId = authData.user.id

    // 2. Creează profil în tabela profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: user.username,
        pin_code: user.pin,
        role: user.role,
        range_start: user.range_start,
        range_end: user.range_end,
      })

    if (profileError) {
      console.error(`❌ ${user.username} profil: ${profileError.message}`)
      continue
    }

    console.log(`✅ ${user.username} (${user.role}) — PIN: ${user.pin} — Range: ${user.range_start}-${user.range_end}`)
  }

  console.log('\n🎉 Gata! Userii:')
  console.log('   admin      → PIN: 0000')
  console.log('   ion_centru → PIN: 1234  (range 0-100)')
  console.log('   vasile_nord→ PIN: 5678  (range 100-200)')
  console.log('   mihai_sud  → PIN: 9012  (range 200-300)')
}

seed()
