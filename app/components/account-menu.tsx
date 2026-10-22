"use client"

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { BrainCircuit, CircleHelp, LogOut, Monitor, Moon, Sun, UserCog } from "lucide-react"
import { useAuth } from "@/app/contexts/auth-context"
import { replayOnboarding } from "@/lib/onboarding"
import { PROFILE_HREF, ACCOUNT_HREF } from "@/lib/routes"

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
            {/* A 320px el menú es más estrecho: sin sitio para el icono, solo el nombre */}
            <Icon className="h-3.5 w-3.5 shrink-0 max-[359px]:hidden" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// Separación entre el botón Cuenta y el menú (antes ml-2)
const MENU_GAP_PX = 8

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
    // Sin desplazar: el contenedor de la app (overflow-hidden) se movería y ocultaría parte de la página
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true })
    return () => previous?.focus({ preventScroll: true })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [isOpen, onClose])

  // Fijo en pantalla, al lado de la barra y con el borde inferior a la altura del botón:
  // hacia abajo se salía de la pantalla, y más abajo tapa la caja de texto del chat. Fijo y
  // no absoluto para que no lo recorte la columna de iconos, que en ventanas bajas se
  // desplaza por dentro
  useLayoutEffect(() => {
    const panel = panelRef.current
    const anchor = panel?.parentElement
    if (!isOpen || !panel || !anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const left = rect.right + MENU_GAP_PX
      panel.style.left = `${left}px`
      // En móviles estrechos (320px) no caben sus 288px al lado de la barra
      panel.style.maxWidth = `${window.innerWidth - left - MENU_GAP_PX}px`
      panel.style.bottom = `${Math.max(MENU_GAP_PX * 2, window.innerHeight - rect.top + MENU_GAP_PX)}px`
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Por encima de la barra lateral (z-50), para que un clic en ella también cierre */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Menú de cuenta"
        className="fixed z-[70] max-h-[calc(100dvh-2rem)] w-72 overflow-y-auto rounded-lg border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="truncate text-sm font-medium">{user?.username}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <div className="p-2">
          <Link
            href={PROFILE_HREF}
            onClick={() => {
              onClose()
              onNavigate?.()
            }}
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <BrainCircuit className="h-4 w-4 shrink-0" />
            Perfil de aprendizaje
          </Link>
          <Link
            href={ACCOUNT_HREF}
            onClick={() => {
              onClose()
              onNavigate?.()
            }}
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <UserCog className="h-4 w-4 shrink-0" />
            Gestionar cuenta
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose()
              onNavigate?.()
              replayOnboarding()
            }}
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <CircleHelp className="h-4 w-4 shrink-0" />
            Ver el tutorial de nuevo
          </button>
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
