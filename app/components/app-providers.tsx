"use client"

import type { ReactNode } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

// La portada no necesita sesión: así no baja Clerk (~1 MB de JS) ni los contextos
// de la app. El resto de páginas cargan la sesión en su propio fragmento de JS
const SessionProviders = dynamic(() => import("./session-providers"))

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/") return <>{children}</>
  return <SessionProviders>{children}</SessionProviders>
}
