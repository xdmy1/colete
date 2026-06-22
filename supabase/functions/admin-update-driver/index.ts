// Supabase Edge Function: admin-update-driver
// Permite unui ADMIN sa schimbe numele (username) si PIN-ul unui sofer.
//
// De ce e nevoie de aceasta functie:
//   - PIN-ul e folosit ca PAROLA de autentificare (auth.users.encrypted_password)
//   - username-ul formeaza EMAIL-ul de login (`<username>@colete.local`)
//   Deci o schimbare trebuie facuta atomic in auth.users SI in public.profiles,
//   ceea ce necesita service_role (nu poate sta in frontend).
//
// Securitate: verificam ca apelantul e autentificat SI are role='admin'.
//
// Deploy:
//   supabase functions deploy admin-update-driver
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

    // Client "ca utilizator" — verifica tokenul si afla cine apeleaza
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Sesiune invalida' }, 401)
    }

    // Client admin (service role) — bypass RLS, poate edita auth.users
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
      return json({ error: 'Doar adminii pot modifica soferii' }, 403)
    }

    // ── 3. Parseaza inputul ──
    const body = await req.json().catch(() => null)
    const driverId: string | undefined = body?.driverId
    const rawUsername: unknown = body?.username
    const rawPin: unknown = body?.pin

    if (!driverId) {
      return json({ error: 'Lipseste driverId' }, 400)
    }

    const newUsername = typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : undefined
    const newPin = typeof rawPin === 'string' ? rawPin.trim() : undefined

    if (newUsername === undefined && newPin === undefined) {
      return json({ error: 'Nimic de modificat' }, 400)
    }

    // Validari
    if (newUsername !== undefined) {
      if (!/^[a-z0-9_]{2,}$/.test(newUsername)) {
        return json({ error: 'Nume invalid (doar litere mici, cifre, _; minim 2 caractere)' }, 400)
      }
    }
    if (newPin !== undefined) {
      if (!/^\d{4,}$/.test(newPin)) {
        return json({ error: 'PIN invalid (minim 4 cifre)' }, 400)
      }
    }

    // ── 4. Verifica unicitatea username/PIN ──
    if (newUsername !== undefined) {
      const { data: clash } = await admin
        .from('profiles')
        .select('id')
        .eq('username', newUsername)
        .neq('id', driverId)
        .maybeSingle()
      if (clash) {
        return json({ error: 'Numele este deja folosit de alt sofer' }, 409)
      }
    }
    if (newPin !== undefined) {
      const { data: pinClash } = await admin
        .from('profiles')
        .select('id, username')
        .eq('pin_code', newPin)
        .neq('id', driverId)
        .maybeSingle()
      if (pinClash) {
        return json({ error: `PIN-ul este deja folosit de "${pinClash.username}"` }, 409)
      }
    }

    // ── 5. Actualizeaza auth.users (email pt username, password pt PIN) ──
    const authUpdates: { email?: string; password?: string } = {}
    if (newUsername !== undefined) authUpdates.email = `${newUsername}@colete.local`
    if (newPin !== undefined) authUpdates.password = newPin

    const { error: authUpdErr } = await admin.auth.admin.updateUserById(driverId, authUpdates)
    if (authUpdErr) {
      return json({ error: `Eroare auth: ${authUpdErr.message}` }, 500)
    }

    // ── 6. Actualizeaza profiles ──
    const profileUpdates: { username?: string; pin_code?: string } = {}
    if (newUsername !== undefined) profileUpdates.username = newUsername
    if (newPin !== undefined) profileUpdates.pin_code = newPin

    const { error: profErr } = await admin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', driverId)

    if (profErr) {
      // auth.users a fost deja actualizat dar profiles a esuat → desincronizare.
      // Logam ca sa fie reparat manual; nu putem reface parola veche (nu o stim).
      console.error('Profile update failed AFTER auth update — out of sync:', profErr)
      return json({ error: `Eroare profil: ${profErr.message}` }, 500)
    }

    return json({ success: true })
  } catch (err) {
    console.error('admin-update-driver error:', err)
    return json({ error: 'Eroare interna' }, 500)
  }
})
