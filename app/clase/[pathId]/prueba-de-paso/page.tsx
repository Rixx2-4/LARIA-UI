"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/app/components/app-shell"
import { RequireAuth } from "@/app/components/require-auth"
import { LariaMascot } from "@/app/components/laria-mascot"
import { BeforeStart, defaultAssessment } from "@/app/components/before-start"
import { LEVEL_NAME, QuestionStep, ResultsList, submitErrorMessage, toResults, type QuizResult } from "@/app/quiz/quiz-parts"
import { ApiError, isUnsafeTopic, lariaAPI, type AssessmentMix, type LearningPath, type PlacementResult, type QuizResponse } from "@/lib/laria-api"
import { classHref } from "@/lib/routes"

// La prueba de paso de UNA ruta: preguntas sobre los módulos del tramo que acaba de
// terminar. Si sube al siguiente tramo, la clase lo abre en la misma ruta; si no, se
// vuelve a la clase (que puede proponer un repaso) y se puede repetir. No es la
// nivelación general: no hay tema que escribir ni se crean rutas nuevas

type View =
  | { kind: "loading" }
  // Con las abiertas activas: cómo evaluar, antes de pedir la prueba
  | { kind: "setup"; mix: AssessmentMix }
  | { kind: "error"; message: string; retry: boolean }
  | { kind: "questions"; quiz: QuizResponse }
  | { kind: "grading"; quiz: QuizResponse }
  | { kind: "result"; passed: boolean; results: QuizResult[]; placement: PlacementResult | null }
  // El intento ya estaba guardado (409 al reenviar): la clase sabe cómo sigue
  | { kind: "answered" }

export default function PruebaDePasoPage() {
  return (
    <RequireAuth>
      <PruebaDePaso />
    </RequireAuth>
  )
}

