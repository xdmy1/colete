import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Parcel, NewParcelData, Profile } from '../lib/types'
import { getParcelAllPhotoPaths, batchPrefetchSignedUrls } from './usePhotoUrl'
import {
  calculatePrice,
  getCurrency,
  buildHumanId,
  getCurrentWeekId,
} from '../lib/utils'

// Coletele active (nearhivate) ale unui sofer
export function useDriverParcels(driverId: string | undefined) {
  const queryClient = useQueryClient()
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
      const photoPaths = parcels.flatMap((p) => p.photo_urls?.length ? p.photo_urls : p.photo_url ? [p.photo_url] : [])
      batchPrefetchSignedUrls(queryClient, photoPaths)
      return parcels
    },
    enabled: !!driverId,
  })
}

// ADMIN: toate coletele active (de la toti soferii)
export function useAllParcels(excludedDestinations?: string[] | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['parcels', 'all', excludedDestinations ?? []],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('is_archived', false)
        .order('route_order', { ascending: true })

      if (error) throw error
      let parcels = data as Parcel[]
      if (excludedDestinations && excludedDestinations.length > 0) {
        parcels = parcels.filter(
          (p) =>
            !excludedDestinations.includes(p.origin_code) &&
            !excludedDestinations.includes(p.delivery_destination)
        )
      }
      const photoPaths = parcels.flatMap((p) => p.photo_urls?.length ? p.photo_urls : p.photo_url ? [p.photo_url] : [])
      batchPrefetchSignedUrls(queryClient, photoPaths)
      return parcels
    },
  })
}

// ADMIN: lista tuturor profilelor (soferi + admini) — folosit si pentru lookup de nume
export function useAllDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true })

      if (error) throw error
      return data as Profile[]
    },
  })
}

