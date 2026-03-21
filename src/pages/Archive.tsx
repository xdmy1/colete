import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArchivedParcels, useAllDrivers } from '../hooks/useParcels'
import { formatPrice, getDestLabel, weekIdParts } from '../lib/utils'
import { exportParcelsToExcel } from '../lib/exportExcel'
import type { Parcel } from '../lib/types'
import Layout from '../components/Layout'
import ParcelPhoto from '../components/ParcelPhoto'

export default function Archive() {
  const navigate = useNavigate()
  const { data: parcels, isLoading } = useArchivedParcels()
  const { data: drivers } = useAllDrivers()

  const [driverFilter, setDriverFilter] = useState<string | 'all'>('all')
  const [weekFilter, setWeekFilter] = useState<string | 'all'>('all')
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
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((p) =>
        p.human_id.toLowerCase().includes(q) ||
        p.receiver_details.name.toLowerCase().includes(q) ||
        p.sender_details.name.toLowerCase().includes(q) ||
        p.receiver_details.phone.includes(q) ||
        p.receiver_details.address.toLowerCase().includes(q)
      )
    }
    return result
  }, [parcels, driverFilter, weekFilter, search])

  function getDriverName(driverId: string) {
    return drivers?.find((d) => d.id === driverId)?.username || 'Necunoscut'
  }

  async function handleExport() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const weekLabel = weekFilter !== 'all' ? `_${weekFilter}` : ''
      const driverLabel = driverFilter !== 'all' ? `_${getDriverName(driverFilter)}` : ''
      await exportParcelsToExcel(
        filtered,
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
          {drivers?.map((driver) => (
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
                    <span className="text-sm font-bold text-emerald-700 whitespace-nowrap ml-2">
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
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedParcel(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto border border-card-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-card-border px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">{selectedParcel.human_id}</h2>
                <p className="text-xs text-slate-400 font-medium">
                  {getDestLabel(selectedParcel.origin_code)} → {getDestLabel(selectedParcel.delivery_destination)} · {getDriverName(selectedParcel.driver_id)}
                </p>
              </div>
              <button
                onClick={() => setSelectedParcel(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(selectedParcel.photo_urls?.length || selectedParcel.photo_url) && (
                <div className="rounded-2xl overflow-hidden border border-card-border">
                  <ParcelPhoto photoPaths={selectedParcel.photo_urls?.length ? selectedParcel.photo_urls : selectedParcel.photo_url ? [selectedParcel.photo_url] : []} className="w-full max-h-48 object-cover" />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-pill-green-bg text-emerald-700 text-xs font-bold border border-pill-green-border">
                  Livrat
                </span>
                <span className="text-base font-bold text-emerald-700 ml-auto">
                  {formatPrice(selectedParcel.price, selectedParcel.currency)}
                </span>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expeditor</h3>
                <p className="text-base font-bold text-slate-800">{selectedParcel.sender_details.name}</p>
                <p className="text-xs text-slate-400">{selectedParcel.sender_details.phone}</p>
                <p className="text-xs text-slate-400">{selectedParcel.sender_details.address}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destinatar</h3>
                <p className="text-base font-bold text-slate-800">{selectedParcel.receiver_details.name}</p>
                <p className="text-xs text-slate-400">{selectedParcel.receiver_details.phone}</p>
                <p className="text-xs text-slate-400">{selectedParcel.receiver_details.address}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalii</h3>
                {selectedParcel.content_description && (
                  <p className="text-xs text-slate-500">Conținut: {selectedParcel.content_description}</p>
                )}
                <p className="text-xs text-slate-500">Greutate: {selectedParcel.weight} kg</p>
              </div>

              {selectedParcel.delivered_at && (
                <div className="bg-pill-green-bg/50 rounded-2xl p-4 space-y-1.5 border border-pill-green-border">
                  <h3 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Livrare</h3>
                  <p className="text-xs text-slate-500">
                    Livrat: {new Date(selectedParcel.delivered_at).toLocaleString('ro-RO')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Client mulțumit: {selectedParcel.client_satisfied === null ? '—' : selectedParcel.client_satisfied ? 'Da' : 'Nu'}
                  </p>
                  {selectedParcel.delivery_note && (
                    <p className="text-xs text-slate-500">Notă: {selectedParcel.delivery_note}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
