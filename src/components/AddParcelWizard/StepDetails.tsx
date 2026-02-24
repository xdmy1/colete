import { useState, useRef, useEffect } from 'react'
import type { ContactDetails } from '../../lib/types'
import type { DestinationCode } from '../../lib/utils'
import { calculatePrice, getCurrency, formatPrice } from '../../lib/utils'
import { useContacts } from '../../hooks/useContacts'
import Button from '../ui/Button'

interface StepDetailsProps {
  originCode: DestinationCode
  deliveryDestination: DestinationCode
  onComplete: (details: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    appearance: 'box' | 'bag' | 'envelope' | 'other'
    weight: number
  }) => void
  initialData: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    weight: number
  }
}

const PHONE_PREFIX: Record<DestinationCode, string> = {
  MD: '+373 ',
  UK: '+44 ',
  BE: '+32 ',
  NL: '+31 ',
}

function ContactAutocomplete({
  placeholder,
  value,
  contacts,
  onChange,
  onSelect,
  inputCls,
  type = 'text',
}: {
  placeholder: string
  value: string
  contacts: ContactDetails[]
  onChange: (val: string) => void
  onSelect: (contact: ContactDetails) => void
  inputCls: string
  type?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const query = value.toLowerCase().trim()
  const suggestions = query.length >= 2
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query)
      ).slice(0, 5)
    : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className={inputCls}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-card-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((contact, i) => (
            <button
              key={contact.phone + i}
              type="button"
              onClick={() => {
                onSelect(contact)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-pill-green-bg/50 transition-colors border-b border-card-border last:border-b-0"
            >
              <span className="text-sm font-semibold text-slate-800">{contact.name}</span>
              <span className="text-xs text-slate-400 ml-2">{contact.phone}</span>
              {contact.address && (
                <p className="text-xs text-slate-400 truncate">{contact.address}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StepDetails({
  originCode,
  deliveryDestination,
  onComplete,
  initialData,
}: StepDetailsProps) {
  const [sender, setSender] = useState<ContactDetails>(() => ({
    ...initialData.sender_details,
    phone: initialData.sender_details.phone || PHONE_PREFIX[originCode],
  }))
  const [receiver, setReceiver] = useState<ContactDetails>(() => ({
    ...initialData.receiver_details,
    phone: initialData.receiver_details.phone || PHONE_PREFIX[deliveryDestination],
  }))
  const [contentDesc, setContentDesc] = useState(initialData.content_description)
  const [weight, setWeight] = useState(initialData.weight || 0)

  const { data: contacts = [] } = useContacts()

  const currency = getCurrency(originCode, deliveryDestination)
  const price = calculatePrice(weight)

  const isValid =
    sender.name.trim() &&
    sender.phone.trim() &&
    receiver.name.trim() &&
    receiver.phone.trim() &&
    receiver.address.trim() &&
    weight > 0

  function handleSubmit() {
    if (!isValid) return
    onComplete({
      sender_details: sender,
      receiver_details: receiver,
      content_description: contentDesc,
      appearance: 'box',
      weight,
    })
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Detalii Colet</h2>

      {/* Expeditor */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Expeditor
        </legend>
        <ContactAutocomplete
          placeholder="Nume expeditor *"
          value={sender.name}
          contacts={contacts}
          onChange={(val) => setSender({ ...sender, name: val })}
          onSelect={(c) => setSender({ name: c.name, phone: c.phone, address: c.address })}
          inputCls={inputCls}
        />
        <input
          type="tel"
          placeholder="Telefon expeditor *"
          value={sender.phone}
          onChange={(e) => setSender({ ...sender, phone: e.target.value })}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Adresa expeditor"
          value={sender.address}
          onChange={(e) => setSender({ ...sender, address: e.target.value })}
          className={inputCls}
        />
      </fieldset>

      {/* Destinatar */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Destinatar
        </legend>
        <ContactAutocomplete
          placeholder="Nume destinatar *"
          value={receiver.name}
          contacts={contacts}
          onChange={(val) => setReceiver({ ...receiver, name: val })}
          onSelect={(c) => setReceiver({ name: c.name, phone: c.phone, address: c.address })}
          inputCls={inputCls}
        />
        <input
          type="tel"
          placeholder="Telefon destinatar *"
          value={receiver.phone}
          onChange={(e) => setReceiver({ ...receiver, phone: e.target.value })}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Adresa destinatar *"
          value={receiver.address}
          onChange={(e) => setReceiver({ ...receiver, address: e.target.value })}
          className={inputCls}
        />
      </fieldset>

      {/* Continut */}
      <div>
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
          Conținut
        </label>
        <input
          type="text"
          placeholder="Descriere conținut (ex: haine, documente)"
          value={contentDesc}
          onChange={(e) => setContentDesc(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Greutate + Pret Auto */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
            Greutate (kg)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="0"
            value={weight || ''}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
            Preț (auto)
          </label>
          <div className="w-full px-4 py-3 rounded-xl bg-pill-green-bg border border-pill-green-border text-lg font-semibold text-slate-700">
            {weight > 0 ? formatPrice(price, currency) : '—'}
          </div>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full mt-4"
        disabled={!isValid}
        onClick={handleSubmit}
      >
        Continuă → Foto
      </Button>
    </div>
  )
}
