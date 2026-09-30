"use client"

import { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore, ReactNode } from "react"
import { lariaAPI, ApiError, User, getSessionState, onSessionChange, onUnauthorized, signOut } from "@/lib/laria-api"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  // Hay sesión pero no se pudo cargar el usuario (sin conexión, o el backend lo rechaza)
  connectionError: string | null
  retry: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Entrar y salir lo lleva Clerk (ClerkBridge publica la sesión en lib/laria-api);
// aquí se carga quién eres en Plenum: el usuario del backend, con sus chats y su perfil
export function AuthProvider({ children }: { children: ReactNode }) {
  // En el servidor aún no se sabe: Clerk lo dice ya en el navegador
  const session = useSyncExternalStore(onSessionChange, getSessionState, () => "loading" as const)
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const loadUser = useCallback(async () => {
    setLoadingUser(true)
    setConnectionError(null)
    try {
      setUser(await lariaAPI.auth.me())
    } catch (error) {
      // Un 401 ya cerró la sesión (onUnauthorized). El backend explica sus rechazos
      // (correo sin verificar, Clerk no responde…); sin respuesta, no hay conexión
      if (error instanceof ApiError && error.status === 401) return
      setConnectionError(error instanceof ApiError ? error.message : "No se pudo conectar con Plenum")
    } finally {
      setLoadingUser(false)
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
    <AuthContext.Provider value={{ user: currentUser, isAuthenticated, isLoading, connectionError: currentError, retry: loadUser, logout }}>
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
