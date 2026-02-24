import { supabase } from '../lib/supabase'

// Public bucket — URL direct, zero latenta
export function getPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null
  if (photoPath.startsWith('http')) return photoPath
  const { data } = supabase.storage.from('parcels').getPublicUrl(photoPath)
  return data.publicUrl
}

export function usePhotoUrl(photoPath: string | null): string | null {
  return getPhotoUrl(photoPath)
}

// Preload: descarca imaginile in browser cache INAINTE ca userul sa apese
// Se apeleaza cand lista de colete se incarca
export function prefetchPhotoUrls(photoPaths: string[]) {
  for (const path of photoPaths) {
    if (!path) continue
    const url = getPhotoUrl(path)
    if (!url) continue
    const img = new Image()
    img.src = url
  }
}
