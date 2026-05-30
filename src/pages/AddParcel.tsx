import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAddParcel, useAllDrivers, useDriverRoutes, useAllDriverRoutes } from '../hooks/useParcels'
import { useUpsertClientWithAddress } from '../hooks/useClients'
import type { NewParcelData } from '../lib/types'
import { ROUTES, getDestLabel } from '../lib/utils'
import type { DestinationCode } from '../lib/utils'
import AddParcelWizard, { type ParcelPrefill } from '../components/AddParcelWizard'
import Button from '../components/ui/Button'

export default function AddParcel() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const prefill: ParcelPrefill | null = (location.state as { prefill?: ParcelPrefill } | null)?.prefill ?? null
  const upsertClient = useUpsertClientWithAddress()

  const [adminSelectedDriver, setAdminSelectedDriver] = useState<string | null>(null)

  const effectiveDriverId = isAdmin ? adminSelectedDriver : profile?.id || null

  const excludedDest = profile?.excluded_destinations ?? null
  const { data: driverRouteRanges } = useDriverRoutes(effectiveDriverId || undefined)
  const baseRoutes = driverRouteRanges && driverRouteRanges.length > 0
    ? driverRouteRanges.map(r =>
        ROUTES.find(rt => rt.origin === r.origin && rt.destination === r.destination)
        ?? { origin: r.origin as DestinationCode, destination: r.destination as DestinationCode, label: `${getDestLabel(r.origin)} → ${getDestLabel(r.destination)}` }
      )
    : ROUTES
  const availableRoutes = excludedDest && excludedDest.length > 0
    ? baseRoutes.filter(r => !excludedDest.includes(r.origin) && !excludedDest.includes(r.destination))
    : baseRoutes

  const { data: allDrivers } = useAllDrivers()
  const { data: allDriverRoutes } = useAllDriverRoutes()

  // Daca adminul are excluded_destinations, arata doar soferii cu rute pe tarile permise
  const drivers = isAdmin && excludedDest && excludedDest.length > 0
    ? (() => {
        const validDriverIds = new Set(
          (allDriverRoutes || [])
            .filter(r => !excludedDest.includes(r.origin) && !excludedDest.includes(r.destination))
            .map(r => r.driver_id)
        )
        return (allDrivers || []).filter(d => validDriverIds.has(d.id))
      })()
    : (allDrivers || [])
  const addParcel = useAddParcel(effectiveDriverId || '')

  async function handleComplete(
    data: NewParcelData,
    links: { client_id?: string; client_address_id?: string }
  ) {
    if (!effectiveDriverId) {
      alert('Niciun șofer selectat!')
      return
    }

    try {
      let clientId = links.client_id
      let clientAddressId = links.client_address_id

      // Upsert client + adresa pe baza datelor coletului (sender = client, receiver = adresa salvata).
      // E best-effort: daca esueaza, coletul tot se salveaza fara legatura.
      try {
        const upserted = await upsertClient.mutateAsync({
          sender_name: data.sender_details.name,
          sender_phone: data.sender_details.phone,
          recipient_name: data.receiver_details.name,
          recipient_phone: data.receiver_details.phone,
          recipient_address: data.receiver_details.address,
          destination_country: data.delivery_destination,
        })
        if (upserted) {
          clientId = upserted.client_id
          clientAddressId = upserted.client_address_id ?? clientAddressId
        }
      } catch (clientErr) {
        console.warn('[ADD] upsert client esuat, salvez coletul fara legatura:', clientErr)
      }

      await addParcel.mutateAsync({ ...data, client_id: clientId, client_address_id: clientAddressId })
      navigate('/')
    } catch (err: any) {
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      console.error('Eroare la salvarea coletului:', msg, err)
      alert(`Eroare: ${msg}`)
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="w-8 h-8 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isAdmin && !adminSelectedDriver) {
    return (
      <div className="min-h-screen bg-soft-bg flex flex-col">
        <div className="bg-white border-b border-card-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-700 hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-slate-800">
            Atribuie coletul unui șofer
          </h1>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <p className="text-slate-400 mb-4">
            Selectează șoferul căruia îi atribui coletul:
          </p>
          {drivers?.map((driver) => (
            <Button
              key={driver.id}
              variant="destination"
              size="lg"
              className="w-full justify-between"
              onClick={() => setAdminSelectedDriver(driver.id)}
            >
              <span className="font-semibold">{driver.username}</span>
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AddParcelWizard
      onComplete={handleComplete}
      onCancel={() => navigate('/')}
      isSubmitting={addParcel.isPending || upsertClient.isPending}
      routes={availableRoutes}
      driverId={effectiveDriverId || ''}
      prefill={prefill}
    />
  )
}
