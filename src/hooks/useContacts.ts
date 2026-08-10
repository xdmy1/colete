import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ContactDetails } from '../lib/types'
import { normalizePhone } from '../lib/utils'

// Trage toate randurile dintr-un tabel in pagini de 1000 (PostgREST limiteaza
// orice request la 1000 de randuri — fara loop, tot ce trece de prima pagina
// dispare din autocomplete).
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = []
  const page = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + page - 1)
    if (error) throw error
    rows.push(...((data as unknown) as T[]))
    if (!data || data.length < page) break
    from += page
  }
  return rows
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      // Surse: baza de clienti (all-time, globala pentru toti soferii) +
      // destinatarii salvati + cele mai recente colete (pentru adrese la zi).
      const [clients, addresses, recentParcels] = await Promise.all([
        fetchAll<{ name: string; phone: string }>('clients', 'name, phone'),
        fetchAll<{ recipient_name: string; recipient_phone: string; recipient_address: string }>(
          'client_addresses',
          'recipient_name, recipient_phone, recipient_address'
        ),
        supabase
          .from('parcels')
          .select('sender_details, receiver_details, created_at')
          .order('created_at', { ascending: false })
          .limit(1000)
          .then(({ data, error }) => {
            if (error) throw error
            return data ?? []
          }),
      ])

      const byPhone = new Map<string, ContactDetails>()

      function upsert(c: { name?: string; phone?: string; address?: string }) {
        const phone = (c.phone ?? '').trim()
        const digits = normalizePhone(phone)
        // Ignora prefixele goale gen "+32 " ramase in colete vechi
        if (digits.length < 6) return
        const name = (c.name ?? '').trim()
        if (!name) return
        const address = (c.address ?? '').trim()
        const existing = byPhone.get(digits)
        // Nu pierde o adresa deja cunoscuta pentru acelasi numar
        if (existing?.address && !address) {
          byPhone.set(digits, { name, phone, address: existing.address })
        } else {
          byPhone.set(digits, { name, phone, address })
        }
      }

      for (const c of clients) upsert(c)
      for (const a of addresses) {
        upsert({ name: a.recipient_name, phone: a.recipient_phone, address: a.recipient_address })
      }
      // De la vechi la nou, ca datele din coletul cel mai recent sa castige
      for (const row of [...recentParcels].reverse()) {
        const sender = row.sender_details as ContactDetails
        const receiver = row.receiver_details as ContactDetails
        if (sender) upsert(sender)
        if (receiver) upsert(receiver)
      }

      return Array.from(byPhone.values()).sort((a, b) => a.name.localeCompare(b.name))
    },
    staleTime: 1000 * 60 * 5,
  })
}