// Rutele disponibile ale unui sofer (din driver_route_ranges)
export function useDriverRoutes(driverId: string | undefined) {
  return useQuery({
    queryKey: ['driver-routes', driverId],
    queryFn: async () => {
      if (!driverId) return []
      const { data, error } = await supabase
        .from('driver_route_ranges')
        .select('origin, destination')
        .eq('driver_id', driverId)
      if (error) throw error
      return data as { origin: string; destination: string }[]
    },
    enabled: !!driverId,
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
          p_origin_code: parcelData.origin_code,
          p_delivery_destination: parcelData.delivery_destination,
        }
      )

      if (idError) {
        console.error('[ADD] get_next_numeric_id failed:', idError)
        throw idError
      }

      const numericId = nextId as number
      const humanId = buildHumanId(parcelData.origin_code, parcelData.delivery_destination, numericId)
      const price = parcelData.manual_price ?? calculatePrice(parcelData.weight, parcelData.origin_code, parcelData.delivery_destination)
      const currency = getCurrency(parcelData.origin_code, parcelData.delivery_destination)

      // 2. Upload poze (1-3) — fiecare cu UUID unic ca nume de fisier
      const parcelId = crypto.randomUUID()
      const photoUrls: string[] = []

      for (let i = 0; i < parcelData.photos.length; i++) {
        const photo = parcelData.photos[i]
        const filePath = `${driverId}/${weekId}/${parcelId}_${i + 1}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('parcels')
          .upload(filePath, photo, { upsert: true })

        if (uploadError) {
          console.error('[ADD] photo upload failed:', uploadError)
          throw uploadError
        }

        photoUrls.push(filePath)
      }

      // 3. Insert colet
      const insertData = {
        id: parcelId,
        human_id: humanId,
        numeric_id: numericId,
        driver_id: driverId,
        week_id: weekId,
        origin_code: parcelData.origin_code,
        delivery_destination: parcelData.delivery_destination,
        sender_details: parcelData.sender_details,
        receiver_details: parcelData.receiver_details,
        content_description: parcelData.content_description || null,
        nr_bucati: parcelData.nr_bucati,
        payment_status: parcelData.payment_status,
        transfer_recipient: parcelData.transfer_recipient ?? null,
        weight: parcelData.weight,
        price,
        currency,
        paid_mdl_amount: parcelData.paid_mdl_amount ?? null,
        photo_url: photoUrls[0] ?? null,
        photo_urls: photoUrls,
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
        nr_bucati?: number
        weight?: number
        price?: number
        payment_status?: 'paid' | 'cod' | 'transfer'
        transfer_recipient?: string | null
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
export function useArchivedParcels(excludedDestinations?: string[] | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['parcels', 'archived', excludedDestinations ?? []],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('is_archived', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      let parcels = data as Parcel[]
      if (excludedDestinations && excludedDestinations.length > 0) {
        parcels = parcels.filter(
          (p) =>
            !excludedDestinations.includes(p.origin_code) &&
            !excludedDestinations.includes(p.delivery_destination)
        )
      }
      const photoPaths = parcels.flatMap((p) => p.photo_urls?.length ? p.photo_urls : p.photo_url ? [p.photo_url] : [])
      batchPrefetchSignedUrls(queryClient, photoPaths)
      return parcels
    },
  })
}

// ADMIN: sterge un colet
export function useDeleteParcel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ parcelId, photoUrl, photoUrls }: { parcelId: string; photoUrl?: string | null; photoUrls?: string[] }) => {
      // Sterge TOATE pozele (nou + legacy) din storage
      const allPaths = getParcelAllPhotoPaths({ photo_url: photoUrl, photo_urls: photoUrls })
      if (allPaths.length > 0) {
        await supabase.storage.from('parcels').remove(allPaths)
      }

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
      cashCollected,
      mdlAmount,
      weekId,
    }: {
      parcelId: string
      clientSatisfied: boolean
      deliveryNote?: string
      cashCollected?: boolean
      mdlAmount?: number | null
      weekId?: string
    }) => {
      const shouldArchive = weekId ? weekId < getCurrentWeekId() : false
      const { error } = await supabase
        .from('parcels')
        .update({
          status: 'delivered',
          client_satisfied: clientSatisfied,
          delivery_note: deliveryNote || null,
          cash_collected: cashCollected ?? false,
          paid_mdl_amount: mdlAmount ?? null,
          delivered_at: new Date().toISOString(),
          ...(shouldArchive && { is_archived: true }),
        })
        .eq('id', parcelId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
      queryClient.invalidateQueries({ queryKey: ['cash-report'] })
    },
  })
}

// Marcheaza TOATE coletele (lista de ID-uri) ca livrate dintr-o data
export function useMarkAllDelivered() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (parcelIds: string[]) => {
      const now = new Date().toISOString()
      const currentWeekId = getCurrentWeekId()

      // Fetch payment_status si week_id pentru fiecare colet
      const { data: parcelsData, error: fetchErr } = await supabase
        .from('parcels')
        .select('id, payment_status, week_id')
        .in('id', parcelIds)

      if (fetchErr) throw fetchErr

      const updates = (parcelsData || []).map((p) => {
        const cashCollected = p.payment_status === 'cod' || p.payment_status === 'paid'
        const shouldArchive = p.week_id < currentWeekId
        return supabase
          .from('parcels')
          .update({
            status: 'delivered',
            client_satisfied: true,
            cash_collected: cashCollected,
            delivered_at: now,
            ...(shouldArchive && { is_archived: true }),
          })
          .eq('id', p.id)
      })

      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels'] })
      queryClient.invalidateQueries({ queryKey: ['cash-report'] })
    },
  })
}

// Raport dare de seamă: toate coletele livrate cu cash_collected în săptămâna curentă
export function useDriverCashReport(driverId: string | undefined) {
  return useQuery({
    queryKey: ['cash-report', driverId],
    queryFn: async () => {
      if (!driverId) return []
      const { getCurrentWeekId } = await import('../lib/utils')
      const weekId = getCurrentWeekId()
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('driver_id', driverId)
        .eq('week_id', weekId)
        .eq('cash_collected', true)
        .eq('status', 'delivered')
      if (error) throw error
      return data as import('../lib/types').Parcel[]
    },
    enabled: !!driverId,
  })
}
