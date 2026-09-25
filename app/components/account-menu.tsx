"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { BrainCircuit, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { useAuth } from "@/app/contexts/auth-context"

const THEMES = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
] as const

// El tema guardado solo se conoce en el navegador: en el servidor no se marca ninguno
const subscribeNothing = () => () => {}
function useIsClient() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false)
}

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const isClient = useIsClient()
  return (
    <div role="group" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {THEMES.map(({ value, label, Icon }) => {
        const checked = isClient && theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={checked}
            onClick={() => setTheme(value)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
              checked ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

interface AccountMenuProps {
  isOpen: boolean
  onClose: () => void
  // Avisa de que se eligió un destino (el cajón móvil se cierra)
  onNavigate?: () => void
}

export function AccountMenu({ isOpen, onClose, onNavigate }: AccountMenuProps) {
  const { user, logout } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)

  // Al abrir, el foco entra en el menú; al cerrar, vuelve a donde estaba (el botón Cuenta)
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus()
    return () => previous?.focus()
  }, [isOpen])

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
        ref={panelRef}
        role="dialog"
        aria-label="Menú de cuenta"
        className="absolute left-full top-0 z-[70] ml-2 w-72 rounded-lg border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
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
        <div className="border-t border-border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tema</p>
          <ThemePicker />
        </div>
      </div>
    </>
  )
}