function PruebaDePaso() {
  const { pathId } = useParams<{ pathId: string }>()
  const [path, setPath] = useState<LearningPath | null>(null)
  const [view, setView] = useState<View>({ kind: "loading" })
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const assessmentRef = useRef<AssessmentMix | undefined>(undefined)

  const start = useCallback(async () => {
    setView({ kind: "loading" })
    setCurrent(0)
    setAnswers({})
    setError(null)
    // La ruta, para saber a qué tramo se opta y volver a ella
    lariaAPI.paths.get(pathId).then(setPath).catch(() => {})
    try {
      const quiz = await lariaAPI.paths.passageTest(pathId, assessmentRef.current)
      if (!quiz.questions?.length) throw new Error("No se pudieron preparar las preguntas. Prueba de nuevo.")
      setView({ kind: "questions", quiz })
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo preparar la prueba de paso"
      // 409: la ruta no tiene un tramo terminado con otro por delante; 404: no es tuya;
      // un tema no permitido tampoco se arregla reintentando
      const final = isUnsafeTopic(err) || (err instanceof ApiError && (err.status === 409 || err.status === 404))
      setView({
        kind: "error",
        message:
          err instanceof ApiError && err.status === 409
            ? "Esta ruta no tiene ninguna prueba de paso pendiente."
            : err instanceof ApiError && err.status === 429
              ? "Espera un momento antes de volver a intentarlo."
              : message,
        retry: !final,
      })
    }
  }, [pathId])

  // Al abrir se pide la prueba; con las abiertas activas, antes se elige cómo evaluar
  const prepare = useCallback(async () => {
    const mix = await defaultAssessment()
    if (!mix) return start()
    lariaAPI.paths.get(pathId).then(setPath).catch(() => {})
    setView({ kind: "setup", mix })
  }, [pathId, start])

  useEffect(() => {
    // El estado se actualiza tras las respuestas
    // eslint-disable-next-line react-hooks/set-state-in-effect
    prepare()
  }, [prepare])

  const submit = async () => {
    if (view.kind !== "questions") return
    const { quiz } = view
    setView({ kind: "grading", quiz })
    setError(null)
    try {
      const attempt = await lariaAPI.quizzes.submitAttempt(quiz.id, answers)
      const placement = attempt.placement ?? null
      const target = path?.next_tier ?? null
      // Aprobada si el nivel llega al tramo al que se optaba (o lo supera); sin saber
      // el tramo (no se pudo cargar la ruta), vale lo que diga el backend
      const order = ["basico", "intermedio", "avanzado"]
      const passed = !!placement && (target ? order.indexOf(placement.level) >= order.indexOf(target) : placement.passed)
      setView({ kind: "result", passed, results: toResults(quiz.questions, attempt.questions), placement })
    } catch (err) {
      // 409: el intento ya se guardó (p. ej. un reintento tras perder la red) y no se
      // admite otro. No es un error: la clase abre el tramo o propone el repaso
      if (err instanceof ApiError && err.status === 409) return setView({ kind: "answered" })
      setError(submitErrorMessage(err, "No se pudieron enviar tus respuestas"))
      setView({ kind: "questions", quiz })
    }
  }

  const title = path?.title || path?.topic || "tu ruta"
  const target = path?.next_tier ?? null

  return (
    <AppShell>
      <div className="relative h-full overflow-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
          <header className="space-y-1">
            <p className="text-sm text-muted-foreground">Prueba de paso · {title}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {target ? `Para abrir el tramo ${LEVEL_NAME[target]}` : "Prueba de paso"}
            </h1>
          </header>

          {view.kind === "loading" && (
            <div role="status" className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <LariaMascot state="thinking" className="w-24" />
              <p className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Preparando preguntas sobre lo que has estudiado…
              </p>
            </div>
          )}

          {view.kind === "setup" && (
            <BeforeStart
              intro="Preguntas sobre lo que has estudiado en este tramo."
              defaultMix={view.mix}
              onStart={(mix) => {
                assessmentRef.current = mix
                start()
              }}
            />
          )}

          {view.kind === "error" && (
            <div role="alert" className="space-y-4 rounded-xl border border-border bg-card p-5">
              <p>{view.message}</p>
              <div className="flex flex-wrap gap-2">
                {view.retry && (
                  <Button variant="outline" onClick={start} className="gap-2">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Reintentar
                  </Button>
                )}
                <Button asChild>
                  <Link href={classHref(pathId)}>Volver a la clase</Link>
                </Button>
              </div>
            </div>
          )}

          {(view.kind === "questions" || view.kind === "grading") && view.quiz.questions[current] && (
            <QuestionStep
              questions={view.quiz.questions}
              current={current}
              answers={answers}
              onAnswer={(question, letter) => setAnswers((prev) => ({ ...prev, [question.index]: letter }))}
              onPrev={() => setCurrent((n) => Math.max(0, n - 1))}
              onNext={() => (current < view.quiz.questions.length - 1 ? setCurrent((n) => n + 1) : submit())}
              isSubmitting={view.kind === "grading"}
              error={error}
            />
          )}

          {view.kind === "answered" && (
            <section role="status" className="space-y-4 rounded-xl border border-border bg-card p-5">
              <p>Tus respuestas ya estaban guardadas. Vuelve a la clase para ver cómo sigue tu ruta.</p>
              <Button asChild>
                <Link href={classHref(pathId)}>Volver a la clase</Link>
              </Button>
            </section>
          )}

          {view.kind === "result" && (
            <section aria-live="polite" className="space-y-5">
              <div className="flex items-center gap-4">
                <LariaMascot emotion={view.passed ? "celebratory" : "patient"} className="w-20 shrink-0" />
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">
                    {view.passed && target ? `¡Tramo ${LEVEL_NAME[target]} abierto!` : "Todavía no"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {view.passed
                      ? "Tu ruta sigue con clases nuevas."
                      : "Repasamos lo que más te ha costado y puedes volver a intentarlo cuando quieras."}
                  </p>
                </div>
              </div>
              <ResultsList results={view.results} />
              <Button asChild>
                {/* La clase pide /lesson: abre el tramo nuevo o propone el repaso */}
                <Link href={classHref(pathId)}>{view.passed ? "Empezar el tramo nuevo" : "Volver a la clase"}</Link>
              </Button>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}
