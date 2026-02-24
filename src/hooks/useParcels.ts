import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Parcel, NewParcelData, Profile } from '../lib/types'
import {
  calculatePrice,
  getCurrency,
  buildHumanId,
  getCurrentWeekId,
} from '../lib/utils'
import { compressImage } from '../lib/compressImage'
import { prefetchPhotoUrls } from './usePhotoUrl'

// Coletele active (nearhivate) ale unui sofer
export function useDriverParcels(driverId: string | undefined) {
  return useQuery({
    queryKey: ['parcels', 'driver', driverId],
    queryFn: async () => {
      if (!driverId) return []
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('driver_id', driverId)
        .eq('is_archived', false)
        .order('route_order', { ascending: true })

      if (error) throw error
      const parcels = data as Parcel[]
      // Pre-fetch toate signed URL-urile in batch (1 request)
      const photoPaths = parcels.map((p) => p.photo_url).filter(Boolean) as string[]
      if (photoPaths.length > 0) prefetchPhotoUrls(photoPaths)
      return parcels
    },
    enabled: !!driverId,
  })
}

// ADMIN: toate coletele active (de la toti soferii)
export function useAllParcels() {
  return useQuery({
    queryKey: ['parcels', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('is_archived', false)
        .order('route_order', { ascending: true })

      if (error) throw error
      const parcels = data as Parcel[]
      // Pre-fetch toate signed URL-urile in batch (1 request)
      const photoPaths = parcels.map((p) => p.photo_url).filter(Boolean) as string[]
      if (photoPaths.length > 0) prefetchPhotoUrls(photoPaths)
      return parcels
    },
  })
}

// ADMIN: lista tuturor soferilor
export function useAllDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .order('range_start', { ascending: true })

      if (error) throw error
      return data as Profile[]
    },
  })
}

// Adauga colet nou
export function useAddParcel(driverId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (parcelData: NewParcelData) => {
      const weekId = getCurrentWeekId()

      // 1. Ia urmatorul numeric_id
      const { data: nextId, error: idError } = await supabase.rpc(
        'get_next_numeric_id',
        {
          p_driver_id: driverId,
          p_week_id: weekId,
        }
      )

      if (idError) {
        console.error('[ADD] get_next_numeric_id failed:', idError)
        throw idError
      }

      const numericId = nextId as number
      const humanId = buildHumanId(parcelData.delivery_destination, numericId)
      const price = calculatePrice(parcelData.weight)
      const currency = getCurrency(parcelData.origin_code, parcelData.delivery_destination)

      // 2. Upload poza — compresata daca e prea mare
      let photoUrl: string | null = null
      if (parcelData.photo) {
        const photo = parcelData.photo.size > 200_000
          ? await compressImage(parcelData.photo)
          : parcelData.photo
        const fileName = humanId.replace(/[^a-zA-Z0-9-]/g, '_')
        const filePath = `${driverId}/${weekId}/${fileName}.jpg`

        console.log('[ADD] uploading photo:', filePath, 'size:', photo.size)

        const { error: uploadError } = await supabase.storage
          .from('parcels')
          .upload(filePath, photo, { upsert: true })

        if (uploadError) {
          console.error('[ADD] photo upload failed:', uploadError)
          throw uploadError
        }

        photoUrl = filePath
      }

      // 3. Insert colet
      const insertData = {
        human_id: humanId,
        numeric_id: numericId,
        driver_id: driverId,
        week_id: weekId,
        origin_code: parcelData.origin_code,
        delivery_destination: parcelData.delivery_destination,
        sender_details: parcelData.sender_details,
        receiver_details: parcelData.receiver_details,
        content_description: parcelData.content_description || null,
        appearance: parcelData.appearance,
        weight: parcelData.weight,
        price,
        currency,
        photo_url: photoUrl,
        labels: [],
      }

      console.log('[ADD] inserting parcel:', insertData)

      const { data, error } = await supabase
        .from('parcels')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('[ADD] insert failed:', error)
        throw error
      }
      return data as Parcel
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
    },
  })
}

// Reorder parcels (drag & drop) — update route_order with optimistic UI
export function useReorderParcels(_driverId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('parcels')
          .update({ route_order: index })
          .eq('id', id)
      )
      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onMutate: async (orderedIds) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['parcels'] })

      // Snapshot previous data
      const previous = queryClient.getQueryData<Parcel[]>(['parcels', 'all'])

      // Optimistically update the cache
      if (previous) {
        const idToOrder = new Map(orderedIds.map((id, i) => [id, i]))
        const updated = previous.map((p) =>
          idToOrder.has(p.id)
            ? { ...p, route_order: idToOrder.get(p.id)! }
            : p
        )
        updated.sort((a, b) => a.route_order - b.route_order)
        queryClient.setQueryData(['parcels', 'all'], updated)
      }

      return { previous }
    },
    onError: (_err, _ids, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['parcels', 'all'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
    },
  })
}

// Transfer parcels to another driver (admin) — adds "L" label
export function useTransferParcels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      parcelIds,
      targetDriverId,
    }: {
      parcelIds: string[]
      targetDriverId: string
    }) => {
      // Get current parcels to preserve existing labels
      const { data: currentParcels, error: fetchErr } = await supabase
        .from('parcels')
        .select('id, labels')
        .in('id', parcelIds)

      if (fetchErr) throw fetchErr

      const updates = (currentParcels || []).map((p) => {
        const newLabels = p.labels?.includes('L')
          ? p.labels
          : [...(p.labels || []), 'L']
        return supabase
          .from('parcels')
          .update({ driver_id: targetDriverId, labels: newLabels })
          .eq('id', p.id)
      })

      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
    },
  })
}

// ADMIN: edit parcel details (fix mistakes)
export function useUpdateParcel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      parcelId,
      updates,
    }: {
      parcelId: string
      updates: {
        sender_details?: { name: string; phone: string; address: string }
        receiver_details?: { name: string; phone: string; address: string }
        content_description?: string | null
        weight?: number
        price?: number
      }
    }) => {
      const { error } = await supabase
        .from('parcels')
        .update(updates)
        .eq('id', parcelId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
    },
  })
}

// ADMIN: archived parcels (grouped by week)
export function useArchivedParcels() {
  return useQuery({
    queryKey: ['parcels', 'archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('is_archived', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      const parcels = data as Parcel[]
      const photoPaths = parcels.map((p) => p.photo_url).filter(Boolean) as string[]
      if (photoPaths.length > 0) prefetchPhotoUrls(photoPaths)
      return parcels
    },
  })
}

// ADMIN: sterge un colet
export function useDeleteParcel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (parcelId: string) => {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('id', parcelId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
    },
  })
}

// Marcheaza colet ca livrat + feedback client
export function useMarkDelivered(_driverId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      parcelId,
      clientSatisfied,
      deliveryNote,
    }: {
      parcelId: string
      clientSatisfied: boolean
      deliveryNote?: string
    }) => {
      const { error } = await supabase
        .from('parcels')
        .update({
          status: 'delivered',
          client_satisfied: clientSatisfied,
          delivery_note: deliveryNote || null,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', parcelId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
    },
  })
}
