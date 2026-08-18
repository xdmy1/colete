// ── Destination types & prefixes ──

export type DestinationCode = 'UK' | 'BE' | 'NL' | 'MD' | 'DE'

export const DESTINATIONS = [
  { code: 'UK' as DestinationCode, label: 'Anglia', shortLabel: 'A' },
  { code: 'BE' as DestinationCode, label: 'Belgia', shortLabel: 'B' },
  { code: 'NL' as DestinationCode, label: 'Olanda', shortLabel: 'OL' },
  { code: 'MD' as DestinationCode, label: 'Moldova', shortLabel: 'MD' },
  { code: 'DE' as DestinationCode, label: 'Germania', shortLabel: 'D' },
]

export const PHONE_PREFIX: Record<DestinationCode, string> = {
  MD: '+373 ',
  UK: '+44 ',
  BE: '+32 ',
  NL: '+31 ',
  DE: '+49 ',
}

// Toate rutele posibile — butoane directe, fara ambiguitate
export const ROUTES: { origin: DestinationCode; destination: DestinationCode; label: string }[] = [
  { origin: 'MD', destination: 'UK', label: 'Moldova → Anglia' },
  { origin: 'MD', destination: 'BE', label: 'Moldova → Belgia' },
  { origin: 'MD', destination: 'NL', label: 'Moldova → Olanda' },
  { origin: 'MD', destination: 'DE', label: 'Moldova → Germania' },
  { origin: 'UK', destination: 'MD', label: 'Anglia → Moldova' },
  { origin: 'BE', destination: 'MD', label: 'Belgia → Moldova' },
  { origin: 'NL', destination: 'MD', label: 'Olanda → Moldova' },
  { origin: 'DE', destination: 'MD', label: 'Germania → Moldova' },
]

export function getDestLabel(code: string) {
  return DESTINATIONS.find((d) => d.code === code)?.label || code
}

// Human ID: prefixul depinde de DESTINATIA FINALA unde se livreaza
// UK → N     (doar numarul)
// BE → BN    (B + numar)
// NL → OLN   (OL + numar)
// MD → N     (doar numarul)
// Prefixul se bazeaza pe tara "straina" (non-MD) din ruta,
// indiferent daca e origine sau destinatie
export function buildHumanId(
  originCode: DestinationCode,
  deliveryDestination: DestinationCode,
  numericId: number
): string {
  const foreignCountry = deliveryDestination !== 'MD' ? deliveryDestination : originCode
  switch (foreignCountry) {
    case 'BE': return `B${numericId}`
    case 'NL': return `OL${numericId}`
    case 'DE': return `D${numericId}`
    default:   return `${numericId}`
  }
}

// ── Sortare colete: grupat pe SERIE (rută), apoi crescător după număr ──
// Fiecare serie își are propria numerotare (B=Belgia, OL=Olanda, D=Germania,
// număr simplu=Anglia/Moldova) și numerele se suprapun între serii (B2 și OL2 au
// ambele numeric_id=2). Grupăm întâi pe seria dată de țara străină din rută (prefixul
// vizibil al human_id), apoi ordonăm crescător după numeric_id în interiorul seriei:
// B2, B3, B100, B102 / OL1, OL2 ...
// NU folosim route_order aici: la coletele reatribuite de la alt șofer route_order
// rămâne 0 / valoarea veche, ceea ce amestecă lista.
const SERIES_ORDER: DestinationCode[] = ['UK', 'BE', 'NL', 'DE', 'MD']

type SortableParcel = {
  origin_code: string
  delivery_destination: string
  numeric_id: number
  created_at: string
}

export function parcelSeries(p: { origin_code: string; delivery_destination: string }): string {
  return p.delivery_destination !== 'MD' ? p.delivery_destination : p.origin_code
}

export function compareBySeriesThenNumber(a: SortableParcel, b: SortableParcel): number {
  const sa = parcelSeries(a)
  const sb = parcelSeries(b)
  if (sa !== sb) {
    const ra = SERIES_ORDER.indexOf(sa as DestinationCode)
    const rb = SERIES_ORDER.indexOf(sb as DestinationCode)
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb)
  }
  if (a.numeric_id !== b.numeric_id) return a.numeric_id - b.numeric_id
  return a.created_at.localeCompare(b.created_at)
}

