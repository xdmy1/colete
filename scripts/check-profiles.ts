import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://twbixwibvgxriffpfelt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function check() {
  // Check auth users
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  console.log('=== AUTH USERS ===')
  authUsers?.users.forEach(u => console.log(`  ${u.id} — ${u.email}`))

  // Check profiles
  const { data: profiles, error } = await supabase.from('profiles').select('*')
  console.log('\n=== PROFILES TABLE ===')
  if (error) console.log('  ERROR:', error.message)
  else if (!profiles?.length) console.log('  GOOL — nu sunt profile!')
  else profiles.forEach(p => console.log(`  ${p.username} (${p.role}) — PIN: ${p.pin_code} — Range: ${p.range_start}-${p.range_end}`))
}

check()
