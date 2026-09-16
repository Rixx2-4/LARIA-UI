"use client"
import { Sidebar } from "./sidebar"
import { SearchBar } from "./search-bar"
import { useAuth } from "@/app/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function Search() {
  const { user, logout } = useAuth()

  return (
    <>
      <Sidebar />

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
                <>
                  <span className="text-sm text-muted-foreground">{user?.username}</span>
                  <Button variant="ghost" size="sm" onClick={logout} className="rounded-full text-muted-foreground transition-all duration-200 hover:text-foreground">
                    <LogOut data-icon="inline-start" />
                    Salir
                  </Button>
                </>
              </div>
            </header>

            <SearchBar />
          </div>
        </div>
      </main>

    </>
  )
}
