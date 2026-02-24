import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../hooks/useAuth'
import { useAllParcels, useAllDrivers, useReorderParcels, useTransferParcels, useUpdateParcel, useDeleteParcel } from '../hooks/useParcels'
import { calculatePrice } from '../lib/utils'
import { formatPrice, getDestLabel, ROUTES } from '../lib/utils'
import type { Parcel } from '../lib/types'
import Layout from '../components/Layout'
import ParcelPhoto from '../components/ParcelPhoto'

function DragIcon() {
  return (
    <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

export default function AdminDashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { data: parcels, isLoading: loadingParcels } = useAllParcels()
  const { data: drivers, isLoading: loadingDrivers } = useAllDrivers()
  const reorder = useReorderParcels('')

  // Filters
  const [driverFilter, setDriverFilter] = useState<string | 'all'>('all')
  const [routeFilter, setRouteFilter] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered'>('all')
  const [search, setSearch] = useState('')

  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)

  // Multi-select for transfer
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showTransferPicker, setShowTransferPicker] = useState(false)
  const transfer = useTransferParcels()
  const updateParcel = useUpdateParcel()
  const deleteParcel = useDeleteParcel()
  const [editMode, setEditMode] = useState(false)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filteredParcels.map((p) => p.id)))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleTransfer(targetDriverId: string) {
    await transfer.mutateAsync({
      parcelIds: Array.from(selectedIds),
      targetDriverId,
    })
    setShowTransferPicker(false)
    exitSelectMode()
  }

  const isLoading = loadingParcels || loadingDrivers

  // DnD — only works when a single driver is selected
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeParcels.findIndex((p) => p.id === active.id)
    const newIndex = activeParcels.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(activeParcels, oldIndex, newIndex)
    reorder.mutate(reordered.map((p) => p.id))
  }

  // Can reorder only when filtering by a single driver + active parcels exist
  const canReorder = driverFilter !== 'all' && statusFilter !== 'delivered'

  function getDriverName(driverId: string) {
    return drivers?.find((d) => d.id === driverId)?.username || 'Necunoscut'
  }

  // Apply all filters
  const filteredParcels = useMemo(() => {
    let result = parcels || []

    if (driverFilter !== 'all') {
      result = result.filter((p) => p.driver_id === driverFilter)
    }

    if (routeFilter !== 'all') {
      const [origin, dest] = routeFilter.split('->')
      result = result.filter(
        (p) => p.origin_code === origin && p.delivery_destination === dest
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (p) =>
          p.human_id.toLowerCase().includes(q) ||
          p.receiver_details.name.toLowerCase().includes(q) ||
          p.sender_details.name.toLowerCase().includes(q) ||
          p.receiver_details.phone.includes(q) ||
          p.receiver_details.address.toLowerCase().includes(q)
      )
    }

    return result
  }, [parcels, driverFilter, routeFilter, statusFilter, search])

  const activeParcels = filteredParcels.filter((p) => p.status === 'pending')
  const deliveredParcels = filteredParcels.filter((p) => p.status === 'delivered')

  // Stats
  const totalActive = parcels?.filter((p) => p.status === 'pending').length || 0
  const totalDelivered = parcels?.filter((p) => p.status === 'delivered').length || 0

  return (
    <Layout
      title={selectMode ? `${selectedIds.size} selectate` : 'Admin'}
      rightAction={
        selectMode ? (
          <button
            onClick={exitSelectMode}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
          >
            Anulează
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectMode(true)}
              className="px-3 py-1.5 rounded-full text-sm font-medium text-emerald-600 border border-pill-green-border hover:bg-pill-green-bg transition-colors"
            >
              Selectează
            </button>
            <button
              onClick={() => navigate('/archive')}
              className="px-3 py-1.5 rounded-full text-sm font-medium text-slate-500 border border-card-border hover:bg-gray-50 transition-colors"
            >
              Arhivă
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-full text-sm font-medium text-slate-400 border border-card-border hover:bg-gray-50 transition-colors"
            >
              Ieși
            </button>
          </div>
        )
      }
    >
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-white rounded-2xl p-3.5 border border-card-border text-center">
          <p className="text-2xl font-extrabold text-slate-800">{parcels?.length || 0}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total</p>
        </div>
        <div className="bg-pill-orange-bg rounded-2xl p-3.5 border border-pill-orange-border text-center">
          <p className="text-2xl font-extrabold text-amber-700">{totalActive}</p>
          <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wide">Active</p>
        </div>
        <div className="bg-pill-green-bg rounded-2xl p-3.5 border border-pill-green-border text-center">
          <p className="text-2xl font-extrabold text-emerald-700">{totalDelivered}</p>
          <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wide">Livrate</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Caută după nume, telefon, adresă, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 rounded-full border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toți șoferii</option>
          {drivers?.map((driver) => {
            const count =
              parcels?.filter((p) => p.driver_id === driver.id).length || 0
            return (
              <option key={driver.id} value={driver.id}>
                {driver.username} ({count})
              </option>
            )
          })}
        </select>

        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toate rutele</option>
          {ROUTES.map((r) => (
            <option key={`${r.origin}->${r.destination}`} value={`${r.origin}->${r.destination}`}>
              {r.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'delivered')}
          className="px-4 py-2 rounded-full border border-card-border bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-pill-green-border shrink-0"
        >
          <option value="all">Toate</option>
          <option value="pending">Active</option>
          <option value="delivered">Livrate</option>
        </select>
      </div>

      {/* Results count + select all */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <p className="text-xs text-slate-400 font-medium">
          {filteredParcels.length} colete
          {(driverFilter !== 'all' || routeFilter !== 'all' || statusFilter !== 'all' || search) &&
            ` (din ${parcels?.length || 0})`}
        </p>
        {selectMode && filteredParcels.length > 0 && (
          <button
            onClick={selectedIds.size === filteredParcels.length ? () => setSelectedIds(new Set()) : selectAll}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
          >
            {selectedIds.size === filteredParcels.length ? 'Deselectează tot' : 'Selectează tot'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
        </div>
      ) : statusFilter === 'all' ? (
        <>
          {/* Active section */}
          {activeParcels.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-0.5 flex items-center gap-2">
                Active ({activeParcels.length})
                {canReorder && (
                  <span className="font-normal text-emerald-400 normal-case tracking-normal">
                    — ține apăsat pentru a reordona
                  </span>
                )}
              </h2>
              {canReorder ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={activeParcels.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2.5">
                      {activeParcels.map((parcel) => (
                        <SortableAdminCard
                          key={parcel.id}
                          parcel={parcel}
                          driverName={getDriverName(parcel.driver_id)}
                          onClick={() => setSelectedParcel(parcel)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-2.5">
                  {activeParcels.map((parcel) => (
                    <AdminParcelCard
                      key={parcel.id}
                      parcel={parcel}
                      driverName={getDriverName(parcel.driver_id)}
                      onClick={() => setSelectedParcel(parcel)}
                      selectMode={selectMode}
                      isSelected={selectedIds.has(parcel.id)}
                      onToggle={() => toggleSelect(parcel.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Delivered section */}
          {deliveredParcels.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-0.5">
                Livrate ({deliveredParcels.length})
              </h2>
              <div className="space-y-2.5">
                {deliveredParcels.map((parcel) => (
                  <AdminParcelCard
                    key={parcel.id}
                    parcel={parcel}
                    driverName={getDriverName(parcel.driver_id)}
                    onClick={() => setSelectedParcel(parcel)}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(parcel.id)}
                    onToggle={() => toggleSelect(parcel.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredParcels.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-3 bg-white border border-card-border rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">Niciun colet găsit</p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2.5 mb-6">
          {filteredParcels.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-3 bg-white border border-card-border rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">Niciun colet găsit</p>
            </div>
          ) : (
            filteredParcels.map((parcel) => (
              <AdminParcelCard
                key={parcel.id}
                parcel={parcel}
                driverName={getDriverName(parcel.driver_id)}
                onClick={() => setSelectedParcel(parcel)}
                selectMode={selectMode}
                isSelected={selectedIds.has(parcel.id)}
                onToggle={() => toggleSelect(parcel.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Bottom bar: select mode action OR FAB */}
      {selectMode && selectedIds.size > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-card-border px-4 py-4 z-20 safe-area-bottom">
          <button
            onClick={() => setShowTransferPicker(true)}
            className="w-full py-3.5 bg-pill-green-bg text-emerald-800 text-base font-bold rounded-full border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
          >
            Atribuie {selectedIds.size} colete unui șofer
          </button>
        </div>
      ) : !selectMode && (
        <button
          onClick={() => navigate('/add')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-white text-emerald-600 rounded-full border border-card-border hover:bg-pill-green-bg hover:border-pill-green-border active:scale-95 transition-all flex items-center justify-center z-20 shadow-sm"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {/* Transfer Driver Picker Modal */}
      {showTransferPicker && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl border border-card-border p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-800 text-center">
              Atribuie {selectedIds.size} colete
            </h3>
            <p className="text-sm text-slate-400 text-center">
              Selectează șoferul căruia i le atribui:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {drivers?.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => handleTransfer(driver.id)}
                  disabled={transfer.isPending}
                  className="w-full text-left px-5 py-3.5 rounded-2xl border border-card-border hover:border-pill-green-border hover:bg-pill-green-bg/30 transition-all disabled:opacity-50"
                >
                  <span className="text-base font-bold text-slate-800">
                    {driver.username}
                  </span>
                  <span className="ml-2 text-sm text-slate-400">
                    ({driver.range_start}-{driver.range_end})
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTransferPicker(false)}
              className="w-full py-3 rounded-full border border-card-border text-slate-500 font-semibold hover:bg-gray-50 transition-colors"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selectedParcel && (
        <AdminParcelModal
          parcel={selectedParcel}
          driverName={getDriverName(selectedParcel.driver_id)}
          editMode={editMode}
          onClose={() => { setSelectedParcel(null); setEditMode(false) }}
          onEdit={() => setEditMode(true)}
          onSave={async (updates) => {
            await updateParcel.mutateAsync({ parcelId: selectedParcel.id, updates })
            setEditMode(false)
            setSelectedParcel(null)
          }}
          onDelete={async () => {
            if (!confirm('Ești sigur că vrei să ștergi acest colet?')) return
            await deleteParcel.mutateAsync(selectedParcel.id)
            setSelectedParcel(null)
          }}
          isSaving={updateParcel.isPending}
          isDeleting={deleteParcel.isPending}
        />
      )}
    </Layout>
  )
}

// ── Sortable wrapper for admin drag & drop ──
function SortableAdminCard({
  parcel,
  driverName,
  onClick,
}: {
  parcel: Parcel
  driverName: string
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: parcel.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch rounded-2xl bg-white border border-card-border overflow-hidden"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex flex-col items-center justify-center w-11 shrink-0 cursor-grab active:cursor-grabbing gap-1 border-r border-card-border"
        style={{
          touchAction: 'none',
          backgroundColor: '#fef9e7',
        }}
      >
        <DragIcon />
      </div>
      <div className="flex-1 min-w-0">
        <AdminParcelCard
          parcel={parcel}
          driverName={driverName}
          onClick={onClick}
          noBorder
        />
      </div>
    </div>
  )
}

// ── Admin Parcel Card ──
function AdminParcelCard({
  parcel,
  driverName,
  onClick,
  noBorder = false,
  selectMode = false,
  isSelected = false,
  onToggle,
}: {
  parcel: Parcel
  driverName: string
  onClick: () => void
  noBorder?: boolean
  selectMode?: boolean
  isSelected?: boolean
  onToggle?: () => void
}) {
  const isDelivered = parcel.status === 'delivered'
  return (
    <button
      onClick={selectMode ? onToggle : onClick}
      className={`w-full text-left p-4 transition-all ${
        noBorder
          ? ''
          : `rounded-2xl border ${
              isSelected
                ? 'border-pill-green-border bg-pill-green-bg/30'
                : isDelivered
                  ? 'bg-pill-green-bg/30 border-pill-green-border/60'
                  : 'bg-white border-card-border'
            }`
      }`}
    >
      {/* Row 1: ID + badges + price */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {selectMode && (
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                isSelected
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {isSelected && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
          <span className="text-lg font-extrabold text-slate-800">
            {parcel.human_id}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-slate-500 font-medium border border-card-border">
            {getDestLabel(parcel.origin_code)} → {getDestLabel(parcel.delivery_destination)}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium border border-blue-200">
            {driverName}
          </span>
          {parcel.labels.filter(l => l !== 'COLET' && l !== 'LIVRARE').length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold border border-violet-200">
              {parcel.labels.filter(l => l !== 'COLET' && l !== 'LIVRARE').join(', ')}
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-emerald-700 whitespace-nowrap ml-2">
          {formatPrice(parcel.price, parcel.currency)}
        </span>
      </div>

      {/* Row 2: Receiver info */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-700 truncate">
            {parcel.receiver_details.name}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {parcel.receiver_details.address}
          </p>
        </div>
        <span className="text-xs text-slate-400 ml-3 whitespace-nowrap">
          {parcel.receiver_details.phone}
        </span>
      </div>

      {/* Row 3: Sender + weight */}
      <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400">
        <span className="truncate">
          De la: {parcel.sender_details.name}
        </span>
        <span className="whitespace-nowrap ml-3">{parcel.weight} kg</span>
      </div>
    </button>
  )
}

// ── Admin Parcel Detail / Edit Modal ──
function AdminParcelModal({
  parcel,
  driverName,
  editMode,
  onClose,
  onEdit,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  parcel: Parcel
  driverName: string
  editMode: boolean
  onClose: () => void
  onEdit: () => void
  onSave: (updates: {
    sender_details?: { name: string; phone: string; address: string }
    receiver_details?: { name: string; phone: string; address: string }
    content_description?: string | null
    weight?: number
    price?: number
  }) => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const [senderName, setSenderName] = useState(parcel.sender_details.name)
  const [senderPhone, setSenderPhone] = useState(parcel.sender_details.phone)
  const [senderAddress, setSenderAddress] = useState(parcel.sender_details.address)
  const [receiverName, setReceiverName] = useState(parcel.receiver_details.name)
  const [receiverPhone, setReceiverPhone] = useState(parcel.receiver_details.phone)
  const [receiverAddress, setReceiverAddress] = useState(parcel.receiver_details.address)
  const [contentDesc, setContentDesc] = useState(parcel.content_description || '')
  const [weight, setWeight] = useState(parcel.weight)

  function handleSave() {
    const newPrice = calculatePrice(weight)
    onSave({
      sender_details: { name: senderName, phone: senderPhone, address: senderAddress },
      receiver_details: { name: receiverName, phone: receiverPhone, address: receiverAddress },
      content_description: contentDesc || null,
      weight,
      price: newPrice,
    })
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-card-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto border border-card-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-card-border px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">{parcel.human_id}</h2>
            <p className="text-xs text-slate-400 font-medium">
              {getDestLabel(parcel.origin_code)} → {getDestLabel(parcel.delivery_destination)} · {driverName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Photo */}
          {parcel.photo_url && (
            <div className="rounded-2xl overflow-hidden border border-card-border">
              <ParcelPhoto photoPath={parcel.photo_url} className="w-full max-h-48 object-cover" />
            </div>
          )}

          {/* Status + labels */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              parcel.status === 'delivered'
                ? 'bg-pill-green-bg text-emerald-700 border-pill-green-border'
                : 'bg-pill-orange-bg text-amber-700 border-pill-orange-border'
            }`}>
              {parcel.status === 'delivered' ? 'Livrat' : 'Activ'}
            </span>
            {parcel.labels.length > 0 && parcel.labels.map((l) => (
              <span key={l} className="px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-xs font-bold border border-violet-200">
                {l}
              </span>
            ))}
            <span className="text-base font-bold text-emerald-700 ml-auto">
              {formatPrice(parcel.price, parcel.currency)}
            </span>
          </div>

          {editMode ? (
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expeditor</h3>
              <input className={inputCls} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Nume expeditor" />
              <input className={inputCls} value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="Telefon expeditor" />
              <input className={inputCls} value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="Adresă expeditor" />

              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Destinatar</h3>
              <input className={inputCls} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nume destinatar" />
              <input className={inputCls} value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="Telefon destinatar" />
              <input className={inputCls} value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} placeholder="Adresă destinatar" />

              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Detalii colet</h3>
              <input className={inputCls} value={contentDesc} onChange={(e) => setContentDesc(e.target.value)} placeholder="Descriere conținut" />
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-medium">Greutate (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className={inputCls}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Preț recalculat: {formatPrice(calculatePrice(weight), parcel.currency)}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-full border border-card-border text-slate-500 font-semibold hover:bg-gray-50 text-sm transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-full bg-pill-green-bg text-emerald-800 font-bold border border-pill-green-border hover:bg-emerald-100 disabled:opacity-50 text-sm transition-colors"
                >
                  {isSaving ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expeditor</h3>
                <p className="text-base font-bold text-slate-800">{parcel.sender_details.name}</p>
                <a href={`tel:${parcel.sender_details.phone}`} className="text-sm text-blue-500 font-medium">
                  {parcel.sender_details.phone}
                </a>
                <p className="text-xs text-slate-400">{parcel.sender_details.address}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destinatar</h3>
                <p className="text-base font-bold text-slate-800">{parcel.receiver_details.name}</p>
                <a href={`tel:${parcel.receiver_details.phone}`} className="text-sm text-emerald-600 font-medium">
                  {parcel.receiver_details.phone}
                </a>
                <p className="text-xs text-slate-400">{parcel.receiver_details.address}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-1.5 border border-card-border">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalii</h3>
                {parcel.content_description && (
                  <p className="text-xs text-slate-500">Conținut: {parcel.content_description}</p>
                )}
                <p className="text-xs text-slate-500">Greutate: {parcel.weight} kg</p>
                <p className="text-xs text-slate-500">Aspect: {parcel.appearance || '—'}</p>
              </div>

              {parcel.status === 'delivered' && (
                <div className="bg-pill-green-bg/50 rounded-2xl p-4 space-y-1.5 border border-pill-green-border">
                  <h3 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Livrare</h3>
                  {parcel.delivered_at && (
                    <p className="text-xs text-slate-500">
                      Livrat: {new Date(parcel.delivered_at).toLocaleString('ro-RO')}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Client mulțumit: {parcel.client_satisfied === null ? '—' : parcel.client_satisfied ? 'Da' : 'Nu'}
                  </p>
                  {parcel.delivery_note && (
                    <p className="text-xs text-slate-500">Notă: {parcel.delivery_note}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="py-3 px-5 rounded-full border border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? '...' : 'Șterge'}
                </button>
                <button
                  onClick={onEdit}
                  className="flex-1 py-3 rounded-full bg-slate-800 text-white font-bold text-sm border border-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Editează
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
