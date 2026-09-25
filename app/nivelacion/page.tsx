"use client"

import { Suspense, useState, type FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { QuestionStep, ResultsList, toResults, type QuizResult } from "../quiz/quiz-parts"
import { lariaAPI, type PlacementLevel, type PlacementResult, type QuizQuestion } from "@/lib/laria-api"
import { NEW_CHAT_HREF, chatHref, placementHref } from "@/lib/routes"

// Nivelación por rondas: una base de 6 preguntas y, si se supera, una avanzada de 8.
// El cliente no lleva la cuenta de la ronda: pide siempre la siguiente con el mismo
// tema y el backend sabe cuál toca. El veredicto no es una nota: es el punto de partida.

const LEVEL_NAME: Record<PlacementLevel, string> = {
  basico: "básico",
  intermedio: "intermedio",
  avanzado: "avanzado",
}

const LEVEL_COPY: Record<PlacementLevel, { title: string; text: (topic: string) => string }> = {
  basico: {
    title: "Empezamos por lo básico",
    text: (topic) => `Es un buen sitio para arrancar. LARIA tendrá en cuenta tu nivel cuando le preguntes por ${topic}.`,
  },
  intermedio: {
    title: "Tienes la base",
    text: (topic) => `LARIA tendrá en cuenta que ya dominas lo fundamental de ${topic}.`,
  },
  avanzado: {
    title: "Vas por delante",
    text: (topic) => `LARIA tendrá en cuenta que ya manejas ${topic} a buen nivel.`,
  },
}

type Phase = "intro" | "loading" | "questions" | "next-offer" | "final"

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

  const submit = async () => {
    if (!quizId) return
    setIsSubmitting(true)
    setError(null)
    try {
      const data = await lariaAPI.quizzes.submitAttempt(quizId, answers)
      setResults(toResults(questions, data.questions))
      setPlacement(data.placement ?? null)
      if (data.placement?.topic) setTopic(data.placement.topic)
      setPhase(data.placement?.has_next_round ? "next-offer" : "final")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar tus respuestas")
    } finally {
      setIsSubmitting(false)
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

          {phase === "next-offer" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold">La base de {topic}, superada</h1>
                <p className="mt-2 text-muted-foreground">
                  Acertaste {score} de {results.length}. ¿Seguimos con 8 preguntas algo más difíciles? Así LARIA afina
                  más tu nivel.
                </p>
              </div>
              {error && <ErrorBox message={error} />}
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => startRound("next-offer")}>Seguir</Button>
                <Button variant="outline" onClick={() => setPhase("final")}>
                  Lo dejo aquí
                </Button>
              </div>
              <Answers results={results} />
            </div>
          )}

          {phase === "final" && (
            <div className="space-y-6">
              {placement ? (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Tu nivel en <span className="font-medium text-foreground">{topic}</span>:{" "}
                    <span className="font-medium text-foreground">{LEVEL_NAME[placement.level]}</span>
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold">{LEVEL_COPY[placement.level].title}</h1>
                  <p className="mt-2 text-muted-foreground">{LEVEL_COPY[placement.level].text(topic)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Queda guardado en tu perfil.</p>
                </div>
              ) : (
                <h1 className="text-2xl font-semibold">
                  Acertaste {score} de {results.length}
                </h1>
              )}
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={backHref}>Volver al chat</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={placementHref(undefined, chatId)}>Nivelarme en otro tema</Link>
                </Button>
              </div>
              <Answers results={results} />
            </div>
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
