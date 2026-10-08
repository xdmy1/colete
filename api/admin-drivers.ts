// Vercel Serverless Function: POST /api/admin-drivers
// Adaugare + editare (nume/PIN) + stergere de soferi — actiuni care ating
// auth.users, deci cer service_role.
//
// De ce sta aici si nu in supabase/functions:
//   deploy-ul unei Edge Function cere un Personal Access Token de Supabase;
//   functiile de pe Vercel se deployeaza automat la fiecare push, fara pas manual.
//
// PIN-ul are 4 cifre, dar Supabase Auth refuza parole sub 6 caractere, asa ca
// parola de login e derivata din PIN cu `pinToPassword` (src/lib/pin.ts) —
// aceeasi functie e folosita si la login (useAuth).
//
// Env necesar (setat in proiectul Vercel):
//   VITE_SUPABASE_URL / SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Securitate: apelantul trebuie autentificat (JWT in Authorization) SI role='admin'.

import { createClient } from '@supabase/supabase-js'
import { PIN_ERROR, isValidPin, pinToPassword } from '../src/lib/pin.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const COUNTRY_CODES = ['UK', 'BE', 'NL', 'MD', 'DE']

type RouteInput = {
  origin: string
  destination: string
  range_start: number
  range_end: number
}

// Tipuri minime pentru handler-ul Vercel (fara dependinta @vercel/node)
type VercelRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}
type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

