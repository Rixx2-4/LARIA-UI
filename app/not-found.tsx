import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PlenumLogo } from "./components/plenum-logo"
import { NEW_CHAT_HREF } from "@/lib/routes"

export const metadata: Metadata = {
  title: "Página no encontrada",
}

// Cualquier dirección que no existe: en español, con la marca y una salida clara
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-16 text-center">
      <Link href="/" aria-label="Plenum, página de inicio" className="text-foreground">
        <PlenumLogo className="h-12" />
      </Link>

      {/* Dibujo en negro sobre transparente: en modo oscuro se invierte a trazo blanco */}
      <Image
        src="/images/laria-mascota.png"
        width={369}
        height={480}
        alt=""
        preload
        className="h-52 w-auto select-none dark:invert sm:h-64"
      />

      <div className="max-w-md">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          No encontramos esta página
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Puede que el enlace esté mal escrito o que la página ya no exista. LARIA te espera en el inicio.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al inicio
        </Link>
        <Link
          href={NEW_CHAT_HREF}
          className="rounded-md px-5 py-3 text-sm font-medium underline-offset-4 hover:underline"
        >
          Ir al chat
        </Link>
      </div>
    </main>
  )
}
