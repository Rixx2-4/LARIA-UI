"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMotionValueEvent, useScroll } from "motion/react"
import { getSessionState, onSessionChange } from "@/lib/laria-api"
import { PlenumLogo } from "../plenum-logo"
import { NEW_CHAT_HREF, SIGN_IN_HREF, SIGN_UP_HREF } from "@/lib/routes"

const SECTIONS = [
  { href: "#como-funciona", label: "Cómo empezar" },
  { href: "#como-se-adapta", label: "Cómo se adapta" },
  { href: "#antes-de-empezar", label: "Antes de empezar" },
  { href: "#preguntas", label: "Preguntas" },
]

export function LandingHeader() {
  const router = useRouter()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8))

  // Quien ya tiene sesión viene a estudiar, no a leer la presentación
  useEffect(() => {
    const goIfSignedIn = () => {
      if (getSessionState() === "signed-in") router.replace(NEW_CHAT_HREF)
    }
    goIfSignedIn()
    // Clerk tarda un momento en saber si hay sesión
    return onSessionChange(goIfSignedIn)
  }, [router])

  return (
    <header
      className={`sticky top-0 z-40 bg-paper/90 backdrop-blur transition-[border-color] duration-300 ${
        scrolled ? "border-b border-foreground/10" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="Plenum, inicio">
          <PlenumLogo className="h-10 sm:h-12" />
        </Link>

        <nav aria-label="Secciones" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {SECTIONS.map((section) => (
            <a key={section.href} href={section.href} className="transition-colors hover:text-foreground">
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link href={SIGN_IN_HREF} className="rounded-md px-3 py-2 font-medium transition-colors hover:bg-foreground/5">
            Entrar
          </Link>
          <Link
            href={SIGN_UP_HREF}
            className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  )
}
