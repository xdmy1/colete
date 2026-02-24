import type { DestinationCode } from './utils'

export interface Profile {
  id: string
  username: string
  pin_code: string
  range_start: number
  range_end: number
  role: 'admin' | 'driver'
  created_at: string
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
  appearance: 'box' | 'bag' | 'envelope' | 'other' | null
  weight: number
  price: number
  currency: 'GBP' | 'EUR'
  photo_url: string | null
  route_order: number
  labels: string[]
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
  appearance: 'box' | 'bag' | 'envelope' | 'other'
  weight: number
  photo: File | null
}
