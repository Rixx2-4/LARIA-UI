"use client"

import type { ReactNode } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/app/contexts/auth-context"
import { LoginScreen } from "./login-screen"

// Muestra la página solo con sesión; si no, el login o el aviso de conexión
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, connectionError, retry } = useAuth()

  if (isLoading) {
    return (
      <div role="status" aria-label="Cargando" className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">{connectionError}</p>
        <Button variant="outline" onClick={retry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    )
  }

  if (!isAuthenticated) return <LoginScreen />

  return <>{children}</>
}
