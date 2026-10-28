// Why this exists: on 25 Oct 2026 the app moved from Supabase cloud to the VPS (colete.davo.md).
// An old build still open on one phone kept writing to the old database, so its parcels were
// numbered from 1 and were invisible to everyone else. Numbering itself is decided by the server
// (get_next_numeric_id + a unique index), so no server rule can stop a client that talks to a
// different server. This file makes the app refuse to run against anything but the one backend,
// and makes a stale build reload itself as soon as a newer one is published.

import { supabase } from './supabase'

/** The only backend this app may talk to; the database answers backend_id() with EXPECTED_BACKEND. */
export const EXPECTED_HOST = 'colete.davo.md'
export const EXPECTED_BACKEND = 'vps-colete-davo-md'

export type BackendCheck = { ok: true } | { ok: false; reason: string }

/** Build-time check: the configured URL must be the VPS gateway. */
export function backendHostOk(): BackendCheck {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  let host = ''
  try {
    host = new URL(url ?? '').host
  } catch {
    return { ok: false, reason: `URL de backend invalid: ${url ?? '(lipsă)'}` }
  }
  return host === EXPECTED_HOST ? { ok: true } : { ok: false, reason: `Backend greșit: ${host}` }
}

/** Runtime check: the database on the other side must identify itself as the VPS one. */
export async function backendIdentityOk(): Promise<BackendCheck> {
  const { data, error } = await supabase.rpc('backend_id')
  if (error) return { ok: false, reason: `Baza de date nu răspunde ca cea corectă (${error.message})` }
  return data === EXPECTED_BACKEND ? { ok: true } : { ok: false, reason: `Bază de date greșită: ${String(data)}` }
}

/**
 * A build that is no longer the published one reloads itself: /version.json is written by every
 * build (vite.config.ts) and served with no-cache, so a phone that kept the app open for days, or a
 * cached bundle, picks up the new build the next time it is looked at. Checked on load, whenever
 * the tab becomes visible, and every 10 minutes.
 */
export function startVersionWatch(): void {
  if (import.meta.env.DEV) return
  let reloading = false
  const check = async () => {
    if (reloading || document.visibilityState !== 'visible') return
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) return
      const { buildId } = (await r.json()) as { buildId?: string }
      if (buildId && buildId !== __BUILD_ID__) {
        reloading = true
        window.location.reload()
      }
    } catch {
      // Offline or blocked: nothing to do, the next check will run.
    }
  }
  void check()
  document.addEventListener('visibilitychange', () => void check())
  window.setInterval(() => void check(), 10 * 60 * 1000)
}
