import { useState, useRef, useEffect } from 'react'
import type { ContactDetails } from '../../lib/types'
import type { DestinationCode } from '../../lib/utils'
import { calcAutoPrice, getCurrency, formatPrice, PHONE_PREFIX, HOME_DELIVERY_FEE, normalizePhone, phoneNationalDigits, cleanPhone2, hasPhoneNumber } from '../../lib/utils'
import { useContacts } from '../../hooks/useContacts'
import { useClientByPhoneDigits } from '../../hooks/useClients'
import Button from '../ui/Button'
import MultiPhoneInput from '../ui/MultiPhoneInput'
import CityInput from '../ui/CityInput'

interface StepDetailsProps {
  originCode: DestinationCode
  deliveryDestination: DestinationCode
  onComplete: (details: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    nr_bucati: number
    payment_status: 'paid' | 'cod' | 'transfer'
    transfer_recipient?: string
    weight: number
    manual_price?: number
    price_note?: string
    paid_mdl_amount?: number
  }) => void
  initialData: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    nr_bucati: number
    payment_status: 'paid' | 'cod' | 'transfer'
    transfer_recipient?: string
    weight: number
    manual_price?: number
    price_note?: string
    paid_mdl_amount?: number
  }
}

function capitalizeWords(value: string): string {
  return value.toUpperCase()
}

