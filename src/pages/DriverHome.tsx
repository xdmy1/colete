import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  useDriverParcels,
  useMarkDelivered,
} from '../hooks/useParcels'
import { formatPrice, getDestLabel } from '../lib/utils'
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
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSatisfied, setFeedbackSatisfied] = useState<boolean | null>(
    null
  )
  const [feedbackNote, setFeedbackNote] = useState('')

  const activeParcels = parcels?.filter((p) => p.status === 'pending') || []
  const deliveredParcels =
    parcels?.filter((p) => p.status === 'delivered') || []

  function handleMarkDelivered() {
    setShowFeedback(true)
  }

  async function submitDelivery() {
    if (!selectedParcel || feedbackSatisfied === null) return

    await markDelivered.mutateAsync({
      parcelId: selectedParcel.id,
      clientSatisfied: feedbackSatisfied,
      deliveryNote: feedbackNote || undefined,
    })

    setSelectedParcel(null)
    setShowFeedback(false)
    setFeedbackSatisfied(null)
    setFeedbackNote('')
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
          {/* Quick stats */}
          <div className="flex gap-3 mb-5">
            <div className="flex-1 bg-pill-orange-bg border border-pill-orange-border rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-amber-700">{activeParcels.length}</p>
              <p className="text-xs font-semibold text-amber-600/70 uppercase tracking-wide">Active</p>
            </div>
            <div className="flex-1 bg-pill-green-bg border border-pill-green-border rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-emerald-700">{deliveredParcels.length}</p>
              <p className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wide">Livrate</p>
            </div>
          </div>

          {/* Active parcels */}
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

          {/* Delivered parcels */}
          {deliveredParcels.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
                Livrate ({deliveredParcels.length})
              </h2>
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
          onClose={() => setSelectedParcel(null)}
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

          {/* Row 4: Weight + Price */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium text-slate-400">
              {parcel.weight} kg
            </span>
            <span className="text-sm font-bold text-emerald-700">
              {formatPrice(parcel.price, parcel.currency)}
            </span>
          </div>
        </button>

        {/* Phone call button */}
        <a
          href={`tel:${parcel.receiver_details.phone}`}
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-center w-14 transition-colors border-l ${
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
  onClose,
  onMarkDelivered,
}: {
  parcel: Parcel
  onClose: () => void
  onMarkDelivered?: () => void
}) {
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
        <ParcelPhoto photoPath={parcel.photo_url} className="w-full max-h-72 object-cover" />

        {/* Content */}
        <div className="p-5 space-y-4">
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
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Aspect</p>
              <p className="text-base font-bold text-slate-800">
                {parcel.appearance === 'box'
                  ? 'Cutie'
                  : parcel.appearance === 'bag'
                    ? 'Sac'
                    : parcel.appearance === 'envelope'
                      ? 'Plic'
                      : 'Altul'}
              </p>
            </div>
          </div>

          {parcel.content_description && (
            <div className="bg-pill-orange-bg rounded-2xl p-3.5 border border-pill-orange-border">
              <p className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Conținut</p>
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
          {onMarkDelivered && (
            <button
              onClick={onMarkDelivered}
              className="w-full py-4 bg-pill-green-bg text-emerald-800 text-lg font-bold rounded-full border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
            >
              Marchează ca Livrat
            </button>
          )}

          {parcel.status === 'delivered' && (
            <div className="text-center py-3 text-emerald-700 font-bold text-base bg-pill-green-bg/50 rounded-full border border-pill-green-border">
              Livrat
              {parcel.delivered_at &&
                ` — ${new Date(parcel.delivered_at).toLocaleDateString('ro-RO')}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
