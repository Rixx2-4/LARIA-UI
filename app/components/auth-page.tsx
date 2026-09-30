import type { ReactNode } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { PlenumLogo } from "./plenum-logo"

// Marco de las pantallas de Clerk (entrar, crear cuenta): la marca de Plenum y
// una salida bien visible a la página de inicio
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background px-4 py-16">
      {/* Desde tablet, con texto; en móvil solo la X (44 px) */}
      <Link
        href="/"
        aria-label="Cerrar y volver a la página de inicio"
        className="absolute right-3 top-3 z-10 flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent sm:right-6 sm:top-6 sm:px-4"
      >
        <X className="h-5 w-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Volver al inicio</span>
      </Link>
      <Link href="/" aria-label="Plenum, página de inicio" className="flex items-center text-foreground">
        <PlenumLogo className="h-14" />
      </Link>
      {children}
    </main>
  )
}
