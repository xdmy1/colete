import { supabase } from './supabase'
import { getNumberingContinuationWeek, type DestinationCode } from './utils'

// Range-ul șoferului pe o rută + dacă are counter partajat peste rute
// (ex: repartizare_olanda ridică și din BE și din NL cu aceeași numerotare)
export async function getNumberingContext(
  driverId: string,
  originCode: DestinationCode,
  deliveryDestination: DestinationCode
): Promise<{ range_start: number; range_end: number; shared: boolean } | null> {
  const [{ data: rangeRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from('driver_route_ranges')
      .select('range_start, range_end')
      .eq('driver_id', driverId)
      .eq('origin', originCode)
      .eq('destination', deliveryDestination)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('shared_pickup_counter')
      .eq('id', driverId)
      .maybeSingle(),
  ])
  if (!rangeRow) return null
  return {
    range_start: rangeRow.range_start,
    range_end: rangeRow.range_end,
    shared: !!profileRow?.shared_pickup_counter,
  }
}

// Cel mai mare numeric_id folosit de șofer într-o săptămână, în range-ul lui
// (inclusiv colete arhivate/livrate — numerele nu se refolosesc). null = niciunul.
export async function getMaxUsedNumericId(
  driverId: string,
  weekId: string,
  originCode: DestinationCode,
  deliveryDestination: DestinationCode,
  ctx: { range_start: number; range_end: number; shared: boolean }
): Promise<number | null> {
  let query = supabase
    .from('parcels')
    .select('numeric_id')
    .eq('driver_id', driverId)
    .eq('week_id', weekId)
    .gte('numeric_id', ctx.range_start)
    .lte('numeric_id', ctx.range_end)
    .order('numeric_id', { ascending: false })
    .limit(1)

  if (!ctx.shared) {
    query = query
      .eq('origin_code', originCode)
      .eq('delivery_destination', deliveryDestination)
  }

  const { data: rows } = await query
  return rows?.[0]?.numeric_id ?? null
}

// Numărul minim de la care pornește un colet nou când săptămâna curentă
// CONTINUĂ numerotarea săptămânii trecute (vezi getNumberingContinuationWeek
// în utils). Ex: oficiu a rămas la 58 în W42 → în W43 primul colet e 59.
// null = numerotare normală (nu e săptămână de excepție / nu există colete anterioare).
export async function getContinuationFloor(
  driverId: string,
  weekId: string,
  originCode: DestinationCode,
  deliveryDestination: DestinationCode,
  ctx?: { range_start: number; range_end: number; shared: boolean } | null
): Promise<number | null> {
  const prevWeek = getNumberingContinuationWeek(originCode, weekId)
  if (!prevWeek) return null

  const context = ctx ?? (await getNumberingContext(driverId, originCode, deliveryDestination))
  if (!context) return null

  const prevMax = await getMaxUsedNumericId(driverId, prevWeek, originCode, deliveryDestination, context)
  return prevMax === null ? null : prevMax + 1
}
