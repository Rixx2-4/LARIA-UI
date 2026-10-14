"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, useSyncExternalStore, ReactNode } from "react"
import { lariaAPI, ApiError, User, getSessionState, isServerUnavailable, onSessionChange, onUnauthorized, signOut } from "@/lib/laria-api"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  // Hay sesión pero no se pudo cargar el usuario (sin conexión, o el backend lo rechaza)
  connectionError: string | null
  // El servidor no responde aún (Render lo despierta tras dormirse): se sigue
  // intentando. Es la hora del primer fallo, para enseñar cuánto lleva esperando
  wakingSince: number | null
  // Con sesión, esperando a que el servidor diga quién eres
  loadingUser: boolean
  retry: () => Promise<void>
  logout: () => void
}

// Cuánto se espera a que el servidor despierte antes de darlo por caído: Render
// tarda de 30 a 60 s en arrancar uno dormido, y en sus caídas cuelga hasta ~100 s
export const WAKE_DEADLINE_MS = 90_000
const WAKE_DELAYS_MS = [2_000, 4_000, 8_000, 15_000]
export const SERVER_DOWN_MESSAGE = "El servidor no responde. Puede ser una caída temporal del proveedor."

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Entrar y salir lo lleva Clerk (ClerkBridge publica la sesión en lib/laria-api);
// aquí se carga quién eres en Plenum: el usuario del backend, con sus chats y su perfil
export function AuthProvider({ children }: { children: ReactNode }) {
  // En el servidor aún no se sabe: Clerk lo dice ya en el navegador
  const session = useSyncExternalStore(onSessionChange, getSessionState, () => "loading" as const)
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [wakingSince, setWakingSince] = useState<number | null>(null)
  // Cada carga tiene su generación: reintentar o cerrar sesión deja de esperar a la anterior
  const loadGenRef = useRef(0)

  const loadUser = useCallback(async () => {
    const gen = ++loadGenRef.current
    const current = () => gen === loadGenRef.current
    setLoadingUser(true)
    setConnectionError(null)
    setWakingSince(null)
    // Sin sesión (p. ej. se cerró en otra pestaña) no hay usuario que cargar
    if (getSessionState() !== "signed-in") {
      setLoadingUser(false)
      return
    }
    const started = Date.now()
    try {
      // Si el servidor no está (dormido o en una caída), se insiste con esperas
      // crecientes hasta el tope; los rechazos de verdad (401, 403…) no se repiten
      for (let attempt = 0; ; attempt++) {
        try {
          const loaded = await lariaAPI.auth.me()
          if (current()) setUser(loaded)
          return
        } catch (error) {
          // Ya no hay sesión (se cerró en otra pestaña): nada que cargar ni esperar
          if (!current() || getSessionState() !== "signed-in") return
          // Un 401 ya cerró la sesión (onUnauthorized). El backend explica sus rechazos
          // (correo sin verificar, Clerk no responde…)
          if (error instanceof ApiError && error.status === 401) return
          if (!isServerUnavailable(error)) {
            setConnectionError(error instanceof ApiError ? error.message : "No se pudo conectar con Plenum")
            return
          }
          const delay = WAKE_DELAYS_MS[Math.min(attempt, WAKE_DELAYS_MS.length - 1)]
          if (Date.now() - started + delay > WAKE_DEADLINE_MS) {
            setConnectionError(SERVER_DOWN_MESSAGE)
            return
          }
          setWakingSince((since) => since ?? started)
          await sleep(delay)
          if (!current() || getSessionState() !== "signed-in") return
        }
      }
    } finally {
      if (current()) {
        setLoadingUser(false)
        setWakingSince(null)
      }
    }
  }, [])

  useEffect(() => {
    // La sesión acaba de empezar: se carga el usuario desde aquí
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session === "signed-in") loadUser()
  }, [session, loadUser])

  const logout = useCallback(() => {
    signOut()
  }, [])

  // Cualquier petición que reciba un 401 (ya con un token nuevo) cierra la sesión
  useEffect(() => onUnauthorized(logout), [logout])

  // Sin sesión no cuenta lo que quedara de la anterior
  const signedIn = session === "signed-in"
  const currentUser = signedIn ? user : null
  const currentError = signedIn ? connectionError : null
  const isAuthenticated = !!currentUser
  const isLoading = session === "loading" || (signedIn && !user && !connectionError) || (signedIn && loadingUser)

  return (
    <AuthContext.Provider
      value={{ user: currentUser, isAuthenticated, isLoading, connectionError: currentError, wakingSince: signedIn ? wakingSince : null, loadingUser: signedIn && loadingUser, retry: loadUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
