// Rulează: npx tsx scripts/archive-week12.ts
// Marchează toate coletele din săptămâna 12 (2026-W12) ca livrate și le arhivează

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twbixwibvgxriffpfelt.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const WEEK_ID = '2026-W12'

async function archiveWeek12() {
  // 1. Verifică câte colete există în săptămâna 12
  const { data: parcels, error: fetchError } = await supabase
    .from('parcels')
    .select('id, human_id, status, is_archived')
    .eq('week_id', WEEK_ID)

  if (fetchError) {
    console.error('Eroare la citirea coletelor:', fetchError.message)
    process.exit(1)
  }

  if (!parcels || parcels.length === 0) {
    console.log(`Nu s-au găsit colete pentru ${WEEK_ID}.`)
    process.exit(0)
  }

  console.log(`Găsite ${parcels.length} colete în ${WEEK_ID}:`)
  const already = parcels.filter(p => p.is_archived)
  const toProcess = parcels.filter(p => !p.is_archived)
  if (already.length > 0) {
    console.log(`  - ${already.length} deja arhivate (vor fi ignorate)`)
  }
  console.log(`  - ${toProcess.length} de procesat`)

  if (toProcess.length === 0) {
    console.log('Toate coletele sunt deja arhivate. Nimic de făcut.')
    process.exit(0)
  }

  // 2. Update: status = 'delivered', is_archived = true, delivered_at = now() (dacă nu e setat)
  const now = new Date().toISOString()
  const ids = toProcess.map(p => p.id)

  const { error: updateError, count } = await supabase
    .from('parcels')
    .update({
      status: 'delivered',
      is_archived: true,
      delivered_at: now,
    })
    .in('id', ids)
    .is('delivered_at', null) // setează delivered_at doar dacă nu e deja setat

  if (updateError) {
    console.error('Eroare la update (delivered_at null):', updateError.message)
    process.exit(1)
  }

  // Update și pentru cele care au deja delivered_at (doar status + archived)
  const { error: updateError2 } = await supabase
    .from('parcels')
    .update({
      status: 'delivered',
      is_archived: true,
    })
    .in('id', ids)
    .not('delivered_at', 'is', null)

  if (updateError2) {
    console.error('Eroare la update (delivered_at set):', updateError2.message)
    process.exit(1)
  }

  console.log(`\n✅ Gata! ${toProcess.length} colete din ${WEEK_ID} marcate ca livrate și arhivate.`)
}

archiveWeek12()
