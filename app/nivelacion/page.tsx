"use client"

import { Suspense, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { QuestionStep, ResultsList, toResults, type QuizResult } from "../quiz/quiz-parts"
import { lariaAPI, type PlacementLevel, type PlacementResult, type QuizQuestion } from "@/lib/laria-api"
import { NEW_CHAT_HREF, chatHref } from "@/lib/routes"
import { markPlacementOffered } from "@/lib/placement"
import { useChat } from "../contexts/chat-context"

// Nivelación por rondas: una base de 6 preguntas y, si se supera, una avanzada de 8.
// El cliente no lleva la cuenta de la ronda: pide siempre la siguiente con el mismo
// tema y el backend sabe cuál toca. El veredicto no es una nota: es el punto de partida.
// Al terminar se prepara la primera clase: un chat nuevo en el que el tutor empieza
// a explicar el tema. Cada paso de la animación corresponde a algo que ocurre de verdad.

const LEVEL_NAME: Record<PlacementLevel, string> = {
  basico: "básico",
  intermedio: "intermedio",
  avanzado: "avanzado",
}

// Cómo se nombra cada punto de partida: sin tono de aprobado o suspenso
const LEVEL_COPY: Record<PlacementLevel, { title: string }> = {
  basico: { title: "Empezamos por lo básico" },
  intermedio: { title: "Tienes la base" },
  avanzado: { title: "Vas por delante" },
}

type Phase = "intro" | "loading" | "questions" | "preparing"
type StepStatus = "pending" | "active" | "done"

interface Preparation {
  review: StepStatus
  // Superó la base: se pregunta si sigue con la avanzada antes de preparar la clase
  offerNext: boolean
  level: StepStatus
  lesson: StepStatus
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Lo justo para que cada paso se pueda leer; el ritmo lo marca el trabajo real
const STEP_PAUSE_MS = 600

export default function PlacementPage() {
  return (
    <RequireAuth>
      <Suspense>
        <PlacementForUrl />
      </Suspense>
    </RequireAuth>
  )
}

function PlacementForUrl() {
  const params = useSearchParams()
  const topic = params.get("tema")?.trim() ?? ""
  // Cambiar de tema en la URL empieza de cero
  return <Placement key={topic} initialTopic={topic} chatId={params.get("chat")} />
}

function Placement({ initialTopic, chatId }: { initialTopic: string; chatId: string | null }) {
  const [topic, setTopic] = useState(initialTopic)
  const [phase, setPhase] = useState<Phase>("intro")
  const [quizId, setQuizId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<QuizResult[]>([])
  const [placement, setPlacement] = useState<PlacementResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prep, setPrep] = useState<Preparation>({ review: "pending", offerNext: false, level: "pending", lesson: "pending" })
  const router = useRouter()
  const { createChat, queueFirstMessage } = useChat()

  const backHref = chatId ? chatHref(chatId) : NEW_CHAT_HREF

  // Pide la ronda que toque; se vuelve a la pantalla anterior si falla
  const startRound = async (from: Phase) => {
    setPhase("loading")
    setError(null)
    try {
      const quiz = await lariaAPI.quizzes.diagnostic(topic.trim())
      if (!quiz.questions?.length) throw new Error("No se pudieron preparar las preguntas. Prueba de nuevo.")
      setQuizId(quiz.id)
      setQuestions(quiz.questions)
      // El nombre con el que el backend guarda el nivel ("ecuaciones" → "ecuaciones lineales")
      if (quiz.topic) setTopic(quiz.topic)
      setCurrent(0)
      setAnswers({})
      setPhase("questions")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron preparar las preguntas")
      setPhase(from)
    }
  }

  // Envía la ronda; si no queda otra, sigue sola hasta la clase
  const submit = async () => {
    if (!quizId) return
    setIsSubmitting(true)
    setError(null)
    setPhase("preparing")
    setPrep({ review: "active", offerNext: false, level: "pending", lesson: "pending" })
    try {
      const data = await lariaAPI.quizzes.submitAttempt(quizId, answers)
      const verdict = data.placement ?? null
      const shownTopic = verdict?.topic_label || verdict?.topic || topic
      setResults(toResults(questions, data.questions))
      setPlacement(verdict)
      setTopic(shownTopic)
      setPrep((p) => ({ ...p, review: "done", offerNext: !!verdict?.has_next_round }))
      if (!verdict?.has_next_round) await prepareLesson(verdict, shownTopic)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar tus respuestas")
      setPhase("questions")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Ajusta al nivel y crea el chat de la clase; el primer mensaje lo envía el chat al abrirse
  const prepareLesson = async (verdict: PlacementResult | null, lessonTopic: string) => {
    setError(null)
    setPrep((p) => ({ ...p, offerNext: false, level: "active", lesson: "pending" }))
    await pause(STEP_PAUSE_MS)
    setPrep((p) => ({ ...p, level: "done", lesson: "active" }))
    try {
      const chat = await createChat(`Clase: ${lessonTopic}`)
      // Este chat ya viene de una nivelación: no se vuelve a ofrecer
      markPlacementOffered(chat.id)
      queueFirstMessage(
        chat.id,
        verdict
          ? `Empecemos la clase de ${lessonTopic}. En la nivelación quedé en nivel ${LEVEL_NAME[verdict.level]}.`
          : `Empecemos la clase de ${lessonTopic}.`,
      )
      setPrep((p) => ({ ...p, lesson: "done" }))
      await pause(STEP_PAUSE_MS / 2)
      router.push(chatHref(chat.id))
    } catch {
      setError("No se pudo preparar la clase. Prueba de nuevo.")
      setPrep((p) => ({ ...p, lesson: "pending" }))
    }
  }

  const score = results.filter((r) => r.isCorrect).length

  return (
    <AppShell>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {phase === "intro" && (
            <Intro topic={topic} onTopicChange={setTopic} onStart={() => startRound("intro")} error={error} backHref={backHref} />
          )}

          {phase === "loading" && (
            <div role="status" className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              <p>Preparando preguntas sobre {topic}…</p>
              <p className="text-sm">Suele tardar unos segundos.</p>
            </div>
          )}

          {phase === "questions" && questions[current] && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nivelación · <span className="font-medium text-foreground">{topic}</span>
              </p>
              <QuestionStep
                questions={questions}
                current={current}
                answers={answers}
                onAnswer={(question, letter) => setAnswers((prev) => ({ ...prev, [question.index]: letter }))}
                onPrev={() => setCurrent((n) => Math.max(0, n - 1))}
                onNext={() => (current < questions.length - 1 ? setCurrent((n) => n + 1) : submit())}
                isSubmitting={isSubmitting}
                error={error}
              />
            </div>
          )}

          {phase === "preparing" && (
            <PreparingLesson
              topic={topic}
              prep={prep}
              score={score}
              total={results.length}
              placement={placement}
              error={error}
              results={results}
              onContinue={() => startRound("preparing")}
              onStop={() => prepareLesson(placement, topic)}
              onRetry={() => prepareLesson(placement, topic)}
              backHref={backHref}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}

function Intro({
  topic,
  onTopicChange,
  onStart,
  error,
  backHref,
}: {
  topic: string
  onTopicChange: (topic: string) => void
  onStart: () => void
  error: string | null
  backHref: string
}) {
  const ready = topic.trim().length >= 2
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready) onStart()
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nivelación</h1>
        <p className="mt-2 text-muted-foreground">
          Primero 6 preguntas, casi todas fáciles. Si te salen bien, te propongo otras 8 más difíciles. Con eso LARIA
          sabe desde dónde explicarte.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          No es un examen: no hay nota, y quedarte en lo básico también es un buen punto de partida.
        </p>
      </div>

      <div>
        <label htmlFor="placement-topic" className="mb-2 block text-sm font-medium">
          Tema
        </label>
        <input
          id="placement-topic"
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder="Por ejemplo: ecuaciones, derivadas, la célula…"
          maxLength={120}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!ready}>
          Empezar
        </Button>
        <Button asChild variant="outline">
          <Link href={backHref}>Ahora no</Link>
        </Button>
      </div>
    </form>
  )
}

function StepRow({ status, label, detail }: { status: StepStatus; label: string; detail?: string | null }) {
  return (
    <li className={`flex gap-3 transition-opacity duration-300 ${status === "pending" ? "opacity-40" : "opacity-100"}`}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
        {status === "done" ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-300">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : status === "active" ? (
          <Loader2 className="h-5 w-5 animate-spin text-foreground motion-reduce:animate-none" />
        ) : (
          <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
        )}
      </span>
      <div>
        <p className={status === "active" ? "font-medium" : undefined}>
          {label}
          <span className="sr-only">{status === "done" ? " (hecho)" : status === "active" ? " (en curso)" : " (pendiente)"}</span>
        </p>
        {detail && <p className="text-sm text-muted-foreground animate-in fade-in duration-300">{detail}</p>}
      </div>
    </li>
  )
}

// Lo que pasa entre la última respuesta y la clase, paso a paso y con lo que ocurre de verdad
function PreparingLesson({
  topic,
  prep,
  score,
  total,
  placement,
  error,
  results,
  onContinue,
  onStop,
  onRetry,
  backHref,
}: {
  topic: string
  prep: Preparation
  score: number
  total: number
  placement: PlacementResult | null
  error: string | null
  results: QuizResult[]
  onContinue: () => void
  onStop: () => void
  onRetry: () => void
  backHref: string
}) {
  const working = [prep.review, prep.level, prep.lesson].includes("active")
  const level = placement ? LEVEL_COPY[placement.level] : null

  return (
    <div className="space-y-8">
      <div>
        <p className={`flex items-center gap-2 text-sm text-muted-foreground transition-opacity ${working ? "opacity-100" : "opacity-0"}`} aria-hidden>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          Pensando…
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {prep.offerNext ? `La base de ${topic}, superada` : `Preparando tu clase de ${topic}`}
        </h1>
      </div>

      <ol className="space-y-5" aria-live="polite">
        <StepRow
          status={prep.review}
          label="Revisando tus respuestas"
          detail={prep.review === "done" ? `Acertaste ${score} de ${total}` : null}
        />

        {prep.offerNext && (
          <li className="ml-9 space-y-3 rounded-lg border border-border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p>¿Seguimos con 8 preguntas algo más difíciles? Así LARIA afina más tu nivel.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onContinue}>Seguir</Button>
              <Button variant="outline" onClick={onStop}>
                Lo dejo aquí y empiezo la clase
              </Button>
            </div>
          </li>
        )}

        <StepRow
          status={prep.level}
          label={placement ? `Ajustando la clase a tu nivel (${LEVEL_NAME[placement.level]})` : "Ajustando la clase a tu nivel"}
          detail={prep.level !== "pending" && level ? level.title : null}
        />
        <StepRow
          status={prep.lesson}
          label="Preparando tu primera clase"
          detail={prep.lesson === "done" ? "Abriendo el chat…" : null}
        />
      </ol>

      {/* Si falló la ronda avanzada, "Seguir" ya es el reintento */}
      {error && prep.offerNext && <ErrorBox message={error} />}
      {error && !prep.offerNext && (
        <div className="space-y-3">
          <ErrorBox message={error} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRetry}>Reintentar</Button>
            <Button asChild variant="outline">
              <Link href={backHref}>Volver al chat</Link>
            </Button>
          </div>
        </div>
      )}

      {prep.review === "done" && <Answers results={results} />}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  )
}

// Las respuestas corregidas, plegadas: lo importante es el punto de partida, no la nota
function Answers({ results }: { results: QuizResult[] }) {
  if (results.length === 0) return null
  return (
    <details className="group rounded-lg border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Ver tus respuestas</summary>
      <div className="px-4 pb-4">
        <ResultsList results={results} />
      </div>
    </details>
  )
}
