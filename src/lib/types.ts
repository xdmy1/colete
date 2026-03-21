import type { DestinationCode } from './utils'

export interface Profile {
  id: string
  username: string
  pin_code: string
  role: 'admin' | 'driver'
  created_at: string
}

export interface DriverRouteRange {
  id: string
  driver_id: string
  origin: string
  destination: string
  range_start: number
  range_end: number
}

export interface ContactDetails {
  name: string
  phone: string
  address: string
}

export interface Parcel {
  id: string
  human_id: string
  numeric_id: number
  driver_id: string
  week_id: string
  status: 'pending' | 'delivered'
  is_archived: boolean
  origin_code: DestinationCode        // de unde vine coletul
  delivery_destination: DestinationCode // unde se livreaza
  sender_details: ContactDetails
  receiver_details: ContactDetails
  content_description: string | null
  appearance: 'box' | 'bag' | 'envelope' | 'other' | null  // legacy, nu mai folosit
  nr_bucati: number
  weight: number
  price: number
  currency: 'GBP' | 'EUR'
  photo_url: string | null      // legacy
  photo_urls: string[]          // new (1-3 poze)
  route_order: number
  labels: string[]
  payment_status: 'paid' | 'cod' | 'transfer'
  transfer_recipient: string | null
  cash_collected: boolean
  client_satisfied: boolean | null
  delivery_note: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface NewParcelData {
  origin_code: DestinationCode           // UK/BE/NL/MD — de unde vine
  delivery_destination: DestinationCode  // unde se livreaza efectiv
  sender_details: ContactDetails
  receiver_details: ContactDetails
  content_description: string
  nr_bucati: number
  payment_status: 'paid' | 'cod' | 'transfer'
  transfer_recipient?: string
  weight: number
  manual_price?: number
  photos: File[]
}
