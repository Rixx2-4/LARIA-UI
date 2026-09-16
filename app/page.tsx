"use client"

import { Search } from "./components/search-interface"
import { LoginScreen } from "./components/login-screen"
import { useAuth } from "./contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-muted-foreground" /></div>
  }

  return isAuthenticated ? <Search /> : <LoginScreen />
}
