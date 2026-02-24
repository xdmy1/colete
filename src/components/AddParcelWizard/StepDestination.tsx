import type { DestinationCode } from '../../lib/utils'
import { ROUTES } from '../../lib/utils'
import Button from '../ui/Button'

interface StepDestinationProps {
  onSelect: (origin: DestinationCode, deliveryDest: DestinationCode) => void
}

export default function StepDestination({ onSelect }: StepDestinationProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 pt-4">
      {ROUTES.map((route) => (
        <Button
          key={`${route.origin}-${route.destination}`}
          variant="destination"
          size="xl"
          className="w-full h-14 flex-row gap-3"
          onClick={() => onSelect(route.origin, route.destination)}
        >
          <span className="text-base font-bold">{route.label}</span>
        </Button>
      ))}
    </div>
  )
}
