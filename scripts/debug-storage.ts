import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://twbixwibvgxriffpfelt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Yml4d2lidmd4cmlmZnBmZWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE4NDI4MiwiZXhwIjoyMDg2NzYwMjgyfQ.ucx2pYiujGrUEHdWgnAk3X-ZmPlrdCsm_aZGBETLdvk',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function debug() {
  // Check if bucket exists
  console.log('=== STORAGE BUCKETS ===')
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
  if (bucketsErr) {
    console.log('Error listing buckets:', bucketsErr.message)
  } else {
    console.log('Buckets:', buckets?.map(b => `${b.name} (public: ${b.public})`))
  }

  // Try to create bucket if it doesn't exist
  const parcelsBucket = buckets?.find(b => b.name === 'parcels')
  if (!parcelsBucket) {
    console.log('\n⚠️  Bucket "parcels" NU EXISTA! Il creez...')
    const { error: createErr } = await supabase.storage.createBucket('parcels', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (createErr) {
      console.log('Error creating bucket:', createErr.message)
    } else {
      console.log('✅ Bucket "parcels" creat!')
    }
  } else {
    console.log(`\n✅ Bucket "parcels" exista (public: ${parcelsBucket.public})`)
  }

  // Test upload
  console.log('\n=== TEST UPLOAD ===')
  const testContent = new Uint8Array([0xFF, 0xD8, 0xFF]) // fake JPEG header
  const { error: uploadErr } = await supabase.storage
    .from('parcels')
    .upload('test/test.jpg', testContent, { contentType: 'image/jpeg' })

  if (uploadErr) {
    console.log('Upload FAILED:', uploadErr.message)
  } else {
    console.log('Upload OK!')
    await supabase.storage.from('parcels').remove(['test/test.jpg'])
    console.log('Test file deleted.')
  }
}

debug()
