// Supabase Edge Function: admin-create-driver
// Permite unui ADMIN sa adauge un sofer nou (auth user + profil + rutele lui).
//
// De ce e nevoie de aceasta functie:
//   - un sofer nou are nevoie de un rand in auth.users (email `<username>@colete.local`,
//     parola = PIN-ul), ceea ce necesita service_role (nu poate sta in frontend)
//   - profilul + rutele trebuie create atomic; daca ceva esueaza, facem rollback
//     stergand userul auth (profiles + driver_route_ranges au ON DELETE CASCADE)
//
// Securitate: verificam ca apelantul e autentificat SI are role='admin'.
//
// Deploy:
//   supabase functions deploy admin-create-driver
//
// (foloseste SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, injectate automat de Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const COUNTRY_CODES = ['UK', 'BE', 'NL', 'MD', 'DE']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type RouteInput = {
  origin: string
  destination: string
  range_start: number
  range_end: number
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Verifica ca apelantul e autentificat ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Neautentificat' }, 401)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Sesiune invalida' }, 401)
    }

    // Client admin (service role) — bypass RLS, poate crea auth.users
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 2. Verifica ca apelantul e ADMIN ──
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Doar adminii pot adăuga șoferi' }, 403)
    }

    // ── 3. Parseaza inputul ──
    const body = await req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
    const role = body?.role === 'admin' ? 'admin' : 'driver'
    const routes: RouteInput[] = Array.isArray(body?.routes) ? body.routes : []

    if (!/^[a-z0-9_]{2,}$/.test(username)) {
      return json({ error: 'Nume invalid (doar litere mici, cifre, _; minim 2 caractere)' }, 400)
    }
    if (!/^\d{4,}$/.test(pin)) {
      return json({ error: 'PIN invalid (minim 4 cifre)' }, 400)
    }
    const routeErr = validateRoutes(routes)
    if (routeErr) {
      return json({ error: routeErr }, 400)
    }

    // ── 4. Verifica unicitatea username/PIN ──
    // PIN-ul trebuie unic global: login-ul cauta profilul DUPA PIN.
    const { data: nameClash } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (nameClash) {
      return json({ error: 'Numele este deja folosit' }, 409)
    }

    const { data: pinClash } = await admin
      .from('profiles')
      .select('username')
      .eq('pin_code', pin)
      .maybeSingle()
    if (pinClash) {
      return json({ error: `PIN-ul este deja folosit de "${pinClash.username}"` }, 409)
    }

    // ── 5. Creeaza userul auth (email din username, parola = PIN) ──
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: `${username}@colete.local`,
      password: pin,
      email_confirm: true,
    })
    if (createErr || !created?.user) {
      return json({ error: `Eroare auth: ${createErr?.message ?? 'user necreat'}` }, 500)
    }
    const driverId = created.user.id

    // ── 6. Creeaza profilul; la eroare, rollback pe userul auth ──
    const { error: profErr } = await admin
      .from('profiles')
      .insert({ id: driverId, username, pin_code: pin, role })

    if (profErr) {
      await admin.auth.admin.deleteUser(driverId)
      return json({ error: `Eroare profil: ${profErr.message}` }, 500)
    }

    // ── 7. Creeaza rutele; la eroare, rollback complet (cascade sterge profilul) ──
    if (routes.length > 0) {
      const { error: routesErr } = await admin
        .from('driver_route_ranges')
        .insert(routes.map((r) => ({ ...r, driver_id: driverId })))

      if (routesErr) {
        await admin.auth.admin.deleteUser(driverId)
        return json({ error: `Eroare rute: ${routesErr.message}` }, 500)
      }
    }

    return json({ success: true, driverId })
  } catch (err) {
    console.error('admin-create-driver error:', err)
    return json({ error: 'Eroare interna' }, 500)
  }
})
