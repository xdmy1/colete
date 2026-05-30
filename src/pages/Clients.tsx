import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  useClients,
  useClientAddresses,
  useClientParcels,
  useUpdateClient,
  useDeleteClient,
  useDeleteClientAddress,
} from '../hooks/useClients'
import { useAllParcels } from '../hooks/useParcels'
import { useAuth } from '../hooks/useAuth'
import { formatPrice, getDestLabel, normalizePhone } from '../lib/utils'
import type { Client, ClientAddress, Parcel } from '../lib/types'

interface ClientStats {
  parcelCount: number
  gbp: number
  eur: number
  mdl: number
  lastActivity: string | null
}

function aggregateStats(parcels: Parcel[]): ClientStats {
  let gbp = 0
  let eur = 0
  let mdl = 0
  let last: string | null = null
  for (const p of parcels) {
    if (p.record_type === 'collection') continue
    if (p.paid_mdl_amount) {
      mdl += p.paid_mdl_amount
    } else if (p.currency === 'GBP') {
      gbp += p.price
    } else {
      eur += p.price
    }
    if (!last || p.created_at > last) last = p.created_at
  }
  return {
    parcelCount: parcels.filter((p) => p.record_type !== 'collection').length,
    gbp,
    eur,
    mdl,
    lastActivity: last,
  }
}

function formatStats(s: ClientStats): string {
  const parts: string[] = []
  if (s.gbp > 0) parts.push(`£${s.gbp.toFixed(2)}`)
  if (s.eur > 0) parts.push(`€${s.eur.toFixed(2)}`)
  if (s.mdl > 0) parts.push(`${s.mdl.toFixed(0)} MDL`)
  return parts.join(' · ') || '—'
}

