import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { ThemedToaster } from "./components/themed-toaster"
import { AppProviders } from "./components/app-providers"

// Las fuentes se sirven desde el propio dominio (next/font), sin pedir nada a
// Google al cargar y sin bloquear el primer pintado (display: swap)
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" })
// La monoespaciada solo aparece en bloques de código: no se precarga
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false })

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
  return (
    // next-themes pone la clase del tema en <html> antes de hidratar
    <html lang="es" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppProviders>{children}</AppProviders>
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
