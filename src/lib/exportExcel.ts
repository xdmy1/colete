import ExcelJS from 'exceljs'
import type { Parcel } from './types'
import { getDestLabel, formatPrice } from './utils'
import { getPhotoUrl } from '../hooks/usePhotoUrl'

export async function exportParcelsToExcel(
  parcels: Parcel[],
  getDriverName: (id: string) => string,
  filename?: string,
  includePhotos = true
) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Colete')

  sheet.columns = [
    { header: 'ID',                key: 'id',            width: 10  },
    { header: 'Foto',              key: 'photo',          width: 14  },
    { header: 'Expeditor',         key: 'sender',         width: 24  },
    { header: 'Tel. Expeditor',    key: 'senderPhone',    width: 16  },
    { header: 'Adresa Expeditor',  key: 'senderAddr',     width: 32  },
    { header: 'Destinatar',        key: 'receiver',       width: 24  },
    { header: 'Tel. Destinatar',   key: 'receiverPhone',  width: 16  },
    { header: 'Adresa Destinatar', key: 'receiverAddr',   width: 32  },
    { header: 'Conținut',          key: 'content',        width: 30  },
    { header: 'Nr. bucăți',        key: 'nr_bucati',      width: 10  },
    { header: 'Greutate (kg)',     key: 'weight',         width: 13  },
    { header: 'Preț',              key: 'price',          width: 10  },
    { header: 'Plată',             key: 'payment',        width: 18  },
    { header: 'Șofer',             key: 'driver',         width: 18  },
  ]

  // Header styling
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, size: 11 }
  headerRow.height = 20
  headerRow.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  })

  for (let i = 0; i < parcels.length; i++) {
    const p = parcels[i]

    const payment = p.payment_status === 'paid'
      ? 'Achitat'
      : p.payment_status === 'transfer'
        ? `Transfer${p.transfer_recipient ? ` → ${p.transfer_recipient}` : ''}`
        : p.cash_collected
          ? 'La livrare — achitat'
          : 'La livrare'

    const row = sheet.addRow({
      id:           p.human_id,
      photo:        '',
      sender:       p.sender_details.name,
      senderPhone:  p.sender_details.phone,
      senderAddr:   p.sender_details.address,
      receiver:     p.receiver_details.name,
      receiverPhone:p.receiver_details.phone,
      receiverAddr: p.receiver_details.address,
      content:      p.content_description || '',
      nr_bucati:    p.nr_bucati,
      weight:       p.weight,
      price:        formatPrice(p.price, p.currency),
      payment,
      driver:       getDriverName(p.driver_id),
    })

    // Wrap text + vertical align for all cells in row
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
    })

    // Auto row height based on longest wrapping cell (approx 15px per line)
    const maxLen = Math.max(
      p.sender_details.address.length,
      p.receiver_details.address.length,
      (p.content_description || '').length,
    )
    const lines = Math.max(1, Math.ceil(maxLen / 35))

    const firstPhoto = includePhotos ? (p.photo_urls?.[0] ?? p.photo_url ?? null) : null
    if (firstPhoto) {
      try {
        const url = getPhotoUrl(firstPhoto)
        if (url) {
          const resp = await fetch(url)
          const buffer = await resp.arrayBuffer()
          const ext = firstPhoto.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'

          const imageId = workbook.addImage({ buffer, extension: ext })
          sheet.addImage(imageId, {
            tl: { col: 1, row: i + 1 },
            ext: { width: 90, height: 90 },
            editAs: 'oneCell',
          })
          row.height = Math.max(70, lines * 16)
        } else {
          row.height = Math.max(18, lines * 16)
        }
      } catch {
        row.height = Math.max(18, lines * 16)
      }
    } else {
      row.height = Math.max(18, lines * 16)
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename || `colete_${new Date().toISOString().slice(0, 10)}.xlsx`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ── Export dare de seama (COD achitate) ──

export interface CashReportGroup {
  driverName: string
  items: Parcel[]
  gbp: number
  eur: number
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
const DRIVER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } }
const SUBTOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
const TOTAL_FILL: ExcelJS.Fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

export async function exportCashReportToExcel(
  groups: CashReportGroup[],
  filename?: string
) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dare de seamă')

  sheet.columns = [
    { key: 'id',       width: 12 },
    { key: 'route',    width: 22 },
    { key: 'receiver', width: 26 },
    { key: 'phone',    width: 16 },
    { key: 'bucati',   width: 10 },
    { key: 'amount',   width: 14 },
  ]

  // Header row
  const headerRow = sheet.addRow(['ID', 'Rută', 'Destinatar', 'Telefon', 'Buc.', 'Sumă'])
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = HEADER_FILL
  headerRow.height = 22
  headerRow.alignment = { vertical: 'middle' }

  let totalGbp = 0
  let totalEur = 0

  for (const group of groups) {
    // Driver row
    const driverRow = sheet.addRow([group.driverName, '', '', '', '', ''])
    driverRow.font = { bold: true, color: { argb: 'FF1E40AF' }, size: 11 }
    driverRow.fill = DRIVER_FILL
    driverRow.height = 20
    driverRow.alignment = { vertical: 'middle' }
    sheet.mergeCells(`A${driverRow.number}:F${driverRow.number}`)

    // Parcel rows
    for (const p of group.items) {
      const row = sheet.addRow([
        p.human_id,
        `${getDestLabel(p.origin_code)} → ${getDestLabel(p.delivery_destination)}`,
        p.receiver_details.name,
        p.receiver_details.phone,
        p.nr_bucati,
        formatPrice(p.price, p.currency),
      ])
      row.height = 18
      row.alignment = { vertical: 'middle' }
      row.getCell('amount').font = { bold: true, color: { argb: 'FF065F46' } }
    }

    // Subtotal row
    const subtotalParts: string[] = []
    if (group.gbp > 0) subtotalParts.push(`£${group.gbp.toFixed(2)}`)
    if (group.eur > 0) subtotalParts.push(`€${group.eur.toFixed(2)}`)

    const subRow = sheet.addRow(['', '', '', '', `Subtotal ${group.driverName}:`, subtotalParts.join(' + ')])
    subRow.font = { bold: true, italic: true, color: { argb: 'FF1E40AF' } }
    subRow.fill = SUBTOTAL_FILL
    subRow.height = 19
    subRow.alignment = { vertical: 'middle' }
    subRow.getCell('amount').font = { bold: true, color: { argb: 'FF1E40AF' } }

    totalGbp += group.gbp
    totalEur += group.eur

    // Spacer
    sheet.addRow([])
  }

  // Grand total row
  const totalParts: string[] = []
  if (totalGbp > 0) totalParts.push(`£${totalGbp.toFixed(2)}`)
  if (totalEur > 0) totalParts.push(`€${totalEur.toFixed(2)}`)

  const totalRow = sheet.addRow(['', '', '', '', 'TOTAL GENERAL:', totalParts.join(' + ')])
  totalRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  totalRow.fill = TOTAL_FILL
  totalRow.height = 24
  totalRow.alignment = { vertical: 'middle' }

  // Border on all data cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBuffer(buffer, filename || `dare_de_seama_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
