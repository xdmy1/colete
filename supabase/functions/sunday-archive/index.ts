// Supabase Edge Function: sunday-archive
// Apelata via cron duminica seara la 23:59 (Europe/Chisinau)
// Arhiveaza coletele livrate, cele pending raman pentru saptamana urmatoare.
//
// Setup cron in Supabase Dashboard → Database → Extensions → pg_cron:
//   SELECT cron.schedule(
//     'sunday-archive-reset',
//     '59 23 * * 0',   -- duminica 23:59
//     $$SELECT public.sunday_archive_reset()$$
//   );
//
// SAU foloseste acest Edge Function cu Supabase cron trigger:
// Dashboard → Edge Functions → sunday-archive → Add Schedule → 59 23 * * 0

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    // Verify this is a cron call or authorized request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase.rpc('sunday_archive_reset')

    if (error) {
      console.error('Archive reset failed:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Sunday archive reset completed successfully')
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
