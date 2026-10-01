// Solo en las pantallas con la estructura de la app: en la raíz envolvía también la
// portada, y sin JS se quedaba este esqueleto en lugar de la presentación
import { AppShellSkeleton } from "@/app/components/skeletons"

export default function Loading() {
  return <AppShellSkeleton />
}
