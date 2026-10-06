"use client"

import type { ReactNode } from "react"
import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import "@clerk/ui/themes/shadcn.css"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import { clerkLocalization } from "@/lib/clerk-localization"
import { clerkConfigured, clerkPublishableKey } from "@/lib/clerk-config"
import { NEW_CHAT_HREF, SIGN_IN_HREF, SIGN_UP_HREF } from "@/lib/routes"
import { ClerkBridge, NoAuthBridge } from "./clerk-bridge"
import { OnboardingTour } from "./onboarding-tour"

// La sesión de la app: Clerk (entrar, registrarse, perfil; tras entrar, al chat),
// quién eres en Plenum y tus chats. Se carga aparte (AppProviders) para que la
// portada, que no la necesita, no baje Clerk. Sin su clave, la app sigue en pie,
// sin sesión
export default function SessionProviders({ children }: { children: ReactNode }) {
  const app = (
    <AuthProvider>
      <ChatProvider>
        {children}
        {/* La primera vez que se entra: LARIA presenta la app */}
        <OnboardingTour />
      </ChatProvider>
    </AuthProvider>
  )
  if (!clerkConfigured) {
    return (
      <>
        <NoAuthBridge />
        {app}
      </>
    )
  }
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      localization={clerkLocalization}
      appearance={{ theme: shadcn }}
      signInUrl={SIGN_IN_HREF}
      signUpUrl={SIGN_UP_HREF}
      signInFallbackRedirectUrl={NEW_CHAT_HREF}
      signUpFallbackRedirectUrl={NEW_CHAT_HREF}
      afterSignOutUrl="/"
    >
      <ClerkBridge />
      {app}
    </ClerkProvider>
  )
}
