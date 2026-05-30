import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Client, ClientAddress, Parcel } from '../lib/types'
import { normalizePhone } from '../lib/utils'

// Lista tuturor clientilor (admin)
export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('client_number', { ascending: true })
      if (error) throw error
      return (data as Client[]) ?? []
    },
    staleTime: 1000 * 30,
  })
}

// Toate adresele (folosit pentru a calcula card-uri si autocomplete)
export function useClientAddresses() {
  return useQuery({
    queryKey: ['client-addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_addresses')
        .select('*')
        .order('last_used_at', { ascending: false })
      if (error) throw error
      return (data as ClientAddress[]) ?? []
    },
    staleTime: 1000 * 30,
  })
}

// Adrese unui client anume
export function useClientAddressesFor(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-addresses', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('client_addresses')
        .select('*')
        .eq('client_id', clientId)
        .order('last_used_at', { ascending: false })
      if (error) throw error
      return (data as ClientAddress[]) ?? []
    },
    enabled: !!clientId,
  })
}

// Coletele unui client (toate, inclusiv arhivate)
export function useClientParcels(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-parcels', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Parcel[]) ?? []
    },
    enabled: !!clientId,
  })
}

// Cauta client dupa cifrele telefonului (autocomplete in wizard)
export function useClientByPhoneDigits(phoneDigits: string) {
  return useQuery({
    queryKey: ['client-by-phone', phoneDigits],
    queryFn: async () => {
      if (!phoneDigits) return null
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_digits', phoneDigits)
        .maybeSingle()
      if (error) throw error
      return data as Client | null
    },
    enabled: phoneDigits.length >= 6,
    staleTime: 1000 * 30,
  })
}

export interface UpsertClientResult {
  client_id: string
  client_address_id: string | null
  client_number: number
}

// Apel RPC: insert/update client + adresa intr-o singura cerere
export function useUpsertClientWithAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      sender_name: string
      sender_phone: string
      recipient_name: string
      recipient_phone: string
      recipient_address: string
      destination_country: string
    }): Promise<UpsertClientResult | null> => {
      // Cere minim 6 cifre la sender ca sa nu populam baza cu prefixe goale
      if (normalizePhone(args.sender_phone).length < 6) return null
      const { data, error } = await supabase.rpc('upsert_client_with_address', {
        p_sender_name: args.sender_name ?? '',
        p_sender_phone: args.sender_phone ?? '',
        p_recipient_name: args.recipient_name ?? '',
        p_recipient_phone: args.recipient_phone ?? '',
        p_recipient_address: args.recipient_address ?? '',
        p_destination_country: args.destination_country,
      })
      if (error) {
        console.error('[upsert_client_with_address] failed:', error)
        throw error
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null
      return {
        client_id: row.client_id,
        client_address_id: row.client_address_id ?? null,
        client_number: row.client_number,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-addresses'] })
      queryClient.invalidateQueries({ queryKey: ['client-by-phone'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clientId,
      updates,
    }: {
      clientId: string
      updates: Partial<Pick<Client, 'name' | 'phone' | 'notes'>>
    }) => {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-by-phone'] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-addresses'] })
      queryClient.invalidateQueries({ queryKey: ['client-parcels'] })
    },
  })
}

export function useDeleteClientAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase
        .from('client_addresses')
        .delete()
        .eq('id', addressId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-addresses'] })
    },
  })
}

export function useUpdateClientAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      addressId,
      updates,
    }: {
      addressId: string
      updates: Partial<
        Pick<
          ClientAddress,
          'recipient_name' | 'recipient_phone' | 'recipient_address' | 'label'
        >
      >
    }) => {
      const { error } = await supabase
        .from('client_addresses')
        .update(updates)
        .eq('id', addressId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-addresses'] })
    },
  })
}
