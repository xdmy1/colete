import { useState } from 'react'
import type { NewParcelData, ContactDetails } from '../../lib/types'
import type { DestinationCode } from '../../lib/utils'
import StepDestination from './StepDestination'
import StepDetails from './StepDetails'
import StepPhoto from './StepPhoto'
import StepConfirm from './StepConfirm'

interface AddParcelWizardProps {
  onComplete: (data: NewParcelData) => void
  onCancel: () => void
  isSubmitting: boolean
}

const emptyContact: ContactDetails = { name: '', phone: '', address: '' }

export default function AddParcelWizard({
  onComplete,
  onCancel,
  isSubmitting,
}: AddParcelWizardProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<NewParcelData>({
    origin_code: 'MD',
    delivery_destination: 'UK',
    sender_details: { ...emptyContact },
    receiver_details: { ...emptyContact },
    content_description: '',
    appearance: 'box',
    weight: 0,
    photo: null,
  })

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
    appearance: 'box' | 'bag' | 'envelope' | 'other'
    weight: number
  }) {
    updateData(details)
    setStep(3)
  }

  function handlePhotoComplete(photo: File) {
    updateData({ photo })
    setStep(4)
  }

  function handleConfirm() {
    onComplete(data)
  }

  return (
    <div className="flex flex-col min-h-screen bg-soft-bg">
      {/* Progress bar */}
      <div className="bg-white border-b border-card-border px-4 py-3 sticky top-0 z-30">
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
          <span className="text-xs font-medium text-slate-400">
            Pas {step} din {totalSteps}
          </span>
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
          <StepDestination onSelect={handleDestinationSelect} />
        )}
        {step === 2 && (
          <StepDetails
            originCode={data.origin_code}
            deliveryDestination={data.delivery_destination}
            onComplete={handleDetailsComplete}
            initialData={data}
          />
        )}
        {step === 3 && <StepPhoto onComplete={handlePhotoComplete} />}
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
