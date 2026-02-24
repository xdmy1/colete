import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://twbixwibvgxriffpfelt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function debug() {
  // 1. Check columns in parcels table
  console.log('=== CHECKING PARCELS TABLE COLUMNS ===')
  const { data: cols, error: colErr } = await supabase
    .from('parcels')
    .select('*')
    .limit(0)

  if (colErr) {
    console.log('Error querying parcels:', colErr.message)
  } else {
    console.log('Parcels table exists, checking columns...')
  }

  // Try inserting with origin_code + delivery_destination
  console.log('\n=== TEST INSERT (origin_code + delivery_destination) ===')
  const { error: insertErr1 } = await supabase.from('parcels').insert({
    human_id: 'TEST-1',
    numeric_id: 999,
    driver_id: '7d0471a8-6060-4352-a7cc-51e510e28cec', // ion_centru
    week_id: '2026-W07',
    origin_code: 'MD',
    delivery_destination: 'UK',
    sender_details: { name: 'Test', phone: '123', address: 'Test' },
    receiver_details: { name: 'Test', phone: '456', address: 'Test' },
    weight: 1,
    price: 1.5,
    currency: 'GBP',
  })

  if (insertErr1) {
    console.log('INSERT FAILED:', insertErr1.message, insertErr1.code, insertErr1.details)
  } else {
    console.log('INSERT OK! Columns are correct.')
    // Clean up test row
    await supabase.from('parcels').delete().eq('human_id', 'TEST-1')
    console.log('Test row deleted.')
  }

  // 2. Check get_next_numeric_id function signature
  console.log('\n=== TEST get_next_numeric_id (2 params) ===')
  const { data: nextId, error: rpcErr } = await supabase.rpc('get_next_numeric_id', {
    p_driver_id: '7d0471a8-6060-4352-a7cc-51e510e28cec',
    p_week_id: '2026-W07',
  })

  if (rpcErr) {
    console.log('RPC FAILED:', rpcErr.message, rpcErr.code)
  } else {
    console.log('RPC OK! Next ID:', nextId)
  }
}

debug()
