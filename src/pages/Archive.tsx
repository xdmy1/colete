import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArchivedParcels, useAllDrivers, useUpdateParcel } from '../hooks/useParcels'
import { useAuth } from '../hooks/useAuth'
import { formatPrice, getDestLabel, weekIdParts, ROUTES, normalizePhone } from '../lib/utils'
import { exportParcelsToExcel } from '../lib/exportExcel'
import { backdropClose } from '../lib/backdropClose'
import type { Parcel } from '../lib/types'
import Layout from '../components/Layout'
import ParcelPhoto from '../components/ParcelPhoto'
import AddPhotos from '../components/AddPhotos'

export default function Archive() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: parcels, isLoading } = useArchivedParcels(profile?.excluded_destinations)
  const { data: drivers } = useAllDrivers()

  const [driverFilter, setDriverFilter] = useState<string | 'all'>('all')
  const [weekFilter, setWeekFilter] = useState<string | 'all'>('all')
  const [routeFilter, setRouteFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'cod' | 'transfer'>('all')
  const [search, setSearch] = useState('')
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const weeks = useMemo(() => {
    if (!parcels) return []
    const weekSet = new Set(parcels.map((p) => p.week_id))
    return Array.from(weekSet).sort().reverse()
  }, [parcels])

  const filtered = useMemo(() => {
    let result = parcels || []
    if (driverFilter !== 'all') {
      result = result.filter((p) => p.driver_id === driverFilter)
    }
    if (weekFilter !== 'all') {
      result = result.filter((p) => p.week_id === weekFilter)
    }
    if (routeFilter !== 'all') {
      const [origin, dest] = routeFilter.split('-')
      result = result.filter((p) => p.origin_code === origin && p.delivery_destination === dest)
    }
    if (paymentFilter !== 'all') {
      result = result.filter((p) =>
        paymentFilter === 'paid' ? p.payment_status === 'paid' :
        paymentFilter === 'transfer' ? p.payment_status === 'transfer' :
        (p.payment_status === 'cod' || !p.payment_status)
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      const qDigits = normalizePhone(search)
      result = result.filter((p) =>
        p.human_id.toLowerCase().includes(q) ||
        p.receiver_details.name.toLowerCase().includes(q) ||
        p.sender_details.name.toLowerCase().includes(q) ||
        (qDigits.length > 0 && (
          normalizePhone(p.receiver_details.phone).includes(qDigits) ||
          normalizePhone(p.sender_details.phone).includes(qDigits)
        )) ||
        p.receiver_details.address.toLowerCase().includes(q)
      )
    }
    return result
  }, [parcels, driverFilter, weekFilter, routeFilter, paymentFilter, search])

  function getDriverName(driverId: string) {
    return drivers?.find((d) => d.id === driverId)?.username || 'Necunoscut'
  }

  async function handleExport() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const weekLabel = weekFilter !== 'all' ? `_${weekFilter}` : ''
      const driverLabel = driverFilter !== 'all' ? `_${getDriverName(driverFilter)}` : ''
      const sorted = [...filtered].sort((a, b) => a.numeric_id - b.numeric_id)
      await exportParcelsToExcel(
        sorted,
        getDriverName,
        `arhiva${driverLabel}${weekLabel}.xlsx`,
        false // fara poze
      )
    } finally {
      setIsExporting(false)
    }
  }

  const groupedByWeek = useMemo(() => {
    const map = new Map<string, Parcel[]>()
    for (const p of filtered) {
      const existing = map.get(p.week_id) || []
      existing.push(p)
      map.set(p.week_id, existing)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  return (
    <Layout title="Arhivă" onBack={() => navigate('/')}>
      {/* Search */}
      <div className="mb-3 relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Caută după nume, telefon, adresă, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 rounded-full border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-all"
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

      {/* Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toți șoferii</option>
          {drivers?.filter(d => d.role === 'driver').map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.username}
            </option>
          ))}
        </select>

        <select
          value={weekFilter}
          onChange={(e) => setWeekFilter(e.target.value)}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toate săptămânile</option>
          {weeks.map((w) => {
            const { label, range } = weekIdParts(w)
            return <option key={w} value={w}>{label} ({range})</option>
          })}
        </select>

        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toate rutele</option>
          {ROUTES.map((r) => (
            <option key={`${r.origin}-${r.destination}`} value={`${r.origin}-${r.destination}`}>
              {r.label}
            </option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'paid' | 'cod' | 'transfer')}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toate plățile</option>
          <option value="paid">Achitat</option>
          <option value="cod">La livrare</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>

      <div className="flex items-center justify-between mb-4 px-0.5">
        <p className="text-xs text-slate-400 font-medium">
          {filtered.length} colete arhivate
        </p>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="text-xs font-semibold text-blue-500 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? 'Se exportă...' : `Excel (${filtered.length})`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groupedByWeek.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 bg-white border border-card-border rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">Nicio arhivă găsită</p>
        </div>
      ) : (
        groupedByWeek.map(([weekId, weekParcels]) => (
          <section key={weekId} className="mb-6">
            <div className="flex items-baseline gap-2 mb-2.5 px-0.5">
              <h2 className="text-base font-extrabold text-slate-800">
                {weekIdParts(weekId).label}
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {weekIdParts(weekId).range}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                {weekParcels.length} colete
              </span>
            </div>
            <div className="space-y-2.5">
              {weekParcels.map((parcel) => (
                <button
                  key={parcel.id}
                  onClick={() => setSelectedParcel(parcel)}
                  className="w-full text-left p-4 rounded-2xl bg-white border border-card-border hover:border-pill-green-border/60 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-lg font-extrabold text-slate-800">
                        {parcel.human_id}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-slate-500 font-medium border border-card-border">
                        {getDestLabel(parcel.origin_code)} → {getDestLabel(parcel.delivery_destination)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium border border-blue-200">
                        {getDriverName(parcel.driver_id)}
                      </span>
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ml-2 ${parcel.weight <= 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {formatPrice(parcel.price, parcel.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-slate-700 truncate">
                        {parcel.receiver_details.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {parcel.receiver_details.address}
                      </p>
                    </div>
                    {parcel.delivered_at && (
                      <span className="text-[10px] text-slate-400 ml-3 whitespace-nowrap">
                        {new Date(parcel.delivered_at).toLocaleDateString('ro-RO')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Detail modal */}
      {selectedParcel && (
        <ArchiveParcelModal
          parcel={selectedParcel}
          driverName={getDriverName(selectedParcel.driver_id)}
          onClose={() => setSelectedParcel(null)}
        />
      )}
    </Layout>
  )
}

function paymentLabel(status: Parcel['payment_status']) {
  if (status === 'paid') return 'Achitat'
  if (status === 'transfer') return 'Transfer'
  return 'La livrare'
}

// Modal arhivă: vizualizare + editare sumă / metodă de plată / poze noi
function ArchiveParcelModal({
  parcel,
  driverName,
  onClose,
}: {
  parcel: Parcel
  driverName: string
  onClose: () => void
}) {
  const updateParcel = useUpdateParcel()
  const [editMode, setEditMode] = useState(false)
  const [price, setPrice] = useState(parcel.price)
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'cod' | 'transfer'>(parcel.payment_status)
  const [transferRecipient, setTransferRecipient] = useState(parcel.transfer_recipient || '')
  const [newPhotos, setNewPhotos] = useState<File[]>([])

  const existingPhotoCount = parcel.photo_urls?.length || (parcel.photo_url ? 1 : 0)
  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  async function handleSave() {
    await updateParcel.mutateAsync({
      parcel,
      updates: {
        price,
        payment_status: paymentStatus,
        transfer_recipient: paymentStatus === 'transfer' ? transferRecipient || null : null,
      },
      newPhotos,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      {...backdropClose(onClose)}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto border border-card-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-card-border px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">{parcel.human_id}</h2>
            <p className="text-xs text-slate-400 font-medium">
              {getDestLabel(parcel.origin_code)} → {getDestLabel(parcel.delivery_destination)} · {driverName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {(parcel.photo_urls?.length || parcel.photo_url) && (
            <div className="rounded-2xl overflow-hidden border border-card-border">
              <ParcelPhoto photoPaths={parcel.photo_urls?.length ? parcel.photo_urls : parcel.photo_url ? [parcel.photo_url] : []} className="w-full max-h-48 object-cover" />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-pill-green-bg text-emerald-700 text-xs font-bold border border-pill-green-border">
              Livrat
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">
              {paymentLabel(parcel.payment_status)}
            </span>
            <span className={`text-base font-bold ml-auto ${parcel.weight <= 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {formatPrice(parcel.price, parcel.currency)}
            </span>
          </div>

          {editMode ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-medium">Sumă ({parcel.currency})</label>
                <input type="number" step="0.01" min="0" className={inputCls} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-medium">Metodă de plată</label>
                <select className={inputCls} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'paid' | 'cod' | 'transfer')}>
                  <option value="cod">Achitare la livrare (COD)</option>
                  <option value="paid">Achitat</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              {paymentStatus === 'transfer' && (
                <input className={inputCls} value={transferRecipient} onChange={(e) => setTransferRecipient(e.target.value)} placeholder="Beneficiar transfer" />
              )}

              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">
                Poze {existingPhotoCount > 0 && `(${existingPhotoCount} existente)`}
              </h3>
              <AddPhotos files={newPhotos} onChange={setNewPhotos} />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 py-3 rounded-full border border-card-border text-slate-500 font-semibold hover:bg-gray-50 text-sm transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateParcel.isPending}
                  className="flex-1 py-3 rounded-full bg-pill-green-bg text-emerald-800 font-bold border border-pill-green-border hover:bg-emerald-100 disabled:opacity-50 text-sm transition-colors"
                >
                  {updateParcel.isPending ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expeditor</h3>
                <p className="text-base font-bold text-slate-800">{parcel.sender_details.name}</p>
                <p className="text-xs text-slate-400">{parcel.sender_details.phone}</p>
                {parcel.sender_details.phone2?.trim() && (
                  <p className="text-xs text-slate-400">{parcel.sender_details.phone2} <span className="text-slate-300">· rezervă</span></p>
                )}
                <p className="text-xs text-slate-400">{parcel.sender_details.address}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destinatar</h3>
                <p className="text-base font-bold text-slate-800">{parcel.receiver_details.name}</p>
                <p className="text-xs text-slate-400">{parcel.receiver_details.phone}</p>
                {parcel.receiver_details.phone2?.trim() && (
                  <p className="text-xs text-slate-400">{parcel.receiver_details.phone2} <span className="text-slate-300">· rezervă</span></p>
                )}
                <p className="text-xs text-slate-400">{parcel.receiver_details.address}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalii</h3>
                {parcel.content_description && (
                  <p className="text-xs text-slate-500">Conținut: {parcel.content_description}</p>
                )}
                {parcel.weight <= 0 ? (
                  <p className="text-xs font-bold text-amber-600">Greutate: ⚠ necântărit</p>
                ) : (
                  <p className="text-xs text-slate-500">Greutate: {parcel.weight} kg</p>
                )}
                {parcel.receiver_details.price_note && (
                  <p className="text-xs font-bold text-violet-600">Motiv preț: {parcel.receiver_details.price_note}</p>
                )}
              </div>

              {parcel.delivered_at && (
                <div className="bg-pill-green-bg/50 rounded-2xl p-4 space-y-1.5 border border-pill-green-border">
                  <h3 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Livrare</h3>
                  <p className="text-xs text-slate-500">
                    Livrat: {new Date(parcel.delivered_at).toLocaleString('ro-RO')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Client mulțumit: {parcel.client_satisfied === null ? '—' : parcel.client_satisfied ? 'Da' : 'Nu'}
                  </p>
                  {parcel.delivery_note && (
                    <p className="text-xs text-slate-500">Notă: {parcel.delivery_note}</p>
                  )}
                </div>
              )}

              <button
                onClick={() => setEditMode(true)}
                className="w-full py-3 rounded-full bg-slate-800 text-white font-bold text-sm border border-slate-800 hover:bg-slate-700 transition-colors"
              >
                Editează
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