// Autocomplete pe TELEFON — cautarea in baza de clienti se face DOAR dupa
// numarul de telefon (nu dupa nume, nu dupa adresa). Cand soferul tasteaza
// cifre, propunem contactele al caror numar contine cifrele tastate.
function PhoneContactAutocomplete({
  placeholder,
  prefix,
  phone,
  phone2,
  onPhoneChange,
  onPhone2Change,
  contacts,
  onSelectContact,
}: {
  placeholder: string
  prefix: string
  phone: string
  phone2: string | undefined
  onPhoneChange: (next: string) => void
  onPhone2Change: (next: string | undefined) => void
  contacts: ContactDetails[]
  onSelectContact: (contact: ContactDetails) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const queryDigits = phoneNationalDigits(phone)
  const suggestions = open && queryDigits.length >= 3
    ? contacts.filter((c) => normalizePhone(c.phone).includes(queryDigits)).slice(0, 6)
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
      <MultiPhoneInput
        placeholder={placeholder}
        prefix={prefix}
        phone={phone}
        phone2={phone2}
        onPhoneChange={(next) => {
          onPhoneChange(next)
          setOpen(true)
        }}
        onPhone2Change={onPhone2Change}
      />
      {suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-card-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((contact, i) => (
            <button
              key={contact.phone + i}
              type="button"
              // onMouseDown ca selectia sa castige inaintea blur-ului
              onMouseDown={(e) => {
                e.preventDefault()
                onSelectContact(contact)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-pill-green-bg/50 transition-colors border-b border-card-border last:border-b-0"
            >
              <span className="text-sm font-bold text-slate-800">{contact.phone}</span>
              <span className="text-xs font-semibold text-slate-500 ml-2">{contact.name}</span>
              {(contact.city || contact.address) && (
                <p className="text-xs text-slate-400 truncate">
                  {[contact.city, contact.address].filter(Boolean).join(', ')}
                </p>
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
  const [nrBucati, setNrBucati] = useState(initialData.nr_bucati || 1)
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'cod' | 'transfer'>(initialData.payment_status || 'cod')
  const [transferRecipient, setTransferRecipient] = useState(initialData.transfer_recipient || '')
  const [mdlAmount, setMdlAmount] = useState(initialData.paid_mdl_amount ? String(initialData.paid_mdl_amount) : '')
  const [weight, setWeight] = useState(initialData.weight || 0)
  const [priceAuto, setPriceAuto] = useState(initialData.manual_price === undefined)
  const [manualPrice, setManualPrice] = useState(initialData.manual_price ?? 0)
  const [priceNote, setPriceNote] = useState(initialData.price_note ?? '')
  const [homeDelivery, setHomeDelivery] = useState(!!initialData.receiver_details.home_delivery)
  const [showPriceNoteModal, setShowPriceNoteModal] = useState(false)
  const [priceNoteDraft, setPriceNoteDraft] = useState('')
  const [locLoading, setLocLoading] = useState(false)

  const { data: contacts = [] } = useContacts()
  const senderDigits = normalizePhone(sender.phone)
  const { data: matchedClient } = useClientByPhoneDigits(senderDigits)

  const currency = getCurrency(originCode, deliveryDestination)
  const autoPrice = calcAutoPrice(weight, originCode, deliveryDestination, homeDelivery)
  const displayPrice = priceAuto ? autoPrice : manualPrice
  const notWeighed = weight <= 0

  // Livrarea la domiciliu exista doar pentru coletele care VIN spre Moldova
  const canHomeDelivery = deliveryDestination === 'MD'

  // Telefonul trebuie sa aiba cifre, nu doar prefixul (ex: "+373 " singur nu e valid)
  const senderPhoneOk = hasPhoneNumber(sender.phone, PHONE_PREFIX[originCode])
  const receiverPhoneOk = hasPhoneNumber(receiver.phone, PHONE_PREFIX[deliveryDestination])

  // Ori oras, ori adresa — nu ambele obligatorii. Doar la livrare la domiciliu
  // adresa e obligatorie (acolo chiar se livreaza la usa).
  const hasCityOrAddress = !!(receiver.city ?? '').trim() || !!receiver.address.trim()

  const missing = [
    !receiverPhoneOk && 'telefon destinatar',
    !receiver.name.trim() && 'nume destinatar',
    !hasCityOrAddress && 'oraș sau adresă destinatar',
    homeDelivery && !receiver.address.trim() && 'adresă livrare domiciliu',
    !senderPhoneOk && 'telefon expeditor',
    !sender.name.trim() && 'nume expeditor',
    !priceAuto && !priceNote.trim() && 'motivul prețului modificat',
  ].filter(Boolean) as string[]

  const isValid = missing.length === 0

  // Scoate numarul de rezerva daca a ramas gol (doar prefix / fara cifre)
  function cleanContact(c: ContactDetails): ContactDetails {
    return { ...c, phone2: cleanPhone2(c.phone2), city: c.city?.trim() || undefined }
  }

  function handleSubmit() {
    if (!isValid) return
    const parsedMdl = mdlAmount ? parseFloat(mdlAmount) : undefined
    onComplete({
      sender_details: cleanContact(sender),
      receiver_details: {
        ...cleanContact(receiver),
        home_delivery: canHomeDelivery && homeDelivery ? true : undefined,
      },
      content_description: contentDesc,
      nr_bucati: nrBucati,
      payment_status: paymentStatus,
      transfer_recipient: paymentStatus === 'transfer' ? transferRecipient : undefined,
      weight,
      manual_price: priceAuto ? undefined : manualPrice,
      price_note: priceAuto ? undefined : priceNote.trim() || undefined,
      paid_mdl_amount: parsedMdl && parsedMdl > 0 ? parsedMdl : undefined,
    })
  }

  async function fillLocation() {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ro`,
            { headers: { 'User-Agent': 'colete-app' } }
          )
          const json = await res.json()
          const a = json.address || {}
          const parts = [
            a.road || a.pedestrian || a.footway,
            a.house_number,
            a.village || a.town || a.city || a.municipality,
            a.county,
            a.country,
          ].filter(Boolean)
          const address = parts.length > 0 ? parts.join(', ') : json.display_name
          setSender((s) => ({ ...s, address }))
        } catch {
          // fallback: doar coordonate
          setSender((s) => ({ ...s, address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` }))
        } finally {
          setLocLoading(false)
        }
      },
      () => setLocLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Detalii Colet</h2>

      {/* Destinatar — telefonul PRIMUL, cautarea in baza doar dupa numar */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Destinatar
        </legend>
        <div>
          <PhoneContactAutocomplete
            placeholder="Telefon destinatar *"
            prefix={PHONE_PREFIX[deliveryDestination]}
            phone={receiver.phone}
            phone2={receiver.phone2}
            onPhoneChange={(next) => setReceiver({ ...receiver, phone: next })}
            onPhone2Change={(next) => setReceiver({ ...receiver, phone2: next })}
            contacts={contacts}
            onSelectContact={(c) =>
              setReceiver({
                ...receiver,
                name: capitalizeWords(c.name),
                phone: c.phone,
                address: c.address,
                city: c.city ?? receiver.city,
              })
            }
          />
          <p className="text-[11px] text-slate-400 mt-0.5 ml-1">fără 0 la început · caută clientul după număr</p>
        </div>
        <input
          type="text"
          placeholder="Nume destinatar *"
          value={receiver.name}
          onChange={(e) => setReceiver({ ...receiver, name: capitalizeWords(e.target.value) })}
          className={inputCls}
        />
        <CityInput
          country={deliveryDestination}
          value={receiver.city ?? ''}
          onChange={(city) => setReceiver({ ...receiver, city })}
          placeholder="Oraș destinatar (oraș sau adresă) *"
          inputCls={inputCls}
        />
        {canHomeDelivery && (
          <button
            type="button"
            onClick={() => setHomeDelivery(!homeDelivery)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border font-bold text-sm transition-all ${
              homeDelivery
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                : 'border-card-border text-slate-500 hover:border-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
              </svg>
              Livrare la domiciliu
            </span>
            <span className={homeDelivery ? 'text-emerald-700' : 'text-slate-400'}>
              +{formatPrice(HOME_DELIVERY_FEE, currency)}
            </span>
          </button>
        )}
        <input
          type="text"
          placeholder={homeDelivery ? 'Adresa livrare la domiciliu *' : 'Adresa destinatar (oraș sau adresă)'}
          value={receiver.address}
          onChange={(e) => setReceiver({ ...receiver, address: e.target.value })}
          className={inputCls}
        />
      </fieldset>

      {/* Expeditor — telefonul PRIMUL */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
          <span>Expeditor</span>
          {matchedClient && (
            <span className="px-2 py-0.5 rounded-full bg-pill-green-bg text-emerald-700 border border-pill-green-border text-[10px] font-bold normal-case tracking-normal">
              Client #{matchedClient.client_number}
              {matchedClient.name ? ` · ${matchedClient.name}` : ''}
            </span>
          )}
        </legend>
        <div>
          <PhoneContactAutocomplete
            placeholder="Telefon expeditor *"
            prefix={PHONE_PREFIX[originCode]}
            phone={sender.phone}
            phone2={sender.phone2}
            onPhoneChange={(next) => setSender({ ...sender, phone: next })}
            onPhone2Change={(next) => setSender({ ...sender, phone2: next })}
            contacts={contacts}
            onSelectContact={(c) =>
              setSender({
                ...sender,
                name: capitalizeWords(c.name),
                phone: c.phone,
                address: c.address,
              })
            }
          />
          <p className="text-[11px] text-slate-400 mt-0.5 ml-1">fără 0 la început · caută clientul după număr</p>
        </div>
        <input
          type="text"
          placeholder="Nume expeditor *"
          value={sender.name}
          onChange={(e) => setSender({ ...sender, name: capitalizeWords(e.target.value) })}
          className={inputCls}
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Adresa expeditor"
            value={sender.address}
            onChange={(e) => setSender({ ...sender, address: e.target.value })}
            className={inputCls}
          />
          <button
            type="button"
            onClick={fillLocation}
            disabled={locLoading}
            title="Folosește locația mea"
            className="flex-shrink-0 w-12 h-12 rounded-xl border border-card-border flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-pill-green-border transition-colors disabled:opacity-50"
          >
            {locLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
              </svg>
            )}
          </button>
        </div>
      </fieldset>

      {/* Aspect (descriere comanda) */}
      <div>
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
          Aspect
        </label>
        <textarea
          placeholder="Descrie coletul (ex: haine, documente)"
          value={contentDesc}
          onChange={(e) => setContentDesc(e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Nr de bucăți */}
      <div>
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
          Nr de bucăți
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNrBucati((n) => Math.max(1, n - 1))}
            className="w-11 h-11 rounded-xl border border-card-border flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-gray-50 active:bg-gray-100 transition-colors select-none"
          >
            −
          </button>
          <span className="text-2xl font-extrabold text-slate-800 min-w-[2.5rem] text-center">
            {nrBucati}
          </span>
          <button
            type="button"
            onClick={() => setNrBucati((n) => n + 1)}
            className="w-11 h-11 rounded-xl border border-card-border flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-gray-50 active:bg-gray-100 transition-colors select-none"
          >
            +
          </button>
          <span className="text-sm text-slate-400 ml-1">buc.</span>
        </div>
      </div>

      {/* Plată */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block">
          Plată
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentStatus('paid')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
              paymentStatus === 'paid'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                : 'border-card-border text-slate-400 hover:border-emerald-300'
            }`}
          >
            ✓ Achitat
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus('cod')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
              paymentStatus === 'cod'
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'border-card-border text-slate-400 hover:border-red-300'
            }`}
          >
            La livrare
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus('transfer')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
              paymentStatus === 'transfer'
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'border-card-border text-slate-400 hover:border-blue-300'
            }`}
          >
            Transfer
          </button>
        </div>
        {paymentStatus === 'transfer' && (
          <input
            type="text"
            placeholder="Cui i s-a făcut transferul? *"
            value={transferRecipient}
            onChange={(e) => setTransferRecipient(e.target.value)}
            className={inputCls}
            autoFocus
          />
        )}
        {paymentStatus !== 'transfer' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">
              Suma în lei MDL — dacă achită în lei
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="ex: 890 lei"
              value={mdlAmount}
              onChange={(e) => setMdlAmount(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Greutate + Preț */}
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
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Preț
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={priceAuto}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Revenire la pret automat — motivul nu mai e relevant
                    setPriceAuto(true)
                    setManualPrice(0)
                    setPriceNote('')
                  } else {
                    // Nu lasam pret manual fara motiv: intai intrebam DE CE
                    setPriceNoteDraft(priceNote)
                    setShowPriceNoteModal(true)
                  }
                }}
                className="w-3.5 h-3.5 accent-emerald-600"
              />
              <span className="text-xs font-semibold text-emerald-700">AUTO</span>
            </label>
          </div>
          {priceAuto ? (
            <div
              className={`w-full px-4 py-3 rounded-xl border text-lg font-semibold ${
                notWeighed
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-pill-green-bg border-pill-green-border text-slate-700'
              }`}
            >
              {formatPrice(displayPrice, currency)}
              {notWeighed && (
                <span className="block text-[11px] font-bold text-amber-600">necântărit — de verificat</span>
              )}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={manualPrice || ''}
              onChange={(e) => setManualPrice(parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          )}
        </div>
      </div>

      {/* Motivul pretului manual — vizibil + editabil cat timp AUTO e scos */}
      {!priceAuto && (
        <button
          type="button"
          onClick={() => {
            setPriceNoteDraft(priceNote)
            setShowPriceNoteModal(true)
          }}
          className="w-full text-left px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors"
        >
          <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wide block">Motiv preț modificat</span>
          <span className="text-sm font-semibold text-violet-700">
            {priceNote.trim() || 'Apasă ca să indici motivul *'}
          </span>
        </button>
      )}

      {missing.length > 0 && (
        <p className="text-xs font-semibold text-red-500 mt-4 -mb-2">
          Lipsește: {missing.join(', ')}
        </p>
      )}

      <Button
        size="lg"
        className="w-full mt-4"
        disabled={!isValid}
        onClick={handleSubmit}
      >
        Continuă → Foto
      </Button>

      {/* Modal: de ce se modifica pretul? */}
      {showPriceNoteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl border border-card-border p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              De ce modifici prețul?
            </h3>
            <p className="text-xs text-slate-400 -mt-2">
              Motivul apare pe colet — nu mai trebuie sunat șoferul (ex: pentru declarația la vamă).
            </p>
            <div className="flex flex-wrap gap-2">
              {['telefon', 'volum', 'monitor / TV', 'laptop'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setPriceNoteDraft((d) => (d.trim() ? `${d.trim()} + ${chip}` : chip))}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              placeholder="ex: telefon +20, volum +20, monitor +50"
              value={priceNoteDraft}
              onChange={(e) => setPriceNoteDraft(e.target.value)}
              rows={3}
              autoFocus
              className={`${inputCls} resize-none`}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  // Renuntare: pretul ramane pe AUTO
                  setShowPriceNoteModal(false)
                  setPriceNoteDraft('')
                }}
                className="flex-1 py-3 rounded-full border border-card-border text-slate-500 font-semibold hover:bg-gray-50 text-sm transition-colors"
              >
                Anulează
              </button>
              <button
                type="button"
                disabled={!priceNoteDraft.trim()}
                onClick={() => {
                  setPriceNote(priceNoteDraft.trim())
                  if (priceAuto) {
                    setPriceAuto(false)
                    setManualPrice(autoPrice)
                  }
                  setShowPriceNoteModal(false)
                }}
                className="flex-1 py-3 rounded-full bg-pill-green-bg text-emerald-800 font-bold border border-pill-green-border hover:bg-emerald-100 disabled:opacity-50 text-sm transition-colors"
              >
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
