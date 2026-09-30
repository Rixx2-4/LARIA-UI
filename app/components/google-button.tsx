"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { lariaAPI } from "@/lib/laria-api"

// «Continuar con Google» con Google Identity Services: Google pinta su botón y, al
// elegir la cuenta, devuelve un ID token que el backend cambia por una sesión.
// El client id lo da el backend (/auth/providers); sin él, no hay botón.

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleIdentity {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void; ux_mode?: "popup" }) => void
  renderButton: (
    parent: HTMLElement,
    options: { type?: "standard"; theme?: "outline" | "filled_black"; size?: "large"; text?: "continue_with"; shape?: "pill"; width?: number; locale?: string },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } }
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client"
let gsiScript: Promise<GoogleIdentity> | null = null

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  gsiScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GSI_SRC
    script.async = true
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google no respondió")))
    script.onerror = () => {
      gsiScript = null
      reject(new Error("No se pudo cargar el acceso con Google"))
    }
    document.head.appendChild(script)
  })
  return gsiScript
}

// Pide el client id una vez y, si lo hay, deja listo Google Identity Services
export function useGoogleSignIn() {
  const [clientId, setClientId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    lariaAPI.auth.providers().then(({ google_client_id }) => !cancelled && setClientId(google_client_id))
    return () => {
      cancelled = true
    }
  }, [])
  return clientId
}

interface GoogleButtonProps {
  clientId: string
  onCredential: (idToken: string) => void
  onError?: (message: string) => void
}

export function GoogleButton({ clientId, onCredential, onError }: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  // El callback de Google se fija al iniciar: con una ref siempre llama al último
  const onCredentialRef = useRef(onCredential)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onCredentialRef.current = onCredential
    onErrorRef.current = onError
  })

  useEffect(() => {
    let cancelled = false
    loadGoogleIdentity()
      .then((gsi) => {
        const container = containerRef.current
        if (cancelled || !container) return
        gsi.initialize({ client_id: clientId, callback: ({ credential }) => onCredentialRef.current(credential), ux_mode: "popup" })
        container.replaceChildren()
        gsi.renderButton(container, {
          type: "standard",
          theme: resolvedTheme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          // Google admite de 200 a 400 px
          width: Math.max(200, Math.min(400, Math.round(container.getBoundingClientRect().width))),
          locale: "es",
        })
      })
      .catch((error: Error) => !cancelled && onErrorRef.current?.(error.message))
    return () => {
      cancelled = true
    }
  }, [clientId, resolvedTheme])

  return <div ref={containerRef} className="flex min-h-11 w-full justify-center" data-testid="google-button" />
}
