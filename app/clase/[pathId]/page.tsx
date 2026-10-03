"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Check, Circle, CircleDot, Lock, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/app/components/app-shell"
import { RequireAuth } from "@/app/components/require-auth"
import { LariaMascot } from "@/app/components/laria-mascot"
import { ClassBoard } from "../class-board"
import { QuestionStep, ResultsList, toResults } from "@/app/quiz/quiz-parts"
import { useSpeech } from "@/hooks/use-speech"
import { useStudyTime } from "@/hooks/use-study-time"
import { ClassStudyBar } from "@/app/components/study-progress"
import { NextSuggestions } from "@/app/components/next-suggestions"
import { ApiError, lariaAPI, type CheckResponse, type LearningPath, type PathModule, type QuizResponse } from "@/lib/laria-api"
import { NEW_CHAT_HREF, placementHref } from "@/lib/routes"

// La clase guiada de una ruta: explicación de un concepto, una comprobación corta y,
// según cómo salga, el siguiente concepto, otra explicación o un repaso previo.
// El backend decide el paso; recargar es seguro (devuelve la misma comprobación pendiente)

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string; needsPlacement: boolean }
  | { kind: "lesson"; markdown: string; check: QuizResponse }
  | { kind: "result"; result: CheckResponse; check: QuizResponse }
  | { kind: "completed" }

export default function ClasePage() {
  return (
    <RequireAuth>
      <Clase />
    </RequireAuth>
  )
}

const OUTCOME: Record<CheckResponse["outcome"], string> = {
  understood: "¡Entendido!",
  partial: "Casi lo tienes",
  not_understood: "Todavía no",
}

function Clase() {
  const { pathId } = useParams<{ pathId: string }>()
  const [path, setPath] = useState<LearningPath | null>(null)
  const [view, setView] = useState<View>({ kind: "loading" })
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const speech = useSpeech()
  // El tiempo de estudio (cuenta también mientras LARIA explica, aunque no se toque nada)
  const { summary: studySummary, sessionSeconds } = useStudyTime({ busy: !!speech.speaking })

  const loadLesson = useCallback(async () => {
    setView({ kind: "loading" })
    setCurrent(0)
    setAnswers({})
    setCheckError(null)
    try {
      const lesson = await lariaAPI.paths.lesson(pathId)
      setPath(lesson.path)
      if (lesson.check) setView({ kind: "lesson", markdown: lesson.markdown ?? "", check: lesson.check })
      else if (lesson.path.teaching?.phase === "completed") setView({ kind: "completed" })
      else setView({ kind: "error", message: "No hay ninguna lección preparada ahora mismo.", needsPlacement: false })
    } catch (error) {
      // 409: el tema aún no tiene nivelación. La ruta se pide aparte para saber qué tema es
      const needsPlacement = error instanceof ApiError && error.status === 409
      if (needsPlacement) lariaAPI.paths.get(pathId).then(setPath).catch(() => {})
      setView({ kind: "error", message: error instanceof Error ? error.message : "No se pudo preparar la lección", needsPlacement })
    }
  }, [pathId])

  useEffect(() => {
    // Al abrir (o recargar) se retoma donde se quedó
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLesson()
  }, [loadLesson])

  // La lectura de la pizarra se corta al salir de la clase
  const { stop: stopSpeech } = speech
  useEffect(() => stopSpeech, [stopSpeech])

  const submit = async () => {
    if (view.kind !== "lesson") return
    const { check } = view
    setSubmitting(true)
    setCheckError(null)
    try {
      const result = await lariaAPI.paths.check(pathId, check.id, answers)
      speech.stop()
      setPath(result.path)
      setView({ kind: "result", result, check })
    } catch (error) {
      // 409: esa comprobación ya no está pendiente (p. ej. se respondió en otra pestaña)
      if (error instanceof ApiError && error.status === 409) return loadLesson()
      setCheckError(error instanceof Error ? error.message : "No se pudieron enviar tus respuestas")
    } finally {
      setSubmitting(false)
    }
  }

  const title = path?.title || path?.topic || "Tu clase"
  const teaching = path?.teaching

  return (
    <AppShell>
      <div className="h-full overflow-auto">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr]">
          {path && <PathOutline path={path} />}

          <main className="min-w-0 space-y-6 lg:col-start-2">
            <ClassStudyBar summary={studySummary} sessionSeconds={sessionSeconds} />
            <header className="space-y-1">
              <p className="text-sm text-muted-foreground">Clase · {title}</p>
              {teaching?.concept_title && view.kind !== "completed" && (
                <h1 className="text-2xl font-semibold tracking-tight">{teaching.concept_title}</h1>
              )}
            </header>

            {view.kind === "loading" && (
              <div role="status" className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <LariaMascot state="thinking" className="w-24" />
                <p className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  Preparando tu lección…
                </p>
                <p className="text-sm">Suele tardar unos segundos.</p>
              </div>
            )}

            {view.kind === "error" && (
              <div role="alert" className="space-y-4 rounded-xl border border-border bg-card p-5">
                <p>{view.message}</p>
                {view.needsPlacement ? (
                  <Button asChild>
                    <Link href={placementHref(path?.topic ?? path?.title ?? undefined)}>Hacer la nivelación</Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={loadLesson} className="gap-2">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Reintentar
                  </Button>
                )}
              </div>
            )}

            {view.kind === "lesson" && (
              <>
                {/* Por qué toca esto ahora: otra explicación, un repaso previo… */}
                {teaching?.reason && <p className="rounded-lg bg-muted px-4 py-3 text-sm">{teaching.reason}</p>}
                {/* La explicación en la pizarra; la comprobación aparece cuando está entera */}
                <ClassBoard key={view.check.id} lessonKey={`clase:${pathId}:${view.check.id}`} markdown={view.markdown} speech={speech}>
                  <section aria-labelledby="comprobacion" className="space-y-4 border-t border-border pt-6">
                    <h2 id="comprobacion" className="text-lg font-medium">
                      Comprueba lo que has aprendido
                    </h2>
                    {view.check.questions[current] && (
                      <QuestionStep
                        questions={view.check.questions}
                        current={current}
                        answers={answers}
                        onAnswer={(question, letter) => setAnswers((prev) => ({ ...prev, [question.index]: letter }))}
                        onPrev={() => setCurrent((n) => Math.max(0, n - 1))}
                        onNext={() => (current < view.check.questions.length - 1 ? setCurrent((n) => n + 1) : submit())}
                        isSubmitting={submitting}
                        error={checkError}
                      />
                    )}
                  </section>
                </ClassBoard>
              </>
            )}

            {view.kind === "result" && (
              <section aria-live="polite" className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">{OUTCOME[view.result.outcome]}</h2>
                  <p className="text-sm text-muted-foreground">
                    Acertaste {view.result.questions.filter((q) => q.is_correct).length} de {view.result.questions.length}.
                  </p>
                </div>
                <ResultsList results={toResults(view.check.questions, view.result.questions)} />
                {view.result.next.reason && <p className="rounded-lg bg-muted px-4 py-3 text-sm">{view.result.next.reason}</p>}
                <Button onClick={loadLesson}>Continuar</Button>
              </section>
            )}

            {view.kind === "completed" && (
              <section className="space-y-4 rounded-xl border border-border bg-card p-6">
                <h1 className="text-2xl font-semibold">¡Ruta completada!</h1>
                <p className="text-muted-foreground">
                  Has terminado la ruta de {title}. Puedes seguir preguntando a LARIA en el chat o ver tu progreso en el perfil.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={NEW_CHAT_HREF}>Ir al chat</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/perfil">Ver mi progreso</Link>
                  </Button>
                </div>
              </section>
            )}

            {view.kind === "completed" && (
              <NextSuggestions pathId={pathId} />
            )}
          </main>
        </div>
      </div>
    </AppShell>
  )
}

