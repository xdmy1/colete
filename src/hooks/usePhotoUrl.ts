import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Parcel } from '../lib/types'

// Toate pozele unui colet (nou: photo_urls, legacy: photo_url)
export function getParcelPhotoPaths(parcel: Parcel): string[] {
  if (parcel.photo_urls && parcel.photo_urls.length > 0) return parcel.photo_urls
  if (parcel.photo_url) return [parcel.photo_url]
  return []
}

// Toate path-urile de sters cand se sterge un colet (incluse legacy)
export function getParcelAllPhotoPaths(parcel: { photo_url?: string | null; photo_urls?: string[] }): string[] {
  const paths = new Set<string>()
  if (parcel.photo_urls) parcel.photo_urls.forEach((p) => paths.add(p))
  if (parcel.photo_url) paths.add(parcel.photo_url)
  return Array.from(paths)
}

// Signed URL — fresh per sesiune, fara CDN cache stale
// Valabil 1h, React Query il tine 50min
export function useSignedPhotoUrl(photoPath: string | null) {
  return useQuery({
    queryKey: ['photo-url', photoPath],
    queryFn: async () => {
      if (!photoPath) return null
      const { data, error } = await supabase.storage
        .from('parcels')
        .createSignedUrl(photoPath, 3600)
      if (error || !data) return null
      return data.signedUrl
    },
    enabled: !!photoPath,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

// Batch prefetch: un singur request pentru toate pozele din lista
// Apelat din useDriverParcels / useAllParcels dupa ce vin datele
export async function batchPrefetchSignedUrls(queryClient: QueryClient, photoPaths: string[]) {
  if (photoPaths.length === 0) return

  // Filtreaza doar path-urile care nu sunt deja in cache
  const missing = photoPaths.filter((p) => {
    const cached = queryClient.getQueryData(['photo-url', p])
    return cached === undefined
  })
  if (missing.length === 0) return

  const { data } = await supabase.storage
    .from('parcels')
    .createSignedUrls(missing, 3600)

  if (!data) return
  for (const item of data) {
    if (item.signedUrl && !item.error) {
      queryClient.setQueryData(['photo-url', item.path], item.signedUrl)
    }
  }
}

// Sincron — doar pentru exportExcel (care face fetch oricum)
export function getPublicPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null
  if (photoPath.startsWith('http')) return photoPath
  const { data } = supabase.storage.from('parcels').getPublicUrl(photoPath)
  return data.publicUrl
}

// Backward compat alias
export const getPhotoUrl = getPublicPhotoUrl

export function prefetchPhotoUrls(_photoPaths: string[]) {
  // no-op — inlocuit cu batchPrefetchSignedUrls
}
