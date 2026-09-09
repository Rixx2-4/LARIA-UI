"use client"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { SearchBar } from "./search-bar"
import { AuthModal } from "./auth-modal"
import { useAuth } from "@/app/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { LogIn, LogOut } from "lucide-react"

export function Search() {
  const { isAuthenticated, user, logout } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <>
      <Sidebar onRequireAuth={() => setShowAuthModal(true)} />

      {/* Main Content */}
      <main className="flex flex-1 flex-col bg-background">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 md:px-6 pt-16 md:pt-0">
          <div className="w-full max-w-3xl space-y-6 md:space-y-8">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-0">
                <span className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">LARIA</span>
                <span className="ml-1 rounded-full bg-teal-600 px-2 md:px-2.5 py-0.5 text-[10px] md:text-xs font-semibold text-white">
                  IA
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {isAuthenticated ? (
                  <>
                    <span className="text-sm text-muted-foreground">{user?.username}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Salir
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuthModal(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Iniciar sesión
                  </Button>
                )}
              </div>
            </header>

            <SearchBar onRequireAuth={() => setShowAuthModal(true)} />
          </div>
        </div>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  )
}
