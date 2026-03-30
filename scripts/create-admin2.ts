// Rulează: npx tsx scripts/create-admin2.ts
// Creează userul admin2 cu PIN 1999 și acces la tot în afară de Anglia (UK)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://twbixwibvgxriffpfelt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const USERNAME = 'admin2'
const PIN = '1999'

async function createAdmin2() {
  const email = `${USERNAME}@colete.local`

  // Sterge userul vechi dacă există
  const { data: existing } = await supabase.auth.admin.listUsers()
  const old = existing?.users.find(u => u.email === email)
  if (old) {
    await supabase.auth.admin.deleteUser(old.id)
    console.log(`🗑️  Sters user vechi: ${email}`)
  }

  // Creează userul în Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: PIN,
    email_confirm: true,
  })

  if (authError) {
    console.error('❌ Eroare la creare user auth:', authError.message)
    process.exit(1)
  }

  const userId = authData.user.id

  // Inserează profilul cu excluded_destinations = ['UK']
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: USERNAME,
      pin_code: PIN,
      role: 'admin',
      excluded_destinations: ['UK'],
    })

  if (profileError) {
    console.error('❌ Eroare la creare profil:', profileError.message)
    process.exit(1)
  }

  console.log(`✅ admin2 creat cu succes!`)
  console.log(`   Username: ${USERNAME}`)
  console.log(`   PIN: ${PIN}`)
  console.log(`   Rol: admin (fără Anglia)`)
}

createAdmin2()
