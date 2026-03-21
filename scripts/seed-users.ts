// Rulează: npx tsx scripts/seed-users.ts
// Sterge userii vechi și creează useri noi în Supabase Auth + profiles + driver_route_ranges

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://twbixwibvgxriffpfelt.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Destinatii outbound (MD → oriunde)
const MD_OUT = ['UK', 'BE', 'NL', 'DE'] as const

// Fiecare user: profil + rutele cu range-ul aferent
const USERS: {
  username: string
  pin: string
  role: 'admin' | 'driver'
  routes: { origin: string; destination: string; range_start: number; range_end: number }[]
}[] = [
  {
    username: 'admin',
    pin: '0000',
    role: 'admin',
    routes: [], // adminul nu are range-uri, vede tot
  },
  // ── Din Moldova (outbound) ──
  {
    username: 'depozit',
    pin: '6006',
    role: 'driver',
    routes: MD_OUT.map(dest => ({ origin: 'MD', destination: dest, range_start: 600, range_end: 699 })),
  },
  {
    username: 'eugen',
    pin: '1919',
    role: 'driver',
    routes: MD_OUT.map(dest => ({ origin: 'MD', destination: dest, range_start: 100, range_end: 199 })),
  },
  {
    username: 'ilie',
    pin: '9191',
    role: 'driver',
    routes: MD_OUT.map(dest => ({ origin: 'MD', destination: dest, range_start: 900, range_end: 999 })),
  },
  {
    username: 'oficiu',
    pin: '1099',
    role: 'driver',
    routes: MD_OUT.map(dest => ({ origin: 'MD', destination: dest, range_start: 1, range_end: 99 })),
  },
  {
    username: 'gheorghe',
    pin: '3030',
    role: 'driver',
    routes: MD_OUT.map(dest => ({ origin: 'MD', destination: dest, range_start: 300, range_end: 349 })),
  },
  {
    username: 'stelian',
    pin: '3535',
    role: 'driver',
    routes: MD_OUT.map(dest => ({ origin: 'MD', destination: dest, range_start: 350, range_end: 399 })),
  },
  // ── Dus-intors ──
  {
    username: 'ghenadie',
    pin: '4004',
    role: 'driver',
    routes: [
      { origin: 'MD', destination: 'BE', range_start: 400, range_end: 449 }, // B400-B449
      { origin: 'BE', destination: 'MD', range_start: 450, range_end: 499 }, // 450-499
    ],
  },
  // ── Repartizare (inbound x→MD) ──
  {
    username: 'catalin',
    pin: '1212',
    role: 'driver',
    routes: [
      { origin: 'BE', destination: 'MD', range_start: 100, range_end: 199 }, // B100-B199
    ],
  },
  {
    username: 'repartizare_germania',
    pin: '5050',
    role: 'driver',
    routes: [
      { origin: 'DE', destination: 'MD', range_start: 500, range_end: 550 }, // D500-D550
      { origin: 'NL', destination: 'MD', range_start: 550, range_end: 599 }, // OL550-OL599
    ],
  },
  {
    username: 'repartizare_olanda',
    pin: '2020',
    role: 'driver',
    routes: [
      { origin: 'NL', destination: 'MD', range_start: 200, range_end: 299 }, // OL200-OL299
    ],
  },
]

async function seed() {
  // ── 1. Sterge toti userii vechi @colete.local ──
  console.log('🗑️  Stergere useri vechi...\n')
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('❌ Nu pot lista userii:', listError.message)
    process.exit(1)
  }

  for (const u of existing.users.filter(u => u.email?.endsWith('@colete.local'))) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) console.error(`❌ Nu pot sterge ${u.email}: ${error.message}`)
    else console.log(`🗑️  Sters: ${u.email}`)
  }

  // ── 2. Creează useri noi ──
  console.log('\n🌱 Creare useri noi...\n')

  for (const user of USERS) {
    const email = `${user.username}@colete.local`

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: user.pin,
      email_confirm: true,
    })

    if (authError) {
      console.error(`❌ ${user.username}: ${authError.message}`)
      continue
    }

    const userId = authData.user.id

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, username: user.username, pin_code: user.pin, role: user.role })

    if (profileError) {
      console.error(`❌ ${user.username} profil: ${profileError.message}`)
      continue
    }

    if (user.routes.length > 0) {
      const { error: routesError } = await supabase
        .from('driver_route_ranges')
        .insert(user.routes.map(r => ({ ...r, driver_id: userId })))

      if (routesError) {
        console.error(`❌ ${user.username} rute: ${routesError.message}`)
        continue
      }
    }

    const routeSummary = user.routes.map(r => `${r.origin}→${r.destination} [${r.range_start}-${r.range_end}]`).join(', ')
    console.log(`✅ ${user.username.padEnd(22)} PIN: ${user.pin}  ${routeSummary || '(admin)'}`)
  }

  console.log('\n🎉 Gata!\n')
  console.log('   admin                → PIN: 0000')
  console.log('   depozit              → PIN: 6006  MD→* [600-699]')
  console.log('   eugen                → PIN: 1919  MD→* [100-199]')
  console.log('   ilie                 → PIN: 9191  MD→* [900-999]')
  console.log('   oficiu               → PIN: 1099  MD→* [1-99]')
  console.log('   gheorghe             → PIN: 3030  MD→* [300-349]')
  console.log('   stelian              → PIN: 3535  MD→* [350-399]')
  console.log('   ghenadie             → PIN: 4004  MD→BE [400-449]  BE→MD [450-499]')
  console.log('   catalin              → PIN: 1212  BE→MD [B100-B199]')
  console.log('   repartizare_germania → PIN: 5050  DE→MD [D500-D550]  NL→MD [OL550-OL599]')
  console.log('   repartizare_olanda   → PIN: 2020  NL→MD [OL200-OL299]')
}

seed()