// ── Price calculation ──
// UK routes: £1.5/kg  |  altele: €1.5/kg

export function calculatePrice(weightKg: number, _origin: DestinationCode, _destination: DestinationCode): number {
  const rate = 1.5
  return Math.round(weightKg * rate * 100) / 100
}

export function getCurrency(origin: DestinationCode, destination: DestinationCode): 'GBP' | 'EUR' {
  return origin === 'UK' || destination === 'UK' ? 'GBP' : 'EUR'
}

export function formatPrice(price: number, currency: 'GBP' | 'EUR'): string {
  return currency === 'GBP' ? `£${price.toFixed(2)}` : `€${price.toFixed(2)}`
}

// ── Week ID ──

export function getCurrentWeekId(): string {
  const now = new Date()
  // ISO 8601 week number: copy date, set to nearest Thursday
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7 // luni=1 ... duminica=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // cel mai apropiat joi
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function weekIdToMonday(weekId: string): Date | null {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1])
  const week = parseInt(match[2])
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  return monday
}

// "2026-W12" → { label: "Săptămâna 12 · 2026", range: "17 Mar – 23 Mar" }
export function weekIdParts(weekId: string): { label: string; range: string } {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return { label: weekId, range: '' }
  const year = match[1]
  const week = parseInt(match[2])
  const monday = weekIdToMonday(weekId)
  if (!monday) return { label: weekId, range: '' }
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fmt = (d: Date) => `${d.getDate()} ${months[d.getMonth()]}`
  return {
    label: `Săptămâna ${week} · ${year}`,
    range: `${fmt(monday)} – ${fmt(sunday)}`,
  }
}

// Backward compat
export function weekIdToDateRange(weekId: string): string {
  const { label, range } = weekIdParts(weekId)
  return range ? `${label} (${range})` : label
}

// Filtru "Adăugat": data = potrivire exactă pe zi (timezone local), ora = de la HH:MM încolo (în ziua aceea)
// Pastreaza doar cifrele dintr-un nr de telefon (scoate +, spatii, paranteze, etc.)
// Folosit pt cautare: "+44 7479 398828", "07479398828" si "44 7479-398828" matchuiesc la fel.
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D+/g, '')
}

// Cifrele numarului FARA codul de tara. Valoarea e stocata ca "{cod} {numar}"
// (ex: "+373 60123456"), deci luam ce e dupa primul spatiu. Daca nu exista spatiu
// (numar lipit / vechi), scoatem prefixul cunoscut de la inceput daca se potriveste.
export function phoneNationalDigits(
  phone: string | null | undefined,
  prefix?: string
): string {
  const value = (phone ?? '').trim()
  const idx = value.indexOf(' ')
  if (idx >= 0) return normalizePhone(value.slice(idx + 1))
  const all = normalizePhone(value)
  const code = normalizePhone(prefix)
  return code && all.startsWith(code) ? all.slice(code.length) : all
}

// Minim de cifre ca sa consideram un numar completat (fara codul de tara).
// Nu exista numar real mai scurt de atat — prinde campurile lasate doar cu prefix.
export const MIN_PHONE_DIGITS = 5

export function hasPhoneNumber(phone: string | null | undefined, prefix?: string): boolean {
  return phoneNationalDigits(phone, prefix).length >= MIN_PHONE_DIGITS
}

// Numarul de rezerva (al doilea telefon): pastreaza-l doar daca are cifre,
// altfel intoarce undefined ca sa nu salvam un prefix gol (ex: "+44 ").
export function cleanPhone2(phone2: string | undefined): string | undefined {
  if (phone2 === undefined) return undefined
  return phoneNationalDigits(phone2).length > 0 ? phone2.trim() : undefined
}

export function matchesAddedDateTime(createdAt: string, dateFilter: string, timeFilter: string): boolean {
  if (!dateFilter && !timeFilter) return true
  const d = new Date(createdAt)
  if (dateFilter) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    if (`${yyyy}-${mm}-${dd}` !== dateFilter) return false
  }
  if (timeFilter) {
    const [fh, fm] = timeFilter.split(':').map(Number)
    if (d.getHours() * 60 + d.getMinutes() < fh * 60 + fm) return false
  }
  return true
}
