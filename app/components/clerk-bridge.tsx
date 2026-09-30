"use client"

import { useEffect } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import { setSession, setSignOutHandler } from "@/lib/laria-api"

// Publica la sesión de Clerk para el cliente de la API (lib/laria-api): si hay
// sesión y cómo pedir el token. Así el resto de la app no depende de Clerk
export function ClerkBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerk = useClerk()

  useEffect(() => {
    if (!isLoaded) setSession("loading")
    else if (isSignedIn) setSession("signed-in", (options) => getToken(options))
    else setSession("signed-out")
  }, [isLoaded, isSignedIn, getToken])

  useEffect(() => {
    // Al salir, a la página de inicio
    setSignOutHandler(() => clerk.signOut({ redirectUrl: "/" }))
    return () => setSignOutHandler(null)
  }, [clerk])

  return null
}
