import type { NewParcelData } from '../../lib/types'
import { getDestLabel, calcAutoPrice, getCurrency, formatPrice } from '../../lib/utils'
import Button from '../ui/Button'

interface StepConfirmProps {
  data: NewParcelData
  onConfirm: () => void
  // Salveaza coletul si incepe imediat altul cu ACELASI expeditor
  // (un expeditor trimite des 2-3 colete la destinatari diferiti)
  onConfirmAndNext: () => void
  isSubmitting: boolean
}

export default function StepConfirm({
  data,
  onConfirm,
  onConfirmAndNext,
  isSubmitting,
}: StepConfirmProps) {
  const currency = getCurrency(data.origin_code, data.delivery_destination)
  const price = data.manual_price ?? calcAutoPrice(data.weight, data.origin_code, data.delivery_destination, data.receiver_details.home_delivery)
  const notWeighed = data.weight <= 0

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Confirmare</h2>
      <p className="text-slate-400">Verifică datele și salvează coletul.</p>

      {/* Photo previews */}
      {data.photos.length > 0 && (
        <div className={`grid gap-2 ${data.photos.length > 1 ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {data.photos.map((photo, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-card-border">
              <img
                src={URL.createObjectURL(photo)}
                alt={`Colet ${i + 1}`}
                className="w-full max-h-48 object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-card-border divide-y divide-card-border">
        <SummaryRow label="Rută" value={`${getDestLabel(data.origin_code)} → ${getDestLabel(data.delivery_destination)}`} />
        <SummaryRow label="Expeditor" value={data.sender_details.name} />
        <SummaryRow label="Tel. Expeditor" value={data.sender_details.phone} />
        {data.sender_details.phone2?.trim() && (
          <SummaryRow label="Tel. rezervă" value={data.sender_details.phone2} />
        )}
        <SummaryRow label="Destinatar" value={data.receiver_details.name} />
        <SummaryRow label="Tel. Destinatar" value={data.receiver_details.phone} />
        {data.receiver_details.phone2?.trim() && (
          <SummaryRow label="Tel. rezervă" value={data.receiver_details.phone2} />
        )}
        {data.receiver_details.city?.trim() && (
          <SummaryRow label="Oraș" value={data.receiver_details.city} />
        )}
        {data.receiver_details.home_delivery && (
          <SummaryRow label="Livrare" value="🏠 La domiciliu" highlight />
        )}
        {data.receiver_details.address.trim() && (
          <SummaryRow label="Adresa" value={data.receiver_details.address} />
        )}
        {data.content_description && (
          <SummaryRow label="Conținut" value={data.content_description} />
        )}
        <SummaryRow label="Nr. bucăți" value={`${data.nr_bucati} buc.`} />
        <SummaryRow
          label="Plată"
          value={data.payment_status === 'paid' ? 'Achitat' : data.payment_status === 'transfer' ? 'Transfer' : 'Achitare la livrare'}
          highlight={data.payment_status === 'cod'}
          red={data.payment_status === 'cod'}
          blue={data.payment_status === 'transfer'}
        />
        {data.payment_status === 'transfer' && data.transfer_recipient && (
          <SummaryRow label="Transfer către" value={data.transfer_recipient} />
        )}
        <SummaryRow
          label="Greutate"
          value={notWeighed ? '⚠ necântărit' : `${data.weight} kg`}
          yellow={notWeighed}
        />
        {data.price_note?.trim() && (
          <SummaryRow label="Motiv preț" value={data.price_note} />
        )}
        <SummaryRow
          label="Preț"
          value={formatPrice(price, currency)}
          highlight
          yellow={notWeighed}
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
      <button
        type="button"
        onClick={onConfirmAndNext}
        disabled={isSubmitting}
        className="w-full py-3.5 rounded-full border-2 border-pill-green-border bg-white text-emerald-700 font-bold text-base hover:bg-pill-green-bg active:bg-emerald-100 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Se salvează...' : '➕ Salvează + alt colet, același expeditor'}
      </button>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  highlight = false,
  red = false,
  blue = false,
  yellow = false,
}: {
  label: string
  value: string
  highlight?: boolean
  red?: boolean
  blue?: boolean
  yellow?: boolean
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={`text-sm font-medium ${
          yellow
            ? 'text-amber-600 font-bold' + (highlight ? ' text-base' : '')
            : red ? 'text-red-600 font-bold' : blue ? 'text-blue-600 font-bold' : highlight ? 'text-emerald-700 text-base font-bold' : 'text-slate-800'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
