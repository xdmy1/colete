import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  useDriverParcels,
  useMarkDelivered,
  useUpdateParcel,
} from '../hooks/useParcels'
import { formatPrice, getDestLabel, calculatePrice } from '../lib/utils'
import type { Parcel } from '../lib/types'
import Layout from '../components/Layout'
import ParcelPhoto from '../components/ParcelPhoto'

// ── Phone icon SVG ──
function PhoneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z" />
    </svg>
  )
}

export default function DriverHome() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const { data: parcels, isLoading } = useDriverParcels(profile?.id)
  const markDelivered = useMarkDelivered(profile?.id || '')
  const updateParcel = useUpdateParcel()
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSatisfied, setFeedbackSatisfied] = useState<boolean | null>(
    null
  )
  const [feedbackNote, setFeedbackNote] = useState('')
  const [cashCollected, setCashCollected] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'cod' | 'transfer'>('all')
  const [routeFilter, setRouteFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered'>('all')
  const [search, setSearch] = useState('')

  const allActive = parcels?.filter((p) => p.status === 'pending') || []
  const allDelivered = parcels?.filter((p) => p.status === 'delivered') || []

  // Rute unice din toate coletele
  const uniqueRoutes = Array.from(
    new Map((parcels || []).map(p => [`${p.origin_code}-${p.delivery_destination}`, { origin: p.origin_code, destination: p.delivery_destination }])).values()
  )
  const hasMultipleRoutes = uniqueRoutes.length > 1

  function applyFilters(list: Parcel[], includePayment = false) {
    let result = list
    if (routeFilter !== 'all')
      result = result.filter(p => `${p.origin_code}-${p.delivery_destination}` === routeFilter)
    if (includePayment && paymentFilter !== 'all')
      result = result.filter(p =>
        paymentFilter === 'paid' ? p.payment_status === 'paid' :
        paymentFilter === 'transfer' ? p.payment_status === 'transfer' :
        (p.payment_status === 'cod' || !p.payment_status)
      )
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(p =>
        p.human_id.toLowerCase().includes(q) ||
        p.receiver_details.name.toLowerCase().includes(q) ||
        p.sender_details.name.toLowerCase().includes(q) ||
        p.receiver_details.phone.includes(q) ||
        p.receiver_details.address.toLowerCase().includes(q)
      )
    }
    return result
  }

  const activeParcels = applyFilters(allActive, true)
  const deliveredParcels = applyFilters(allDelivered)

  function handleMarkDelivered() {
    setShowFeedback(true)
  }

  async function submitDelivery() {
    if (!selectedParcel || feedbackSatisfied === null) return

    await markDelivered.mutateAsync({
      parcelId: selectedParcel.id,
      clientSatisfied: feedbackSatisfied,
      deliveryNote: feedbackNote || undefined,
      cashCollected,
    })

    setSelectedParcel(null)
    setShowFeedback(false)
    setFeedbackSatisfied(null)
    setFeedbackNote('')
    setCashCollected(false)
  }

  return (
    <Layout
      title={profile?.username || 'Colete'}
      rightAction={
        <button
          onClick={logout}
          className="px-4 py-1.5 rounded-full text-sm font-medium text-slate-400 border border-card-border hover:text-slate-600 hover:bg-gray-50 transition-colors"
        >
          Ieși
        </button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Quick stats — clickabile ca filtre */}
          <div className="flex gap-3 mb-5">
            <button
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className={`flex-1 rounded-2xl px-4 py-3 text-center transition-all border ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 border-amber-500'
                  : 'bg-pill-orange-bg border-pill-orange-border'
              }`}
            >
              <p className={`text-2xl font-extrabold ${statusFilter === 'pending' ? 'text-white' : 'text-amber-700'}`}>{allActive.length}</p>
              <p className={`text-xs font-semibold uppercase tracking-wide ${statusFilter === 'pending' ? 'text-white/80' : 'text-amber-600/70'}`}>De livrat</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
              className={`flex-1 rounded-2xl px-4 py-3 text-center transition-all border ${
                statusFilter === 'delivered'
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-pill-green-bg border-pill-green-border'
              }`}
            >
              <p className={`text-2xl font-extrabold ${statusFilter === 'delivered' ? 'text-white' : 'text-emerald-700'}`}>{allDelivered.length}</p>
              <p className={`text-xs font-semibold uppercase tracking-wide ${statusFilter === 'delivered' ? 'text-white/80' : 'text-emerald-600/70'}`}>Livrate</p>
            </button>
          </div>

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

          {/* Route filter — doar daca sunt mai multe rute */}
          {hasMultipleRoutes && (
            <div className="flex gap-2 mb-3 flex-wrap">
              <button
                onClick={() => setRouteFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  routeFilter === 'all'
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'bg-white border-card-border text-slate-400 hover:border-slate-300'
                }`}
              >
                Toate
              </button>
              {uniqueRoutes.map(r => {
                const key = `${r.origin}-${r.destination}`
                return (
                  <button
                    key={key}
                    onClick={() => setRouteFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      routeFilter === key
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-card-border text-slate-400 hover:border-blue-300'
                    }`}
                  >
                    {getDestLabel(r.origin)} → {getDestLabel(r.destination)}
                  </button>
                )
              })}
            </div>
          )}

          {/* Payment filter — doar pentru sectiunea activa */}
          {statusFilter !== 'delivered' && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {(['all', 'paid', 'cod', 'transfer'] as const).map((f) => {
                const base = applyFilters(allActive)
                const count = f === 'all' ? base.length
                  : f === 'paid' ? base.filter(p => p.payment_status === 'paid').length
                  : f === 'transfer' ? base.filter(p => p.payment_status === 'transfer').length
                  : base.filter(p => p.payment_status === 'cod' || !p.payment_status).length
                const label = f === 'all' ? 'Toate' : f === 'paid' ? 'Achitat' : f === 'transfer' ? 'Transfer' : 'La livrare'
                const activeStyle = f === 'paid' ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : f === 'transfer' ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : f === 'cod' ? 'bg-red-50 border-red-400 text-red-600'
                  : 'bg-slate-800 border-slate-800 text-white'
                return (
                  <button
                    key={f}
                    onClick={() => setPaymentFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      paymentFilter === f ? activeStyle : 'bg-white border-card-border text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Active parcels */}
          {statusFilter !== 'delivered' && (
            <section className="mb-6">
              {activeParcels.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white border border-card-border rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-slate-400 font-medium">Niciun colet activ</p>
                  <p className="text-slate-300 text-sm mt-1">Apasă + pentru a adăuga</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeParcels.map((parcel) => (
                    <ParcelCard
                      key={parcel.id}
                      parcel={parcel}
                      onClick={() => setSelectedParcel(parcel)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Delivered parcels */}
          {statusFilter !== 'pending' && deliveredParcels.length > 0 && (
            <section>
              {statusFilter === 'all' && (
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
                  Livrate ({deliveredParcels.length})
                </h2>
              )}
              <div className="space-y-3">
                {deliveredParcels.map((parcel) => (
                  <ParcelCard
                    key={parcel.id}
                    parcel={parcel}
                    onClick={() => setSelectedParcel(parcel)}
                  />
                ))}
              </div>
            </section>
          )}

          {statusFilter !== 'pending' && statusFilter !== 'all' && deliveredParcels.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-white border border-card-border rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">Niciun colet livrat</p>
            </div>
          )}
        </>
      )}

      {/* FAB - Add parcel button */}
      <button
        onClick={() => navigate('/add')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white text-emerald-600 rounded-full border border-card-border hover:bg-pill-green-bg hover:border-pill-green-border active:scale-95 transition-all flex items-center justify-center z-20 shadow-sm"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Detail Modal */}
      {selectedParcel && !showFeedback && (
        <ParcelDetailModal
          parcel={selectedParcel}
          editMode={editMode}
          onClose={() => { setSelectedParcel(null); setEditMode(false) }}
          onEdit={() => setEditMode(true)}
          onSave={async (updates) => {
            await updateParcel.mutateAsync({ parcelId: selectedParcel.id, updates })
            setEditMode(false)
            setSelectedParcel(null)
          }}
          isSaving={updateParcel.isPending}
          onMarkDelivered={
            selectedParcel.status === 'pending'
              ? handleMarkDelivered
              : undefined
          }
        />
      )}

      {/* Feedback Modal */}
      {showFeedback && selectedParcel && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl border border-card-border p-6 space-y-5">
            <h3 className="text-xl font-bold text-slate-800 text-center">
              Clientul e mulțumit?
            </h3>

            <div className="flex gap-4">
              <button
                onClick={() => setFeedbackSatisfied(true)}
                className={`flex-1 py-5 rounded-2xl text-xl font-bold border transition-all ${
                  feedbackSatisfied === true
                    ? 'border-pill-green-border bg-pill-green-bg text-emerald-700'
                    : 'border-card-border text-slate-500 hover:border-pill-green-border'
                }`}
              >
                Da
              </button>
              <button
                onClick={() => setFeedbackSatisfied(false)}
                className={`flex-1 py-5 rounded-2xl text-xl font-bold border transition-all ${
                  feedbackSatisfied === false
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-card-border text-slate-500 hover:border-red-300'
                }`}
              >
                Nu
              </button>
            </div>

            {selectedParcel.payment_status === 'cod' && (
              <label className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-card-border cursor-pointer select-none hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={cashCollected}
                  onChange={(e) => setCashCollected(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
                <span className="text-base font-semibold text-slate-700">
                  S-a achitat — <span className="text-emerald-700">{formatPrice(selectedParcel.price, selectedParcel.currency)}</span>
                </span>
              </label>
            )}

            <textarea
              placeholder="Notă opțională..."
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-card-border bg-white text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border resize-none transition-colors"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFeedback(false)
                  setFeedbackSatisfied(null)
                  setFeedbackNote('')
                }}
                className="flex-1 py-3.5 rounded-full border border-card-border text-slate-500 font-semibold hover:bg-gray-50 text-base transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={submitDelivery}
                disabled={
                  feedbackSatisfied === null || markDelivered.isPending
                }
                className="flex-1 py-3.5 rounded-full bg-pill-green-bg text-emerald-800 font-bold border border-pill-green-border hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-base transition-colors"
              >
                {markDelivered.isPending ? 'Se salvează...' : 'Confirmă'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ── ParcelCard ──
function ParcelCard({
  parcel,
  onClick,
}: {
  parcel: Parcel
  onClick: () => void
}) {
  const isDelivered = parcel.status === 'delivered'
  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all ${
        isDelivered
          ? 'bg-pill-green-bg/50 border border-pill-green-border/60'
          : 'bg-white border border-card-border'
      }`}
    >
      <div className="flex items-stretch">
        {/* Type indicator strip */}
        <div
          className={`w-1 shrink-0 ${
            isDelivered
              ? 'bg-emerald-400'
              : 'bg-amber-400'
          }`}
        />

        {/* Main content — clickable */}
        <button
          onClick={onClick}
          className="flex-1 text-left px-4 py-3.5 min-w-0"
        >
          {/* Row 1: ID + Route + Label */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg font-extrabold text-slate-800">
              {parcel.human_id}
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gray-50 text-slate-500 font-medium border border-card-border">
              {getDestLabel(parcel.origin_code)} → {getDestLabel(parcel.delivery_destination)}
            </span>
            {parcel.labels.filter(l => l !== 'COLET' && l !== 'LIVRARE').length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[11px] font-bold border border-violet-200">
                {parcel.labels.filter(l => l !== 'COLET' && l !== 'LIVRARE').join(', ')}
              </span>
            )}
          </div>

          {/* Row 2: Receiver name */}
          <p className="text-base font-bold text-slate-700 truncate">
            {parcel.receiver_details.name}
          </p>

          {/* Row 3: Address */}
          <p className="text-sm text-slate-400 truncate mt-0.5">
            {parcel.receiver_details.address}
          </p>

          {/* Row 4: Weight + Price + Payment */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium text-slate-400">
              {parcel.weight} kg
            </span>
            <span className="text-sm font-bold text-emerald-700">
              {formatPrice(parcel.price, parcel.currency)}
            </span>
            {(parcel.payment_status === 'paid' || parcel.cash_collected) ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-300">
                Achitat
              </span>
            ) : parcel.payment_status === 'cod' ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold border border-red-300">
                La livrare
              </span>
            ) : parcel.payment_status === 'transfer' ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-300">
                Transfer
              </span>
            ) : null}
          </div>
        </button>

        {/* Waze navigation button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parcel.receiver_details.address)}`, '_blank')
          }}
          className={`flex items-center justify-center w-12 transition-colors border-l ${
            isDelivered
              ? 'border-pill-green-border/60 bg-blue-50/60 text-blue-400 hover:bg-blue-50 active:bg-blue-100'
              : 'border-card-border bg-blue-50/40 text-blue-400 hover:bg-blue-50 active:bg-blue-100'
          }`}
          aria-label={`Navigare la ${parcel.receiver_details.address}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </button>

        {/* Phone call button */}
        <a
          href={`tel:${parcel.receiver_details.phone}`}
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-center w-12 transition-colors border-l ${
            isDelivered
              ? 'border-pill-green-border/60 bg-pill-green-bg/60 text-emerald-500 hover:bg-pill-green-bg active:bg-emerald-100'
              : 'border-card-border bg-pill-green-bg/40 text-emerald-500 hover:bg-pill-green-bg active:bg-emerald-100'
          }`}
          aria-label={`Sună ${parcel.receiver_details.phone}`}
        >
          <PhoneIcon className="w-5 h-5" />
        </a>
      </div>
    </div>
  )
}

// ── Detail Modal ──
function ParcelDetailModal({
  parcel,
  editMode,
  onClose,
  onEdit,
  onSave,
  isSaving,
  onMarkDelivered,
}: {
  parcel: Parcel
  editMode: boolean
  onClose: () => void
  onEdit: () => void
  onSave: (updates: {
    sender_details?: { name: string; phone: string; address: string }
    receiver_details?: { name: string; phone: string; address: string }
    content_description?: string | null
    weight?: number
    price?: number
  }) => void
  isSaving: boolean
  onMarkDelivered?: () => void
}) {
  const [senderName, setSenderName] = useState(parcel.sender_details.name)
  const [senderPhone, setSenderPhone] = useState(parcel.sender_details.phone)
  const [senderAddress, setSenderAddress] = useState(parcel.sender_details.address)
  const [receiverName, setReceiverName] = useState(parcel.receiver_details.name)
  const [receiverPhone, setReceiverPhone] = useState(parcel.receiver_details.phone)
  const [receiverAddress, setReceiverAddress] = useState(parcel.receiver_details.address)
  const [contentDesc, setContentDesc] = useState(parcel.content_description || '')
  const [weight, setWeight] = useState(parcel.weight)

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  function handleSave() {
    onSave({
      sender_details: { name: senderName, phone: senderPhone, address: senderAddress },
      receiver_details: { name: receiverName, phone: receiverPhone, address: receiverAddress },
      content_description: contentDesc || null,
      weight,
      price: calculatePrice(weight),
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-card-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 flex justify-between items-center border-b border-card-border z-10 rounded-t-3xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl font-extrabold text-slate-800">
              {parcel.human_id}
            </span>
            <span className="px-3 py-1 rounded-full bg-gray-50 text-slate-500 text-sm font-medium whitespace-nowrap border border-card-border">
              {getDestLabel(parcel.origin_code)} →{' '}
              {getDestLabel(parcel.delivery_destination)}
            </span>
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

        {/* Photo */}
        <ParcelPhoto photoPaths={parcel.photo_urls?.length ? parcel.photo_urls : parcel.photo_url ? [parcel.photo_url] : []} className="w-full max-h-72 object-cover" />

        {/* Content */}
        <div className="p-5 space-y-4">
          {editMode ? (
            <>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expeditor</h3>
              <input className={inputCls} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Nume expeditor" />
              <input className={inputCls} value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="Telefon expeditor" />
              <input className={inputCls} value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="Adresă expeditor" />

              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Destinatar</h3>
              <input className={inputCls} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nume destinatar" />
              <input className={inputCls} value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="Telefon destinatar" />
              <input className={inputCls} value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} placeholder="Adresă destinatar" />

              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Detalii colet</h3>
              <input className={inputCls} value={contentDesc} onChange={(e) => setContentDesc(e.target.value)} placeholder="Descriere conținut" />
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-medium">Greutate (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className={inputCls}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Preț recalculat: {formatPrice(calculatePrice(weight), parcel.currency)}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-full border border-card-border text-slate-500 font-semibold hover:bg-gray-50 text-sm transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-full bg-pill-green-bg text-emerald-800 font-bold border border-pill-green-border hover:bg-emerald-100 disabled:opacity-50 text-sm transition-colors"
                >
                  {isSaving ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Destinatar */}
              <div className="rounded-2xl p-4 border border-card-border">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Destinatar
                </p>
                <p className="text-xl font-extrabold text-slate-800 mb-1">
                  {parcel.receiver_details.name}
                </p>
                <p className="text-sm text-slate-500 mb-3">
                  {parcel.receiver_details.address}
                </p>
                <a
                  href={`tel:${parcel.receiver_details.phone}`}
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-pill-green-bg text-emerald-700 font-bold text-base border border-pill-green-border active:bg-emerald-100 transition-colors"
                >
                  <PhoneIcon className="w-5 h-5" />
                  {parcel.receiver_details.phone}
                </a>
              </div>

              {/* Expeditor */}
              <div className="rounded-2xl p-4 border border-card-border">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Expeditor
                </p>
                <p className="text-lg font-bold text-slate-800 mb-1">
                  {parcel.sender_details.name}
                </p>
                <a
                  href={`tel:${parcel.sender_details.phone}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm border border-blue-200 active:bg-blue-100 transition-colors"
                >
                  <PhoneIcon className="w-4 h-4" />
                  {parcel.sender_details.phone}
                </a>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-2xl p-3 text-center border border-card-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Greutate</p>
                  <p className="text-lg font-extrabold text-slate-800">{parcel.weight} kg</p>
                </div>
                <div className="rounded-2xl p-3 text-center border border-card-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Preț</p>
                  <p className="text-lg font-extrabold text-emerald-700">
                    {formatPrice(parcel.price, parcel.currency)}
                  </p>
                </div>
                <div className="rounded-2xl p-3 text-center border border-card-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Bucăți</p>
                  <p className="text-base font-bold text-slate-800">{parcel.nr_bucati ?? 1}</p>
                </div>
              </div>

              {parcel.content_description && (
                <div className="bg-pill-orange-bg rounded-2xl p-3.5 border border-pill-orange-border">
                  <p className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Aspect</p>
                  <p className="text-sm text-slate-700">{parcel.content_description}</p>
                </div>
              )}

              {parcel.labels.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {parcel.labels.map((label) => (
                    <span
                      key={label}
                      className="px-3.5 py-1 rounded-full bg-violet-50 text-violet-600 text-sm font-bold border border-violet-200"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {parcel.delivery_note && (
                <div className="rounded-2xl p-3.5 border border-card-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Notă livrare</p>
                  <p className="text-sm text-slate-700">{parcel.delivery_note}</p>
                </div>
              )}

              {parcel.client_satisfied !== null && (
                <div
                  className={`rounded-2xl p-3.5 border ${parcel.client_satisfied ? 'bg-pill-green-bg/50 border-pill-green-border' : 'bg-red-50 border-red-200'}`}
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Client mulțumit?</p>
                  <p
                    className={`text-base font-bold ${parcel.client_satisfied ? 'text-emerald-700' : 'text-red-600'}`}
                  >
                    {parcel.client_satisfied ? 'Da' : 'Nu'}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {parcel.status === 'pending' && (
                  <button
                    onClick={onEdit}
                    className="flex-1 py-3.5 rounded-full border border-card-border text-slate-600 font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors text-base"
                  >
                    Editează
                  </button>
                )}
                {onMarkDelivered && (
                  <button
                    onClick={onMarkDelivered}
                    className="flex-1 py-4 bg-pill-green-bg text-emerald-800 text-lg font-bold rounded-full border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
                  >
                    Marchează ca Livrat
                  </button>
                )}
              </div>

              {parcel.status === 'delivered' && (
                <div className="text-center py-3 text-emerald-700 font-bold text-base bg-pill-green-bg/50 rounded-full border border-pill-green-border">
                  Livrat
                  {parcel.delivered_at &&
                    ` — ${new Date(parcel.delivered_at).toLocaleDateString('ro-RO')}`}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