// Valideaza lista de rute; intoarce mesajul de eroare sau null daca e ok
function validateRoutes(routes: RouteInput[]): string | null {
  const seen = new Set<string>()
  for (const r of routes) {
    if (!COUNTRY_CODES.includes(r.origin) || !COUNTRY_CODES.includes(r.destination)) {
      return 'Rută invalidă (țară necunoscută)'
    }
    if (r.origin === r.destination) {
      return 'Rută invalidă (origine = destinație)'
    }
    const key = `${r.origin}>${r.destination}`
    if (seen.has(key)) {
      return `Ruta ${r.origin}→${r.destination} apare de două ori`
    }
    seen.add(key)

    if (!Number.isInteger(r.range_start) || !Number.isInteger(r.range_end)) {
      return 'Range invalid (doar numere întregi)'
    }
    if (r.range_start < 0 || r.range_end > 100000) {
      return 'Range invalid (0 - 100000)'
    }
    if (r.range_end <= r.range_start) {
      return `Range invalid pe ${r.origin}→${r.destination} (finalul trebuie mai mare decât începutul)`
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isHealthCheck = req.method === 'GET' && req.query?.health === '1'

  if (req.method !== 'POST' && !isHealthCheck) {
    return res.status(405).json({ error: 'Doar POST' })
  }
  if (!supabaseUrl || !serviceKey) {
    console.error('admin-drivers: env lipsa (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return res.status(500).json({ error: 'Server neconfigurat', ok: false })
  }

  // Client admin (service role) — bypass RLS, poate crea/sterge auth.users
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Health check public: confirma doar ca env-ul e pus si cheia service_role
  // functioneaza. Nu intoarce date — detaliile erorii merg in logurile Vercel.
  if (isHealthCheck) {
    const { error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    if (error) console.error('admin-drivers health check failed:', error.message)
    return res.status(error ? 500 : 200).json({ ok: !error, db: error ? 'error' : 'ok' })
  }

  try {
    // ── 1. Verifica sesiunea apelantului ──
    const rawAuth = req.headers.authorization
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Neautentificat' })
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.slice('Bearer '.length)
    )
    const caller = userData?.user
    if (userErr || !caller) {
      return res.status(401).json({ error: 'Sesiune invalidă' })
    }

    // ── 2. Verifica ca apelantul e ADMIN ──
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Doar adminii pot gestiona șoferii' })
    }

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as
      | Record<string, unknown>
      | null
      | undefined
    const action = body?.action

    if (action === 'create') return await createDriver(admin, body!, res)
    if (action === 'update') return await updateDriver(admin, body!, res)
    if (action === 'delete') return await deleteDriver(admin, body!, caller.id, res)
    return res.status(400).json({ error: 'Acțiune necunoscută' })
  } catch (err) {
    console.error('admin-drivers error:', err)
    return res.status(500).json({ error: 'Eroare internă' })
  }
}

// ── CREATE: auth user + profil + rute, cu rollback daca un pas eseueaza ──
async function createDriver(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  res: VercelResponse
) {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  const role = body.role === 'admin' ? 'admin' : 'driver'
  const routes: RouteInput[] = Array.isArray(body.routes) ? (body.routes as RouteInput[]) : []

  if (!/^[a-z0-9_]{2,}$/.test(username)) {
    return res.status(400).json({ error: 'Nume invalid (doar litere mici, cifre, _; minim 2 caractere)' })
  }
  if (!isValidPin(pin)) {
    return res.status(400).json({ error: PIN_ERROR })
  }
  const routeErr = validateRoutes(routes)
  if (routeErr) {
    return res.status(400).json({ error: routeErr })
  }

  // Unicitate: numele formeaza email-ul de login, PIN-ul e cheia de căutare la login
  const { data: nameClash } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (nameClash) {
    return res.status(409).json({ error: 'Numele este deja folosit' })
  }

  const { data: pinClash } = await admin
    .from('profiles')
    .select('username')
    .eq('pin_code', pin)
    .maybeSingle()
  if (pinClash) {
    return res.status(409).json({ error: `PIN-ul este deja folosit de "${pinClash.username}"` })
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: `${username}@colete.local`,
    password: pinToPassword(pin),
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    return res.status(500).json({ error: `Eroare auth: ${createErr?.message ?? 'user necreat'}` })
  }
  const driverId = created.user.id

  const { error: profErr } = await admin
    .from('profiles')
    .insert({ id: driverId, username, pin_code: pin, role })

  if (profErr) {
    await admin.auth.admin.deleteUser(driverId)
    return res.status(500).json({ error: `Eroare profil: ${profErr.message}` })
  }

  if (routes.length > 0) {
    const { error: routesErr } = await admin
      .from('driver_route_ranges')
      .insert(routes.map((r) => ({ ...r, driver_id: driverId })))

    if (routesErr) {
      // Cascade pe auth.users curata si profilul
      await admin.auth.admin.deleteUser(driverId)
      return res.status(500).json({ error: `Eroare rute: ${routesErr.message}` })
    }
  }

  return res.status(200).json({ success: true, driverId })
}

// ── UPDATE: schimba numele si/sau PIN-ul unui sofer.
// Numele formeaza email-ul de login, PIN-ul e parola, deci auth.users si
// profiles se actualizeaza impreuna (cu service role).
async function updateDriver(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  res: VercelResponse
) {
  const driverId = typeof body.driverId === 'string' ? body.driverId : ''
  const newUsername =
    typeof body.username === 'string' ? body.username.trim().toLowerCase() : undefined
  const newPin = typeof body.pin === 'string' ? body.pin.trim() : undefined

  if (!driverId) {
    return res.status(400).json({ error: 'Lipsește driverId' })
  }
  if (newUsername === undefined && newPin === undefined) {
    return res.status(400).json({ error: 'Nimic de modificat' })
  }
  if (newUsername !== undefined && !/^[a-z0-9_]{2,}$/.test(newUsername)) {
    return res.status(400).json({ error: 'Nume invalid (doar litere mici, cifre, _; minim 2 caractere)' })
  }
  if (newPin !== undefined && !isValidPin(newPin)) {
    return res.status(400).json({ error: PIN_ERROR })
  }

  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', driverId)
    .maybeSingle()
  if (!target) {
    return res.status(404).json({ error: 'Șoferul nu există' })
  }

  if (newUsername !== undefined) {
    const { data: clash } = await admin
      .from('profiles')
      .select('id')
      .eq('username', newUsername)
      .neq('id', driverId)
      .maybeSingle()
    if (clash) {
      return res.status(409).json({ error: 'Numele este deja folosit de alt șofer' })
    }
  }
  if (newPin !== undefined) {
    const { data: pinClash } = await admin
      .from('profiles')
      .select('username')
      .eq('pin_code', newPin)
      .neq('id', driverId)
      .maybeSingle()
    if (pinClash) {
      return res.status(409).json({ error: `PIN-ul este deja folosit de "${pinClash.username}"` })
    }
  }

  const authUpdates: { email?: string; email_confirm?: boolean; password?: string } = {}
  if (newUsername !== undefined) {
    authUpdates.email = `${newUsername}@colete.local`
    authUpdates.email_confirm = true
  }
  if (newPin !== undefined) authUpdates.password = pinToPassword(newPin)

  const { error: authUpdErr } = await admin.auth.admin.updateUserById(driverId, authUpdates)
  if (authUpdErr) {
    return res.status(500).json({ error: `Eroare auth: ${authUpdErr.message}` })
  }

  const profileUpdates: { username?: string; pin_code?: string } = {}
  if (newUsername !== undefined) profileUpdates.username = newUsername
  if (newPin !== undefined) profileUpdates.pin_code = newPin

  const { error: profErr } = await admin.from('profiles').update(profileUpdates).eq('id', driverId)
  if (profErr) {
    // auth.users e deja actualizat dar profiles a esuat → desincronizare.
    // Logam ca sa fie reparat manual; parola veche nu o mai stim.
    console.error('admin-drivers update: profiles failed AFTER auth update — out of sync:', profErr)
    return res.status(500).json({ error: `Eroare profil: ${profErr.message}` })
  }

  return res.status(200).json({ success: true })
}

// ── DELETE: sterge soferul (cascade pe profil + rute).
// parcels.driver_id NU cascadeaza, deci coletele + pozele se sterg doar cand
// adminul confirma explicit (deleteParcels).
async function deleteDriver(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  callerId: string,
  res: VercelResponse
) {
  const driverId = typeof body.driverId === 'string' ? body.driverId : ''
  const deleteParcels = body.deleteParcels === true

  if (!driverId) {
    return res.status(400).json({ error: 'Lipsește driverId' })
  }
  if (driverId === callerId) {
    return res.status(400).json({ error: 'Nu te poți șterge pe tine' })
  }

  const { data: target } = await admin
    .from('profiles')
    .select('username, role')
    .eq('id', driverId)
    .maybeSingle()

  if (!target) {
    return res.status(404).json({ error: 'Șoferul nu există' })
  }

  // Nu lasa contul fara admin
  if (target.role === 'admin') {
    const { count: adminCount } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if ((adminCount ?? 0) <= 1) {
      return res.status(400).json({ error: 'Nu poți șterge ultimul admin' })
    }
  }

  const { data: parcels, error: parcelsErr } = await admin
    .from('parcels')
    .select('photo_url, photo_urls')
    .eq('driver_id', driverId)

  if (parcelsErr) {
    return res.status(500).json({ error: `Eroare la citirea coletelor: ${parcelsErr.message}` })
  }

  const parcelCount = parcels?.length ?? 0
  if (parcelCount > 0 && !deleteParcels) {
    return res.status(409).json({
      error: `Șoferul are ${parcelCount} colete. Confirmă ștergerea lor pentru a continua.`,
      parcelCount,
    })
  }

  if (parcelCount > 0) {
    const paths = Array.from(
      new Set(
        (parcels ?? []).flatMap((p) => {
          const list: unknown[] = Array.isArray(p.photo_urls) ? [...p.photo_urls] : []
          if (p.photo_url) list.push(p.photo_url)
          return list.filter((path): path is string => typeof path === 'string' && path.length > 0)
        })
      )
    )

    // Storage nu inghite liste mari — trimitem in batch-uri.
    // Pozele orfane nu blocheaza stergerea: logam si continuam.
    for (let i = 0; i < paths.length; i += 100) {
      const { error: storageErr } = await admin.storage
        .from('parcels')
        .remove(paths.slice(i, i + 100))
      if (storageErr) console.error('storage remove failed:', storageErr.message)
    }

    const { error: delParcelsErr } = await admin.from('parcels').delete().eq('driver_id', driverId)
    if (delParcelsErr) {
      return res.status(500).json({ error: `Eroare la ștergerea coletelor: ${delParcelsErr.message}` })
    }
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(driverId)
  if (authDelErr) {
    return res.status(500).json({ error: `Eroare auth: ${authDelErr.message}` })
  }

  return res.status(200).json({ success: true, deletedParcels: parcelCount })
}
