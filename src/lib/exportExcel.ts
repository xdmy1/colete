import * as XLSX from 'xlsx'
import type { Parcel } from './types'
import { getDestLabel, formatPrice } from './utils'

export function exportParcelsToExcel(
  parcels: Parcel[],
  getDriverName: (id: string) => string,
  filename?: string
) {
  const rows = parcels.map((p) => ({
    'ID': p.human_id,
    'Ruta': `${getDestLabel(p.origin_code)} → ${getDestLabel(p.delivery_destination)}`,
    'Expeditor': p.sender_details.name,
    'Tel. Expeditor': p.sender_details.phone,
    'Adresa Expeditor': p.sender_details.address,
    'Destinatar': p.receiver_details.name,
    'Tel. Destinatar': p.receiver_details.phone,
    'Adresa Destinatar': p.receiver_details.address,
    'Conținut': p.content_description || '',
    'Greutate (kg)': p.weight,
    'Preț': formatPrice(p.price, p.currency),
    'Șofer': getDriverName(p.driver_id),
    'Status': p.status === 'delivered' ? 'Livrat' : 'Activ',
    'Client mulțumit': p.client_satisfied === null ? '' : p.client_satisfied ? 'Da' : 'Nu',
    'Mențiuni': p.delivery_note || '',
    'Data': new Date(p.created_at).toLocaleDateString('ro-RO'),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String(r[key as keyof typeof r] || '').length)
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Colete')

  const name = filename || `colete_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, name)
}
