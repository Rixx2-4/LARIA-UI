"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { LariaMascot } from "../components/laria-mascot"
import { ForgettingCurve } from "./forgetting-curve"
import { ReviewPractice } from "./review-practice"
import { useReviewAgenda } from "@/hooks/use-review-agenda"
import { lariaAPI, type RetentionCurve, type ReviewItem } from "@/lib/laria-api"
import { dueCount, isDue, percent, statusLabel } from "@/lib/reviews"
import { CLASSES_HREF, classHref } from "@/lib/routes"

// La agenda de repasos (ADR-051): qué conviene repasar hoy para no olvidarlo y qué
// viene después. Las fechas salen de un modelo de la memoria: se dice que es una
// estimación. Repasar es volver a la clase (que prioriza el repaso) o, si el concepto
// no está en ninguna, unas preguntas de práctica aquí mismo
export default function RepasosPage() {
  return (
    <RequireAuth>
      <Repasos />
    </RequireAuth>
  )
}

function Repasos() {
  const { agenda, failed, reload } = useReviewAgenda()
  const due = agenda?.items.filter(isDue) ?? []
  const upcoming = agenda?.items.filter((item) => !isDue(item)) ?? []
  const total = agenda ? agenda.counts.overdue + agenda.counts.today + agenda.counts.upcoming : 0

  return (
    <AppShell>
      <div className="relative h-full overflow-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Repasos</h1>
            <p className="text-sm text-muted-foreground">
              Lo que conviene repasar para no olvidarlo. Las fechas son una estimación de tu memoria, no una medida exacta.
            </p>
          </header>

          {!agenda && !failed && (
            <div role="status" aria-label="Cargando tus repasos" className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          )}

          {failed && !agenda && (
            <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <p>No se pudieron cargar tus repasos.</p>
              <Button variant="outline" onClick={reload} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Reintentar
              </Button>
            </div>
          )}

          {agenda && total === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <LariaMascot emotion="encouraging" className="w-24" />
              <div className="space-y-1.5">
                <p className="text-lg font-medium">Aún no hay nada que repasar</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Cuando respondas comprobaciones de clase, quizzes o nivelaciones, aquí verás qué repasar y cuándo.
                </p>
              </div>
              <Button asChild>
                <Link href={CLASSES_HREF}>Ir a mis clases</Link>
              </Button>
            </div>
          )}

          {agenda && total > 0 && (
            <>
              <section aria-labelledby="para-hoy" className="space-y-3">
                <h2 id="para-hoy" className="text-lg font-semibold">
                  Para hoy <span className="font-normal text-muted-foreground">· {dueCount(agenda)}</span>
                </h2>
                {due.length ? (
                  <ul className="space-y-3">
                    {due.map((item) => (
                      <ReviewRow key={item.concept} item={item} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    Nada pendiente hoy: vas al día.
                  </p>
                )}
              </section>

              {upcoming.length > 0 && (
                <section aria-labelledby="proximos" className="space-y-3">
                  <h2 id="proximos" className="text-lg font-semibold">
                    Próximos <span className="font-normal text-muted-foreground">· {agenda.counts.upcoming}</span>
                  </h2>
                  <ul className="space-y-3">
                    {upcoming.map((item) => (
                      <ReviewRow key={item.concept} item={item} />
                    ))}
                  </ul>
                </section>
              )}

              {agenda.items.length < total && (
                <p className="text-xs text-muted-foreground">
                  Se muestran {agenda.items.length} de {total}: los más urgentes primero.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

type CurveState = { kind: "closed" } | { kind: "loading" } | { kind: "ready"; curve: RetentionCurve } | { kind: "error" }

function ReviewRow({ item }: { item: ReviewItem }) {
  const [curve, setCurve] = useState<CurveState>({ kind: "closed" })
  const [practicing, setPracticing] = useState(false)
  const curveId = `curva-${item.concept}`

  const toggleCurve = async () => {
    if (curve.kind !== "closed" && curve.kind !== "error") return setCurve({ kind: "closed" })
    setCurve({ kind: "loading" })
    try {
      setCurve({ kind: "ready", curve: await lariaAPI.learning.reviewCurve(item.concept) })
    } catch {
      setCurve({ kind: "error" })
    }
  }

  const due = isDue(item)
  return (
    <li className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-medium">{item.label}</h3>
          <p className={`text-sm ${item.status === "overdue" ? "text-foreground" : "text-muted-foreground"}`}>{statusLabel(item)}</p>
          <p className="text-xs text-muted-foreground">
            Recuerdo estimado: {percent(item.estimated_retention)}
            {item.reviews > 0 && ` · ${item.reviews === 1 ? "1 repaso" : `${item.reviews} repasos`}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.path_id ? (
            <Button asChild size="sm" variant={due ? "default" : "outline"}>
              <Link href={classHref(item.path_id)}>Repasar</Link>
            </Button>
          ) : (
            !practicing && (
              <Button size="sm" variant={due ? "default" : "outline"} onClick={() => setPracticing(true)}>
                Repasar
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleCurve}
            aria-expanded={curve.kind !== "closed"}
            aria-controls={curveId}
            className="gap-1"
          >
            Curva del olvido
            <ChevronDown className={`h-4 w-4 transition-transform ${curve.kind !== "closed" ? "rotate-180" : ""}`} aria-hidden />
          </Button>
        </div>
      </div>

      {curve.kind !== "closed" && (
        <div id={curveId}>
          {curve.kind === "loading" && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Cargando la curva…
            </p>
          )}
          {curve.kind === "error" && (
            <p role="alert" className="text-sm text-muted-foreground">
              No se pudo cargar la curva.{" "}
              <button type="button" onClick={toggleCurve} className="underline underline-offset-2 hover:text-foreground">
                Reintentar
              </button>
            </p>
          )}
          {curve.kind === "ready" && <ForgettingCurve curve={curve.curve} />}
        </div>
      )}

      {practicing && <ReviewPractice topic={item.label} onClose={() => setPracticing(false)} />}
    </li>
  )
}
