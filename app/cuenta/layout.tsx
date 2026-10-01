import type { ReactNode } from "react"
import type { Metadata } from "next"

// La página es de cliente y no puede exportar metadata: el título de la pestaña va aquí
export const metadata: Metadata = { title: "Cuenta" }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
