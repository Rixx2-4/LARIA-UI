"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { lariaAPI, User, getAuthToken, onUnauthorized } from "@/lib/laria-api"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  // Hay sesión guardada pero no se pudo comprobar por falta de conexión
  connectionError: string | null
  retry: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const loadUser = useCallback(async () => {
    if (!getAuthToken()) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      setUser(await lariaAPI.auth.me())
      setConnectionError(null)
    } catch (error) {
      // Un 401 ya borró el token y avisó por onUnauthorized
      const status = (error as Error & { status?: number }).status
      if (status !== 401) setConnectionError("No se pudo conectar con LARIA")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // El token vive en localStorage, que solo existe en el cliente: leerlo en el
    // estado inicial rompería la hidratación, así que se lee al montar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser()
  }, [loadUser])

  const logout = useCallback(() => {
    lariaAPI.auth.logout()
    setUser(null)
    setConnectionError(null)
  }, [])

  // Cualquier petición que reciba un 401 cierra la sesión
  useEffect(() => onUnauthorized(logout), [logout])

  const login = useCallback(async (email: string, password: string) => {
    await lariaAPI.auth.login(email, password)
    setUser(await lariaAPI.auth.me())
    setConnectionError(null)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    await lariaAPI.auth.register(username, email, password)
    await login(email, password)
  }, [login])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        connectionError,
        retry: loadUser,
        login,
        register,
        logout,
      }}
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
