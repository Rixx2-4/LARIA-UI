"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/app/contexts/auth-context"
import { SIGN_IN_HREF } from "@/lib/routes"
import { AppShellSkeleton } from "./skeletons"
import { LariaMascot } from "./laria-mascot"
import { useSlow } from "@/lib/use-slow"
import { WAKE_DEADLINE_MS } from "@/app/contexts/auth-context"

// Muestra la página solo con sesión; sin ella, a entrar (y de vuelta aquí después)
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, connectionError, wakingSince, loadingUser, retry, logout } = useAuth()
  // Un servidor dormido tarda en contestar sin fallar (Render retiene la petición
  // mientras arranca): pasados unos segundos también se explica la espera
  const slowServer = useSlow(loadingUser, 4000)
  const router = useRouter()
  const pathname = usePathname()
  const signedOut = !isLoading && !isAuthenticated && !connectionError

  useEffect(() => {
    if (signedOut) router.replace(`${SIGN_IN_HREF}?redirect_url=${encodeURIComponent(pathname || "/chat")}`)
  }, [signedOut, router, pathname])

  if (wakingSince !== null || slowServer) return <WakingServer since={wakingSince} />
  if (isLoading || signedOut) return <AppShellSkeleton />

  if (connectionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">{connectionError}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={retry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
          <Button variant="ghost" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Mientras el servidor despierta: qué pasa y cuánto puede tardar, en vez de un
// esqueleto mudo. La barra avanza con el tiempo de espera, hasta el tope
function WakingServer({ since }: { since: number | null }) {
  const [start] = useState(() => since ?? Date.now())
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - start), 500)
    return () => clearInterval(timer)
  }, [start])
  const percent = Math.min(95, Math.round((elapsed / WAKE_DEADLINE_MS) * 100))

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4 text-center">
      <LariaMascot state="thinking" className="w-24" />
      <div role="status" className="space-y-1.5">
        <p className="font-medium">Despertando el servidor…</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Si nadie lo ha usado en un rato, se duerme. Puede tardar hasta un minuto.
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Esperando al servidor"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-56 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
