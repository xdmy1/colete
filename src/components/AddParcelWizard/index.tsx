import { useState, useEffect } from 'react'
import type { NewParcelData, ContactDetails } from '../../lib/types'
import type { DestinationCode } from '../../lib/utils'
import { getCurrentWeekId, weekIdParts, buildHumanId } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

import StepDestination from './StepDestination'
import StepDetails from './StepDetails'
import StepPhoto from './StepPhoto'
import StepConfirm from './StepConfirm'

interface AddParcelWizardProps {
  onComplete: (data: NewParcelData) => void
  onCancel: () => void
  isSubmitting: boolean
  routes: { origin: DestinationCode; destination: DestinationCode; label: string }[]
  driverId: string
}

const emptyContact: ContactDetails = { name: '', phone: '', address: '' }

export default function AddParcelWizard({
  onComplete,
  onCancel,
  isSubmitting,
  routes,
  driverId,
}: AddParcelWizardProps) {
  const [step, setStep] = useState(1)
  const [previewHumanId, setPreviewHumanId] = useState<string | null>(null)
  const [data, setData] = useState<NewParcelData>({
    origin_code: 'MD',
    delivery_destination: 'UK',
    sender_details: { ...emptyContact },
    receiver_details: { ...emptyContact },
    content_description: '',
    nr_bucati: 1,
    payment_status: 'cod' as const,
    weight: 0,
    photos: [],
  })

  useEffect(() => {
    if (step < 2 || !driverId) return
    setPreviewHumanId(null)

    async function fetchPreview() {
      // 1. Ia range-ul șoferului pentru ruta asta
      const { data: rangeRow } = await supabase
        .from('driver_route_ranges')
        .select('range_start, range_end')
        .eq('driver_id', driverId)
        .eq('origin', data.origin_code)
        .eq('destination', data.delivery_destination)
        .limit(1)
        .single()

      if (!rangeRow) return // șoferul nu are range pentru ruta asta

      const { range_start, range_end } = rangeRow

      // 2. Cel mai mare numeric_id deja folosit în range-ul lui (săptămâna curentă, inclusiv arhivate)
      const weekId = getCurrentWeekId()
      const { data: rows } = await supabase
        .from('parcels')
        .select('numeric_id')
        .eq('driver_id', driverId)
        .eq('week_id', weekId)
        .eq('origin_code', data.origin_code)
        .eq('delivery_destination', data.delivery_destination)
        .gte('numeric_id', range_start)
        .lte('numeric_id', range_end)
        .order('numeric_id', { ascending: false })
        .limit(1)

      const nextNum = rows?.[0]?.numeric_id ? rows[0].numeric_id + 1 : range_start
      setPreviewHumanId(buildHumanId(data.origin_code, data.delivery_destination, nextNum))
    }

    fetchPreview()
  }, [step, data.origin_code, data.delivery_destination, driverId])

  const totalSteps = 4
  const progress = (step / totalSteps) * 100

  function updateData(partial: Partial<NewParcelData>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  function handleDestinationSelect(
    origin: DestinationCode,
    deliveryDest: DestinationCode,
  ) {
    updateData({ origin_code: origin, delivery_destination: deliveryDest })
    setStep(2)
  }

  function handleDetailsComplete(details: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    nr_bucati: number
    payment_status: 'paid' | 'cod' | 'transfer'
    transfer_recipient?: string
    weight: number
    manual_price?: number
    paid_mdl_amount?: number
  }) {
    updateData(details)
    setStep(3)
  }

  function handlePhotosComplete() {
    setStep(4)
  }

  function handleConfirm() {
    onComplete(data)
  }

  return (
    <div className="flex flex-col min-h-screen bg-soft-bg">
      {/* Progress bar */}
      <div className="bg-white border-b border-card-border px-4 py-3 sticky top-0 z-30">
        {(() => { const { label, range } = weekIdParts(getCurrentWeekId()); return (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700">{label}</span>
            <span className="text-xs text-slate-400">{range}</span>
          </div>
        )})()}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={step === 1 ? onCancel : () => setStep(step - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-700 hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          {step > 1 ? (
            <span className="px-4 py-1 rounded-full bg-pill-green-bg border border-pill-green-border text-emerald-800 text-sm font-extrabold tracking-widest">
              {previewHumanId ?? '···'}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400">
              Pas {step} din {totalSteps}
            </span>
          )}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full text-sm font-medium text-slate-400 border border-card-border hover:bg-gray-50 transition-colors"
          >
            Anulează
          </button>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1">
          <div
            className="bg-pill-green-border h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 p-4">
        {step === 1 && (
          <StepDestination onSelect={handleDestinationSelect} routes={routes} />
        )}
        {step === 2 && (
          <StepDetails
            originCode={data.origin_code}
            deliveryDestination={data.delivery_destination}
            onComplete={handleDetailsComplete}
            initialData={data}
          />
        )}
        {step === 3 && (
          <StepPhoto
            photos={data.photos}
            onChange={(photos) => updateData({ photos })}
            onComplete={handlePhotosComplete}
          />
        )}
        {step === 4 && (
          <StepConfirm
            data={data}
            onConfirm={handleConfirm}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  )
}
