import type React from "react"
import type { Metadata } from "next"
import "katex/dist/katex.min.css"
import "./globals.css"
import { ChatProvider } from "./contexts/chat-context"
import { AuthProvider } from "./contexts/auth-context"
import { ThemeProvider } from "next-themes"
import { ThemedToaster } from "./components/themed-toaster"
import { ClerkProvider } from "@clerk/nextjs"
import { clerkLocalization } from "@/lib/clerk-localization"
import { shadcn } from "@clerk/ui/themes"
import { ClerkBridge, NoAuthBridge } from "./components/clerk-bridge"
import { clerkConfigured, clerkPublishableKey } from "@/lib/clerk-config"
import { SIGN_IN_HREF, SIGN_UP_HREF, NEW_CHAT_HREF } from "@/lib/routes"

export const metadata: Metadata = {
  title: { default: "Plenum", template: "%s · Plenum" },
  description: "Plenum: estudia con LARIA, un tutor con IA. Pregunta, sube tus apuntes y practica con quizzes.",
  openGraph: {
    title: "Plenum",
    description: "Estudia con LARIA, un tutor con IA: pregunta, sube tus apuntes y practica con quizzes.",
    locale: "es_ES",
    type: "website",
  },

  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const app = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <ChatProvider>
          {children}
          <ThemedToaster />
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  )

  return (
    // next-themes pone la clase del tema en <html> antes de hidratar
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        {/* Clerk lleva la cuenta (entrar, registrarse, perfil); tras entrar, al chat.
            Sin su clave, la app sigue en pie, sin sesión */}
        {clerkConfigured ? (
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
        ) : (
          <>
            <NoAuthBridge />
            {app}
          </>
        )}
      </body>
    </html>
  )
}
