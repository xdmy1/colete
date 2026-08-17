// Supabase Edge Function: admin-delete-driver
// Permite unui ADMIN sa stearga definitiv un sofer.
//
// De ce e nevoie de aceasta functie:
//   - stergerea trebuie facuta in auth.users (de acolo cascadeaza profiles +
//     driver_route_ranges), ceea ce necesita service_role
//   - parcels.driver_id NU are ON DELETE CASCADE, deci un sofer cu colete nu
//     poate fi sters fara sa stergem intai coletele (+ pozele din storage).
//     Asta se face DOAR daca adminul confirma explicit: `deleteParcels: true`.
//
// Securitate: verificam ca apelantul e autentificat SI are role='admin'.
//             Un admin nu se poate sterge pe el insusi si nu poate sterge
//             ultimul admin ramas.
//
// Deploy:
//   supabase functions deploy admin-delete-driver
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Sesiune invalida' }, 401)
    }

    // Client admin (service role) — bypass RLS, poate sterge auth.users
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
      return json({ error: 'Doar adminii pot șterge șoferi' }, 403)
    }

    // ── 3. Parseaza inputul ──
    const body = await req.json().catch(() => null)
    const driverId: string | undefined = body?.driverId
    const deleteParcels: boolean = body?.deleteParcels === true

    if (!driverId) {
      return json({ error: 'Lipseste driverId' }, 400)
    }
    if (driverId === user.id) {
      return json({ error: 'Nu te poți șterge pe tine' }, 400)
    }

    const { data: target } = await admin
      .from('profiles')
      .select('username, role')
      .eq('id', driverId)
      .maybeSingle()

    if (!target) {
      return json({ error: 'Șoferul nu există' }, 404)
    }

    // Nu lasa contul fara admin
    if (target.role === 'admin') {
      const { count: adminCount } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
      if ((adminCount ?? 0) <= 1) {
        return json({ error: 'Nu poți șterge ultimul admin' }, 400)
      }
    }

    // ── 4. Coletele soferului — blocheaza daca nu s-a confirmat stergerea lor ──
    const { data: parcels, error: parcelsErr } = await admin
      .from('parcels')
      .select('id, photo_url, photo_urls')
      .eq('driver_id', driverId)

    if (parcelsErr) {
      return json({ error: `Eroare la citirea coletelor: ${parcelsErr.message}` }, 500)
    }

    const parcelCount = parcels?.length ?? 0
    if (parcelCount > 0 && !deleteParcels) {
      return json(
        {
          error: `Șoferul are ${parcelCount} colete. Confirmă ștergerea lor pentru a continua.`,
          parcelCount,
        },
        409
      )
    }

    // ── 5. Sterge pozele din storage, apoi coletele ──
    if (parcelCount > 0) {
      const paths = Array.from(
        new Set(
          (parcels ?? []).flatMap((p) => {
            const list: string[] = Array.isArray(p.photo_urls) ? [...p.photo_urls] : []
            if (p.photo_url) list.push(p.photo_url)
            return list.filter((path): path is string => typeof path === 'string' && path.length > 0)
          })
        )
      )

      // Storage accepta liste mari greu — trimitem in batch-uri
      for (let i = 0; i < paths.length; i += 100) {
        const { error: storageErr } = await admin.storage
          .from('parcels')
          .remove(paths.slice(i, i + 100))
        // Pozele orfane nu blocheaza stergerea — logam si continuam
        if (storageErr) console.error('storage remove failed:', storageErr.message)
      }

      const { error: delParcelsErr } = await admin
        .from('parcels')
        .delete()
        .eq('driver_id', driverId)

      if (delParcelsErr) {
        return json({ error: `Eroare la ștergerea coletelor: ${delParcelsErr.message}` }, 500)
      }
    }

    // ── 6. Sterge userul auth — cascadeaza profiles + driver_route_ranges ──
    const { error: authDelErr } = await admin.auth.admin.deleteUser(driverId)
    if (authDelErr) {
      return json({ error: `Eroare auth: ${authDelErr.message}` }, 500)
    }

    return json({ success: true, deletedParcels: parcelCount })
  } catch (err) {
    console.error('admin-delete-driver error:', err)
    return json({ error: 'Eroare interna' }, 500)
  }
})
