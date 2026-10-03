"use client"

import { Suspense, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { LEVEL_COPY, LEVEL_NAME, QuestionStep, ResultsList, StepRow, toResults, type QuizResult, type StepStatus } from "../quiz/quiz-parts"
import { ApiError, lariaAPI, type ExplanationStyle, type PlacementResult, type QuizQuestion } from "@/lib/laria-api"
import { StylePicker } from "../components/style-picker"
import { StudyGoalsPicker } from "../components/study-goals-picker"
import { NEW_CHAT_HREF, chatHref, classHref } from "@/lib/routes"
import { markPlacementOffered } from "@/lib/placement"
import { useChat } from "../contexts/chat-context"

// Nivelación por rondas: una base de 6 preguntas y, si se supera, una avanzada de 8.
// El cliente no lleva la cuenta de la ronda: pide siempre la siguiente con el mismo
// tema y el backend sabe cuál toca. El veredicto no es una nota: es el punto de partida.
// Al terminar se prepara la ruta del tema y se abre su clase guiada (/clase/<ruta>).
// Cada paso de la animación corresponde a algo que ocurre de verdad.

type Phase = "intro" | "loading" | "questions" | "preparing"

interface Preparation {
  review: StepStatus
  // Superó la base: se pregunta si sigue con la avanzada antes de preparar la clase
  offerNext: boolean
  // Antes de preparar la clase se pregunta cómo prefiere que le expliquen
  askStyle: boolean
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
  const [prep, setPrep] = useState<Preparation>({ review: "pending", offerNext: false, askStyle: false, level: "pending", lesson: "pending" })
  const router = useRouter()
  const { createChat, queueFirstMessage } = useChat()
  // La preferencia actual, para marcarla al preguntar (undefined mientras se carga)
  const [style, setStyle] = useState<ExplanationStyle | null | undefined>(undefined)
  const [savingStyle, setSavingStyle] = useState(false)

  useEffect(() => {
    if (!prep.askStyle) return
    let cancelled = false
    lariaAPI.learning
      .preferences()
      .then((prefs) => !cancelled && setStyle(prefs.explanation_style))
      .catch(() => !cancelled && setStyle(null))
    return () => {
      cancelled = true
    }
  }, [prep.askStyle])

  // Si no se puede guardar (p. ej. el backend aún no lo tiene), la clase empieza igual
  const chooseStyle = async (choice: ExplanationStyle | null) => {
    setStyle(choice)
    setSavingStyle(true)
    try {
      await lariaAPI.learning.setPreferences(choice)
    } catch (err) {
      console.warn("No se pudo guardar cómo prefieres que te expliquen:", err)
    } finally {
      setSavingStyle(false)
    }
    await prepareLesson(placement, topic)
  }

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
      // El nombre para mostrar (topic_label, con tildes); topic es la clave interna
      if (quiz.topic_label || quiz.topic) setTopic(quiz.topic_label || quiz.topic || topic)
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
    setPrep({ review: "active", offerNext: false, askStyle: false, level: "pending", lesson: "pending" })
    try {
      const data = await lariaAPI.quizzes.submitAttempt(quizId, answers)
      const verdict = data.placement ?? null
      const shownTopic = verdict?.topic_label || verdict?.topic || topic
      setResults(toResults(questions, data.questions))
      setPlacement(verdict)
      setTopic(shownTopic)
      setPrep((p) => ({ ...p, review: "done", offerNext: !!verdict?.has_next_round }))
      if (!verdict?.has_next_round) setPrep((p) => ({ ...p, askStyle: true }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar tus respuestas")
      setPhase("questions")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Ajusta al nivel y abre la clase guiada de la ruta del tema (/clase/<ruta>). Un
  // backend sin rutas (404/405) da la clase como antes: un chat que la empieza solo
  const prepareLesson = async (verdict: PlacementResult | null, lessonTopic: string) => {
    setError(null)
    setPrep((p) => ({ ...p, offerNext: false, askStyle: false, level: "active", lesson: "pending" }))
    await pause(STEP_PAUSE_MS)
    setPrep((p) => ({ ...p, level: "done", lesson: "active" }))
    try {
      const path = await lariaAPI.paths.fromTopic(lessonTopic)
      setPrep((p) => ({ ...p, lesson: "done" }))
      await pause(STEP_PAUSE_MS / 2)
      router.push(classHref(path.id))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) return lessonInChat(verdict, lessonTopic)
      setError(err instanceof Error ? err.message : "No se pudo preparar la clase. Prueba de nuevo.")
      setPrep((p) => ({ ...p, lesson: "pending" }))
    }
  }

  const lessonInChat = async (verdict: PlacementResult | null, lessonTopic: string) => {
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
              onStop={() => setPrep((p) => ({ ...p, offerNext: false, askStyle: true }))}
              styleValue={style}
              savingStyle={savingStyle}
              onChooseStyle={chooseStyle}
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
  styleValue,
  savingStyle,
  onChooseStyle,
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
  styleValue: ExplanationStyle | null | undefined
  savingStyle: boolean
  onChooseStyle: (style: ExplanationStyle | null) => void
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

        {prep.askStyle && (
          <li className="ml-9 space-y-3 rounded-lg border border-border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {placement && (
              <p className="text-sm text-muted-foreground">
                Tu punto de partida: <span className="font-medium text-foreground">{LEVEL_NAME[placement.level]}</span>.
              </p>
            )}
            {/* Antes de empezar la clase: cuánto estudiar */}
            <StudyGoalsPicker />
            <p className="font-medium">¿Cómo prefieres que te explique?</p>
            <StylePicker value={styleValue} onChoose={onChooseStyle} disabled={savingStyle} />
            <p className="text-xs text-muted-foreground">Vale para todos los temas. Puedes cambiarlo en tu perfil.</p>
          </li>
        )}

        <StepRow
          status={prep.level}
          label={placement ? `Ajustando la clase a tu nivel (${LEVEL_NAME[placement.level]})` : "Ajustando la clase a tu nivel"}
          detail={prep.level !== "pending" && level ? level.title : null}
        />
        <StepRow
          status={prep.lesson}
          label="Preparando tu ruta y tu primera clase"
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
