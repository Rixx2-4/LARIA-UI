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

  const loadUser = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const userData = await lariaAPI.auth.me()
      setUser(userData)
    } catch (error) {
      console.error("Error loading user:", error)
      setAuthToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = useCallback(async (email: string, password: string) => {
    await lariaAPI.auth.login(email, password)
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
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
