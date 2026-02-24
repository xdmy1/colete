import type { NewParcelData } from '../../lib/types'
import { getDestLabel, calculatePrice, getCurrency, formatPrice } from '../../lib/utils'
import Button from '../ui/Button'

interface StepConfirmProps {
  data: NewParcelData
  onConfirm: () => void
  isSubmitting: boolean
}

export default function StepConfirm({
  data,
  onConfirm,
  isSubmitting,
}: StepConfirmProps) {
  const currency = getCurrency(data.origin_code, data.delivery_destination)
  const price = calculatePrice(data.weight)

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Confirmare</h2>
      <p className="text-slate-400">Verifică datele și salvează coletul.</p>

      {/* Photo preview */}
      {data.photo && (
        <div className="rounded-2xl overflow-hidden border border-card-border">
          <img
            src={URL.createObjectURL(data.photo)}
            alt="Colet"
            className="w-full max-h-48 object-cover"
          />
        </div>
      )}

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-card-border divide-y divide-card-border">
        <SummaryRow label="Rută" value={`${getDestLabel(data.origin_code)} → ${getDestLabel(data.delivery_destination)}`} />
        <SummaryRow label="Expeditor" value={data.sender_details.name} />
        <SummaryRow label="Tel. Expeditor" value={data.sender_details.phone} />
        <SummaryRow label="Destinatar" value={data.receiver_details.name} />
        <SummaryRow label="Tel. Destinatar" value={data.receiver_details.phone} />
        <SummaryRow label="Adresa" value={data.receiver_details.address} />
        {data.content_description && (
          <SummaryRow label="Conținut" value={data.content_description} />
        )}
        <SummaryRow label="Greutate" value={`${data.weight} kg`} />
        <SummaryRow
          label="Preț"
          value={formatPrice(price, currency)}
          highlight
        />
      </div>

      <Button
        size="xl"
        className="w-full"
        onClick={onConfirm}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Se salvează...' : 'Salvează Coletul'}
      </Button>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={`text-sm font-medium ${
          highlight ? 'text-emerald-700 text-base font-bold' : 'text-slate-800'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
