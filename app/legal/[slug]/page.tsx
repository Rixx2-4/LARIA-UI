"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PlenumLogo } from "@/app/components/plenum-logo"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { ApiError, lariaAPI, type LegalDocument } from "@/lib/laria-api"
import { LEGAL_DOCUMENTS, legalHref } from "@/lib/routes"
import { formatVersion, markGaps, withoutTitle } from "@/lib/legal"

// Términos, privacidad y cookies: el texto lo publica el backend (GET /legal/{slug},
// público). Mientras le falten datos, se presenta como borrador

export default function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [doc, setDoc] = useState<LegalDocument | null>(null)
  const [error, setError] = useState<"missing" | "failed" | null>(null)

  const load = useCallback(() => {
    setError(null)
    setDoc(null)
    lariaAPI.legal
      .get(slug)
      .then(setDoc)
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "missing" : "failed"))
  }, [slug])
  useEffect(() => {
    // Carga al abrir (y al cambiar de documento): el estado se actualiza tras la respuesta
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  useEffect(() => {
    if (doc) document.title = `${doc.title} · Plenum`
  }, [doc])

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Plenum, página de inicio">
            <PlenumLogo className="h-9" />
          </Link>
          <nav aria-label="Documentos legales" className="flex gap-4 text-sm">
            {LEGAL_DOCUMENTS.map((item) => (
              <Link
                key={item.slug}
                href={legalHref(item.slug)}
                aria-current={item.slug === slug ? "page" : undefined}
                className="py-2 text-muted-foreground hover:text-foreground md:py-0 aria-[current=page]:font-medium aria-[current=page]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {error === "missing" && (
          <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="font-medium">Este documento no existe.</p>
            <p className="text-sm text-muted-foreground">Elige uno de los de arriba.</p>
          </div>
        )}
        {error === "failed" && (
          <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="font-medium">No se pudo cargar el documento.</p>
            <p className="text-sm text-muted-foreground">Puede que el servidor esté arrancando. Prueba de nuevo en unos segundos.</p>
            <Button size="sm" onClick={load}>
              Reintentar
            </Button>
          </div>
        )}
        {!doc && !error && (
          <div role="status" aria-label="Cargando el documento" className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}
        {doc && (
          <article className="space-y-6">
            {!doc.completo && (
              <div role="note" className="flex gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm">
                <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">Borrador</p>
                  <p className="text-muted-foreground">
                    Este texto aún no es definitivo: le {doc.pendiente.length === 1 ? "falta 1 dato" : `faltan ${doc.pendiente.length} datos`}, marcados como
                    «Pendiente».
                  </p>
                </div>
              </div>
            )}
            <h1 className="text-balance text-3xl font-semibold tracking-tight">{doc.title}</h1>
            <div className="message-text space-y-3 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
                {markGaps(withoutTitle(doc.markdown))}
              </ReactMarkdown>
            </div>
            <p className="text-xs text-muted-foreground">Versión del {formatVersion(doc.version)}</p>
          </article>
        )}

        <Link href="/" className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}

// Un documento, no un mensaje: con su jerarquía de títulos (el del chat los aplana)
const MARKDOWN: Components = {
  h1: ({ children }) => <h2 className="mt-8 text-xl font-semibold">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-8 text-xl font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 text-base font-semibold">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  a: ({ href, children }) => (
    <a href={href} className="underline underline-offset-2 hover:text-foreground">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left">
        {children}
      </table>
    </div>
  ),
}
