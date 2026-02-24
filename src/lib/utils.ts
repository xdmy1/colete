// ── Destination types & prefixes ──

export type DestinationCode = 'UK' | 'BE' | 'NL' | 'MD'

export const DESTINATIONS = [
  { code: 'UK' as DestinationCode, label: 'Anglia', shortLabel: 'A' },
  { code: 'BE' as DestinationCode, label: 'Belgia', shortLabel: 'B' },
  { code: 'NL' as DestinationCode, label: 'Olanda', shortLabel: 'OL' },
  { code: 'MD' as DestinationCode, label: 'Moldova', shortLabel: 'MD' },
]

// Toate rutele posibile — butoane directe, fara ambiguitate
export const ROUTES: { origin: DestinationCode; destination: DestinationCode; label: string }[] = [
  { origin: 'MD', destination: 'UK', label: 'Moldova → Anglia' },
  { origin: 'MD', destination: 'BE', label: 'Moldova → Belgia' },
  { origin: 'MD', destination: 'NL', label: 'Moldova → Olanda' },
  { origin: 'UK', destination: 'MD', label: 'Anglia → Moldova' },
  { origin: 'BE', destination: 'MD', label: 'Belgia → Moldova' },
  { origin: 'NL', destination: 'MD', label: 'Olanda → Moldova' },
]

export function getDestLabel(code: string) {
  return DESTINATIONS.find((d) => d.code === code)?.label || code
}

// Human ID: prefixul depinde de DESTINATIA FINALA unde se livreaza
// UK → N     (doar numarul)
// BE → BN    (B + numar)
// NL → OLN   (OL + numar)
// MD → N     (doar numarul)
export function buildHumanId(
  deliveryDestination: DestinationCode,
  numericId: number
): string {
  switch (deliveryDestination) {
    case 'BE':
      return `B${numericId}`
    case 'NL':
      return `OL${numericId}`
    default:
      return `${numericId}`
  }
}

// ── Price calculation ──
// Pretul = greutate * 1.5
// Moneda: GBP daca se livreaza in UK, EUR daca BE/NL

const PRICE_PER_KG = 1.5

export function calculatePrice(weightKg: number): number {
  return Math.round(weightKg * PRICE_PER_KG * 100) / 100
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

// Converteste "2026-W07" → "Săptămâna 09.02.2026 – 15.02.2026"
export function weekIdToDateRange(weekId: string): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return weekId

  const year = parseInt(match[1])
  const week = parseInt(match[2])

  // ISO 8601: saptamana 1 contine 4 ianuarie
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7 // luni=1, duminica=7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

  return `Săptămâna ${fmt(monday)} – ${fmt(sunday)}`
}
