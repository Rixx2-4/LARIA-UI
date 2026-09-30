"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/app/contexts/auth-context"
import { SIGN_IN_HREF } from "@/lib/routes"
import { AppShellSkeleton } from "./skeletons"

// Muestra la página solo con sesión; sin ella, a entrar (y de vuelta aquí después)
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, connectionError, retry, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const signedOut = !isLoading && !isAuthenticated && !connectionError

  useEffect(() => {
    if (signedOut) router.replace(`${SIGN_IN_HREF}?redirect_url=${encodeURIComponent(pathname || "/chat")}`)
  }, [signedOut, router, pathname])

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
