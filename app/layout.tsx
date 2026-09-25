import type React from "react"
import type { Metadata } from "next"
import "katex/dist/katex.min.css"
import "./globals.css"
import { ChatProvider } from "./contexts/chat-context"
import { AuthProvider } from "./contexts/auth-context"
import { ThemeProvider } from "next-themes"
import { ThemedToaster } from "./components/themed-toaster"

export const metadata: Metadata = {
  title: { default: "LARIA", template: "%s · LARIA" },
  description: "LARIA, tu tutor con IA: pregunta, sube tus apuntes y practica con quizzes.",
  openGraph: {
    title: "LARIA",
    description: "Tu tutor con IA: pregunta, sube tus apuntes y practica con quizzes.",
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
  return (
    // next-themes pone la clase del tema en <html> antes de hidratar
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <ChatProvider>
              {children}
              <ThemedToaster />
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
