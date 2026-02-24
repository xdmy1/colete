import { usePhotoUrl } from '../hooks/usePhotoUrl'

export default function ParcelPhoto({
  photoPath,
  className = 'w-full max-h-64 object-cover',
}: {
  photoPath: string | null
  className?: string
}) {
  const url = usePhotoUrl(photoPath)
  if (!url) return null
  return <img src={url} alt="Colet" className={className} loading="eager" />
}
