import type { Metadata } from "next"

// La página es de cliente y no puede exportar metadata: el título de la pestaña va
// aquí (al cargar, la página pone el del documento)
export const metadata: Metadata = { title: "Legal" }

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children
}
