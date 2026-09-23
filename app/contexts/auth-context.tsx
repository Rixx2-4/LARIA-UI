"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { lariaAPI, User, setAuthToken, getAuthToken } from "@/lib/laria-api"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasToken, setHasToken] = useState(false)

  const loadUser = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    setHasToken(true)

    try {
      const userData = await lariaAPI.auth.me()
      setUser(userData)
    } catch (error) {
      console.error("Error loading user:", error)
      const status = (error as Error & { status?: number }).status
      if (status === 401) {
        setAuthToken(null)
        setUser(null)
        setHasToken(false)
      }
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

  const login = useCallback(async (email: string, password: string) => {
    await lariaAPI.auth.login(email, password)
    setHasToken(true)
    const userData = await lariaAPI.auth.me()
    setUser(userData)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    await lariaAPI.auth.register(username, email, password)
    await login(email, password)
  }, [login])

  const logout = useCallback(() => {
    lariaAPI.auth.logout()
    setUser(null)
    setHasToken(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user || hasToken,
        isLoading,
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
