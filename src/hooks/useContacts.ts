import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ContactDetails } from '../lib/types'

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcels')
        .select('sender_details, receiver_details')

      if (error) throw error

      // Collect all contacts, dedup by phone
      const byPhone = new Map<string, ContactDetails>()

      for (const row of data || []) {
        const sender = row.sender_details as ContactDetails
        const receiver = row.receiver_details as ContactDetails

        if (sender?.phone?.trim()) {
          byPhone.set(sender.phone.trim(), {
            name: sender.name || '',
            phone: sender.phone.trim(),
            address: sender.address || '',
          })
        }
        if (receiver?.phone?.trim()) {
          byPhone.set(receiver.phone.trim(), {
            name: receiver.name || '',
            phone: receiver.phone.trim(),
            address: receiver.address || '',
          })
        }
      }

      return Array.from(byPhone.values())
        .filter((c) => c.name.trim())
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    staleTime: 1000 * 60 * 5,
  })
}
