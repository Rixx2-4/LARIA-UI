"use client"

import { useEffect } from "react"
import Link from "next/link"
import { BrainCircuit, LogOut } from "lucide-react"
import { useAuth } from "@/app/contexts/auth-context"

interface AccountMenuProps {
  isOpen: boolean
  onClose: () => void
  // Avisa de que se eligió un destino (el cajón móvil se cierra)
  onNavigate?: () => void
}

export function AccountMenu({ isOpen, onClose, onNavigate }: AccountMenuProps) {
  const { user, logout } = useAuth()

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Por encima de la barra lateral (z-50), para que un clic en ella también cierre */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Menú de cuenta"
        className="fixed bottom-20 left-4 z-[70] w-72 rounded-lg border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="truncate text-sm font-medium">{user?.username}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <div className="p-2">
          <Link
            href="/perfil"
            onClick={() => {
              onClose()
              onNavigate?.()
            }}
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <BrainCircuit className="h-4 w-4 shrink-0" />
            Perfil de aprendizaje
          </Link>
          <button
            onClick={() => {
              onClose()
              logout()
            }}
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )
}