const MODULE_STATUS: Record<PathModule["status"], string> = {
  completed: "Hecho",
  in_progress: "En curso",
  available: "Disponible",
  locked: "Bloqueado",
  assumed: "Se da por sabido",
}

function ModuleIcon({ status }: { status: PathModule["status"] }) {
  if (status === "completed" || status === "assumed") return <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden />
  if (status === "in_progress") return <CircleDot className="h-4 w-4 text-primary" aria-hidden />
  if (status === "locked") return <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
}

// La ruta entera con el estado de cada módulo; en móvil, plegada
function PathOutline({ path }: { path: LearningPath }) {
  const modules = [...path.modules].sort((a, b) => a.position - b.position)
  const done = modules.filter((m) => m.status === "completed" || m.status === "assumed").length
  return (
    <aside aria-label="Tu ruta" className="lg:row-span-2">
      <details open className="group rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
        <summary className="cursor-pointer list-none text-sm font-medium">
          Tu ruta · {done} de {modules.length}
        </summary>
        <ol className="mt-3 space-y-2">
          {modules.map((module) => {
            const current = module.concept === path.teaching?.concept
            return (
              <li
                key={module.concept}
                aria-current={current ? "step" : undefined}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${current ? "bg-primary/10" : ""}`}
              >
                <span className="mt-0.5 shrink-0">
                  <ModuleIcon status={module.status} />
                </span>
                <span className="min-w-0">
                  <span className={`block ${module.status === "locked" ? "text-muted-foreground" : ""}`}>{module.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {MODULE_STATUS[module.status]}
                    {module.kind === "prerequisite" && " · Repaso previo"}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </details>
    </aside>
  )
}