export default function Clients() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: addresses = [] } = useClientAddresses()
  const { data: allParcels = [] } = useAllParcels(profile?.excluded_destinations ?? null)

  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  // Mapa client_id -> parcels (toate, inclusiv arhivate — pentru stats)
  // useAllParcels e doar nearhivate. Pentru stats globale tragem o data direct.
  // Aici folosim doar pentru lista; stats per client (inclusiv arhivate) le facem in modal.
  const parcelsByClient = useMemo(() => {
    const m = new Map<string, Parcel[]>()
    for (const p of allParcels) {
      if (!p.client_id) continue
      const list = m.get(p.client_id) || []
      list.push(p)
      m.set(p.client_id, list)
    }
    return m
  }, [allParcels])

  const addressesByClient = useMemo(() => {
    const m = new Map<string, ClientAddress[]>()
    for (const a of addresses) {
      const list = m.get(a.client_id) || []
      list.push(a)
      m.set(a.client_id, list)
    }
    return m
  }, [addresses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    const qDigits = normalizePhone(search)
    return clients.filter(
      (c) =>
        String(c.client_number) === q.replace('#', '') ||
        c.name.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && c.phone_digits.includes(qDigits))
    )
  }, [clients, search])

  return (
    <Layout
      title="Clienți"
      onBack={() => navigate('/')}
      rightAction={
        <span className="text-xs text-slate-400 font-medium">{clients.length}</span>
      }
    >
      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Caută după număr, nume, telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 rounded-full border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loadingClients ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 bg-white border border-card-border rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5V10a4 4 0 00-8 0v10h3M9 7a3 3 0 116 0 3 3 0 01-6 0z" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">
            {search ? 'Niciun client găsit' : 'Niciun client salvat încă'}
          </p>
          {!search && (
            <p className="text-xs text-slate-400 mt-1">
              Clienții apar automat când adaugi colete.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => {
            const stats = aggregateStats(parcelsByClient.get(c.id) || [])
            const addrCount = addressesByClient.get(c.id)?.length ?? 0
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClient(c)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-card-border hover:border-pill-green-border hover:bg-pill-green-bg/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-pill-green-bg border border-pill-green-border flex items-center justify-center">
                    <span className="text-base font-extrabold text-emerald-700">
                      #{c.client_number}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-800 truncate">
                      {c.name || '— fără nume —'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{c.phone}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {addrCount} {addrCount === 1 ? 'destinatar' : 'destinatari'} salvati
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {stats.parcelCount} {stats.parcelCount === 1 ? 'colet' : 'colete'}
                    </p>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5 whitespace-nowrap">
                      {formatStats(stats)}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </Layout>
  )
}

// ===========================================================
// CLIENT DETAIL MODAL
// ===========================================================

function ClientDetailModal({
  client,
  onClose,
}: {
  client: Client
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { data: addresses = [] } = useClientAddresses()
  const { data: parcels = [] } = useClientParcels(client.id)
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()
  const deleteAddress = useDeleteClientAddress()

  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState(client.name)
  const [phone, setPhone] = useState(client.phone)
  const [notes, setNotes] = useState(client.notes || '')

  const clientAddresses = addresses
    .filter((a) => a.client_id === client.id)
    .sort((a, b) => (b.last_used_at > a.last_used_at ? 1 : -1))

  const stats = aggregateStats(parcels)

  function sendToAddress(addr: ClientAddress) {
    navigate('/add', {
      state: {
        prefill: {
          client_id: client.id,
          client_address_id: addr.id,
          sender: {
            name: client.name,
            phone: client.phone,
            address: '',
          },
          receiver: {
            name: addr.recipient_name,
            phone: addr.recipient_phone,
            address: addr.recipient_address,
          },
          delivery_destination: addr.destination_country,
        },
      },
    })
  }

  async function handleSave() {
    await updateClient.mutateAsync({
      clientId: client.id,
      updates: {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || null,
      },
    })
    setEditMode(false)
  }

  async function handleDeleteClient() {
    if (!confirm(`Sigur stergi clientul #${client.client_number}? Coletele raman, doar legatura se rupe.`)) return
    await deleteClient.mutateAsync(client.id)
    onClose()
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto border border-card-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-card-border px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-full bg-pill-green-bg border border-pill-green-border flex items-center justify-center">
              <span className="text-base font-extrabold text-emerald-700">
                #{client.client_number}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-800 truncate">
                {client.name || '— fără nume —'}
              </h2>
              <a
                href={`tel:${client.phone}`}
                className="text-xs font-medium text-blue-500 truncate block"
              >
                {client.phone}
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-600 hover:bg-gray-50 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Stats */}
          <div className="rounded-2xl border border-card-border bg-pill-green-bg/30 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-extrabold text-slate-800">{stats.parcelCount}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">
                  Colete
                </p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-slate-800">{clientAddresses.length}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">
                  Destinatari
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-700 mt-1">{formatStats(stats)}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">
                  Total cheltuit
                </p>
              </div>
            </div>
            {stats.lastActivity && (
              <p className="text-[11px] text-slate-400 text-center mt-2 border-t border-card-border pt-2">
                Ultima activitate:{' '}
                {new Date(stats.lastActivity).toLocaleDateString('ro-RO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Edit / View client info */}
          {editMode ? (
            <div className="rounded-2xl border border-card-border p-4 space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Editare client
              </h3>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nume"
              />
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefon"
              />
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notă internă (optional)"
              />
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 py-2.5 rounded-full border border-card-border text-slate-500 font-semibold text-sm hover:bg-gray-50"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateClient.isPending}
                  className="flex-1 py-2.5 rounded-full bg-pill-green-bg text-emerald-800 font-bold border border-pill-green-border text-sm disabled:opacity-50"
                >
                  {updateClient.isPending ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setName(client.name)
                  setPhone(client.phone)
                  setNotes(client.notes || '')
                  setEditMode(true)
                }}
                className="px-4 py-2 rounded-full border border-card-border text-slate-600 text-sm font-semibold hover:bg-gray-50"
              >
                Editează
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleteClient.isPending}
                className="px-4 py-2 rounded-full border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                Șterge client
              </button>
              {client.notes && (
                <span className="px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                  {client.notes}
                </span>
              )}
            </div>
          )}

          {/* Destinatari salvati */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Destinatari salvati ({clientAddresses.length})
            </h3>
            {clientAddresses.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Niciun destinatar salvat. Adaugă un colet pentru acest client si va apărea aici.
              </p>
            ) : (
              <div className="space-y-2">
                {clientAddresses.map((a) => (
                  <AddressCard
                    key={a.id}
                    address={a}
                    onSend={() => sendToAddress(a)}
                    onDelete={async () => {
                      if (!confirm(`Stergi destinatarul ${a.recipient_name || a.recipient_phone}?`)) return
                      await deleteAddress.mutateAsync(a.id)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Istoric colete */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Istoric colete ({parcels.length})
            </h3>
            {parcels.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Niciun colet inca.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {parcels.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-card-border bg-white px-3 py-2 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{p.human_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-slate-500 font-medium border border-card-border">
                          {getDestLabel(p.origin_code)} → {getDestLabel(p.delivery_destination)}
                        </span>
                        {p.status === 'delivered' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pill-green-bg text-emerald-700 font-bold border border-pill-green-border">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pill-orange-bg text-amber-700 font-bold border border-pill-orange-border">
                            pending
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {p.receiver_details.name} · {new Date(p.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 whitespace-nowrap ml-2">
                      {formatPrice(p.price, p.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddressCard({
  address,
  onSend,
  onDelete,
}: {
  address: ClientAddress
  onSend: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-white p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800 truncate">
              {address.recipient_name || '— fără nume —'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-200">
              → {getDestLabel(address.destination_country)}
            </span>
            {address.usage_count > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">
                ×{address.usage_count}
              </span>
            )}
          </div>
          {address.recipient_phone && (
            <a
              href={`tel:${address.recipient_phone}`}
              className="text-xs text-blue-500 font-medium block mt-0.5"
            >
              {address.recipient_phone}
            </a>
          )}
          {address.recipient_address && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
              {address.recipient_address}
            </p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="shrink-0 w-7 h-7 rounded-full border border-card-border text-slate-300 hover:text-red-500 hover:border-red-200 flex items-center justify-center"
          aria-label="Sterge destinatar"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        onClick={onSend}
        className="w-full py-2.5 rounded-full bg-pill-green-bg text-emerald-800 text-sm font-bold border border-pill-green-border hover:bg-emerald-100 transition-colors"
      >
        Trimite aici →
      </button>
    </div>
  )
}
