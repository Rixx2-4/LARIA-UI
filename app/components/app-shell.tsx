"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/app/contexts/auth-context"
import { Sidebar } from "./sidebar"

// Estructura común de las páginas: barra lateral (cajón en móvil), cabecera y contenido
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Al navegar desde el cajón, se cierra solo
  const [drawerPath, setDrawerPath] = useState(pathname)
  if (drawerPath !== pathname) {
    setDrawerPath(pathname)
    setDrawerOpen(false)
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full animate-in slide-in-from-left duration-200">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2 md:px-6 md:py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir menú"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">LARIA</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] md:text-xs font-semibold text-primary-foreground">
              IA
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm text-muted-foreground">{user?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="rounded-full text-muted-foreground transition-all duration-200 hover:text-foreground">
              <LogOut data-icon="inline-start" />
              Salir
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
