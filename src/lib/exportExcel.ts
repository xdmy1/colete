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
    { header: 'ID',               key: 'id',           width: 10 },
    { header: 'Foto',             key: 'photo',         width: 14 },
    { header: 'Ruta',             key: 'route',         width: 22 },
    { header: 'Expeditor',        key: 'sender',        width: 22 },
    { header: 'Tel. Expeditor',   key: 'senderPhone',   width: 15 },
    { header: 'Adresa Expeditor', key: 'senderAddr',    width: 28 },
    { header: 'Destinatar',       key: 'receiver',      width: 22 },
    { header: 'Tel. Destinatar',  key: 'receiverPhone', width: 15 },
    { header: 'Adresa Destinatar',key: 'receiverAddr',  width: 28 },
    { header: 'Conținut',         key: 'content',       width: 20 },
    { header: 'Nr. bucăți',       key: 'nr_bucati',     width: 12 },
    { header: 'Greutate (kg)',    key: 'weight',        width: 13 },
    { header: 'Preț',             key: 'price',         width: 10 },
    { header: 'Plată',            key: 'payment',       width: 16 },
    { header: 'Șofer',            key: 'driver',        width: 18 },
    { header: 'Status',           key: 'status',        width: 10 },
    { header: 'Client mulțumit',  key: 'satisfied',     width: 15 },
    { header: 'Mențiuni',         key: 'notes',         width: 22 },
    { header: 'Data',             key: 'date',          width: 12 },
  ]

  sheet.getRow(1).font = { bold: true }

  for (let i = 0; i < parcels.length; i++) {
    const p = parcels[i]

    sheet.addRow({
      id:           p.human_id,
      photo:        '',
      route:        `${getDestLabel(p.origin_code)} → ${getDestLabel(p.delivery_destination)}`,
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
      payment:      p.payment_status === 'paid' ? 'Achitat' : p.payment_status === 'transfer' ? 'Transfer' : 'La livrare',
      driver:       getDriverName(p.driver_id),
      status:       p.status === 'delivered' ? 'Livrat' : 'Activ',
      satisfied:    p.client_satisfied == null ? '' : p.client_satisfied ? 'Da' : 'Nu',
      notes:        p.delivery_note || '',
      date:         new Date(p.created_at).toLocaleDateString('ro-RO'),
    })

    const firstPhoto = includePhotos ? (p.photo_urls?.[0] ?? p.photo_url ?? null) : null
    if (firstPhoto) {
      try {
        const url = getPhotoUrl(firstPhoto)
        if (url) {
          const resp = await fetch(url)
          const buffer = await resp.arrayBuffer()
          const ext = firstPhoto.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'

          const imageId = workbook.addImage({ buffer, extension: ext })

          // tl row/col are 0-based; row i+1 skips header row
          sheet.addImage(imageId, {
            tl: { col: 1, row: i + 1 },
            ext: { width: 90, height: 90 },
            editAs: 'oneCell',
          })

          sheet.getRow(i + 2).height = 70
        }
      } catch {
        // skip if image unavailable
      }
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
