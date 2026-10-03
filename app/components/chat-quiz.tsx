"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiError, lariaAPI, type ExplanationStyle, type PlacementResult, type QuizQuestion, type QuizResponse } from "@/lib/laria-api"
import { STYLE_OPTIONS, StylePicker } from "./style-picker"
import { classHref } from "@/lib/routes"
import { MathText } from "./message-content"
import { StudyGoalsPicker } from "./study-goals-picker"
import {
  LEVEL_COPY,
  LEVEL_NAME,
  ResultsList,
  StepRow,
  toResults,
  type QuizResult,
  type StepStatus,
} from "@/app/quiz/quiz-parts"

// Un quiz dentro de la conversación: se responde en la tarjeta, lo califica el
// servidor (POST /quizzes/{id}/attempts) y deja evidencia en el perfil. Dos casos:
// - nivelación: el estudiante pidió aprender un tema (suggest_placement). Al terminar
//   empieza la clase en este mismo chat.
// - práctica: pidió un quiz (offer_quiz). Sobre el documento del chat si lo tiene, o
//   sobre el tema que nombró. Practicar deja evidencia pero no cambia el nivel.

export type ChatQuizRequest =
  | { kind: "placement"; topic: string }
  // El tutor pregunta cómo prefiere aprender: solo la elección, sin quiz
  | { kind: "style" }
  // Sin topic: sobre el documento del chat
  | { kind: "practice"; topic?: string }

type Phase = "offer" | "loading" | "question" | "grading" | "next-offer" | "style" | "lesson" | "done"

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Lo justo para leer cada paso; el ritmo lo marca el trabajo real
const STEP_PAUSE_MS = 600

interface ChatQuizProps {
  chatId: string
  request: ChatQuizRequest
  // "Ahora no" o cerrar la tarjeta
  onDismiss: () => void
  // Nivelación terminada: se envía el primer mensaje de la clase en este chat
  onStartLesson: (message: string) => void
}

export function ChatQuiz({ chatId, request, onDismiss, onStartLesson }: ChatQuizProps) {
  const router = useRouter()
  const isPlacement = request.kind === "placement"
  const isStyleOnly = request.kind === "style"
  const [phase, setPhase] = useState<Phase>(isStyleOnly ? "style" : "offer")
  const [topic, setTopic] = useState("topic" in request ? (request.topic ?? "") : "")
  const practiceOnDocument = request.kind === "practice" && !request.topic
  const [quiz, setQuiz] = useState<QuizResponse | null>(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<QuizResult[]>([])
  const [placement, setPlacement] = useState<PlacementResult | null>(null)
  const [steps, setSteps] = useState<{ level: StepStatus; lesson: StepStatus }>({ level: "pending", lesson: "pending" })
  const [error, setError] = useState<string | null>(null)
  // El backend no trabaja este tema (422, filtro de seguridad): reintentar no sirve
  const [refused, setRefused] = useState(false)
  // La preferencia actual, para marcarla al preguntar (undefined mientras se carga)
  const [style, setStyle] = useState<ExplanationStyle | null | undefined>(undefined)
  const [savingStyle, setSavingStyle] = useState(false)

  useEffect(() => {
    if (phase !== "style") return
    let cancelled = false
    lariaAPI.learning
      .preferences()
      .then((prefs) => !cancelled && setStyle(prefs.explanation_style))
      .catch(() => !cancelled && setStyle(null))
    return () => {
      cancelled = true
    }
  }, [phase])

  // Tras la nivelación: cómo prefiere que le expliquen, y luego la clase. Si no se
  // puede guardar (p. ej. el backend aún no lo tiene), la clase empieza igual
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
    if (isStyleOnly) return setPhase("done")
    await startLesson(placement, topic)
  }

  const questions: QuizQuestion[] = quiz?.questions ?? []

  // La tarjeta crece al pasar de paso: se trae a la vista para que sus botones no
  // queden tapados por el campo de escribir
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase === "offer") return
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" })
  }, [phase, current])
  const score = results.filter((r) => r.isCorrect).length

  const load = async () => {
    setPhase("loading")
    setError(null)
    try {
      const next = isPlacement
        ? await lariaAPI.quizzes.diagnostic(topic.trim())
        : practiceOnDocument
          ? await lariaAPI.chats.generateQuiz(chatId, 5)
          : await lariaAPI.quizzes.practice(topic.trim(), 5)
      if (!next.questions?.length) throw new Error("No se pudieron preparar las preguntas. Prueba de nuevo.")
      setQuiz(next)
      // El nombre para mostrar ("Electrónica"), no la clave interna ("electronica")
      if (!practiceOnDocument) setTopic(next.topic_label || next.topic || topic)
      setCurrent(0)
      setAnswers({})
      setPhase("question")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron preparar las preguntas")
      setRefused(err instanceof ApiError && err.status === 422)
      setPhase(placement ? "next-offer" : "offer")
    }
  }

  const submit = async () => {
    if (!quiz) return
    setPhase("grading")
    setError(null)
    try {
      const data = await lariaAPI.quizzes.submitAttempt(quiz.id, answers)
      const verdict = data.placement ?? null
      const shownTopic = verdict?.topic_label || verdict?.topic || topic
      setResults(toResults(questions, data.questions))
      setPlacement(verdict)
      if (isPlacement) setTopic(shownTopic)
      if (!isPlacement) return setPhase("done")
      if (verdict?.has_next_round) return setPhase("next-offer")
      setPhase("style")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar tus respuestas")
      setPhase("question")
    }
  }

  // Tras la nivelación: la ruta del tema y su clase guiada (/clase/<ruta>). Un backend
  // sin rutas (404/405) da la clase como antes, en este mismo chat
  const startLesson = async (verdict: PlacementResult | null, lessonTopic: string) => {
    setPhase("lesson")
    setError(null)
    setSteps({ level: "active", lesson: "pending" })
    await pause(STEP_PAUSE_MS)
    setSteps({ level: "done", lesson: "active" })
    try {
      const path = await lariaAPI.paths.fromTopic(lessonTopic)
      setSteps({ level: "done", lesson: "done" })
      router.push(classHref(path.id))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
        onStartLesson(
          verdict
            ? `Empecemos la clase de ${lessonTopic}. En la nivelación quedé en nivel ${LEVEL_NAME[verdict.level]}.`
            : `Empecemos la clase de ${lessonTopic}.`,
        )
        setSteps({ level: "done", lesson: "done" })
        setPhase("done")
        return
      }
      setError(err instanceof Error ? err.message : "No se pudo preparar tu clase")
      setRefused(err instanceof ApiError && err.status === 422)
      setSteps({ level: "done", lesson: "pending" })
    }
  }

  const title = isPlacement
    ? `Nivelación · ${topic || "tema"}`
    : practiceOnDocument
      ? "Práctica sobre tu documento"
      : `Práctica · ${topic}`

  return (
    <div ref={cardRef} className="flex scroll-mb-4 justify-start">
      <div className="w-full max-w-[92%] rounded-2xl border border-border bg-background px-4 py-3 text-[14px] sm:max-w-[80%]">
        {phase === "offer" && (
          <div className="space-y-3">
            {isPlacement ? (
              <>
                <p>
                  ¿Empezamos con unas preguntas rápidas sobre{" "}
                  <input
                    aria-label="Tema de la nivelación"
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value)
                      setRefused(false)
                    }}
                    placeholder="el tema"
                    maxLength={120}
                    size={Math.max(8, topic.length + 1)}
                    className="max-w-full rounded border-b border-dashed border-foreground/40 bg-transparent px-1 font-medium focus:outline-none focus-visible:border-solid"
                  />
                  ?
                </p>
                <p className="text-xs text-muted-foreground">6 preguntas, aquí mismo. No es un examen: sirve para saber por dónde empezar.</p>
              </>
            ) : (
              <>
                <p>
                  Cuestionario sobre {practiceOnDocument ? "tu documento" : <span className="font-medium">{topic}</span>}: 5
                  preguntas aquí mismo, corregidas al momento.
                </p>
                <p className="text-xs text-muted-foreground">Cuenta para tu perfil de aprendizaje; no cambia tu nivel.</p>
              </>
            )}
            {error && <ErrorLine message={error} />}
            <div className="flex gap-2">
              {/* Un tema rechazado solo se puede cambiar (en la nivelación se escribe otro) */}
              {(!refused || isPlacement) && (
                <Button size="sm" onClick={load} disabled={isPlacement && topic.trim().length < 2}>
                  {error && !refused ? "Reintentar" : "Empezar"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Ahora no
              </Button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <p role="status" className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Preparando las preguntas… suele tardar unos segundos.
          </p>
        )}

        {(phase === "question" || phase === "grading") && questions[current] && (
          <InlineQuestion
            title={title}
            questions={questions}
            current={current}
            answers={answers}
            onAnswer={(question, letter) => setAnswers((prev) => ({ ...prev, [question.index]: letter }))}
            onPrev={() => setCurrent((n) => Math.max(0, n - 1))}
            onNext={() => (current < questions.length - 1 ? setCurrent((n) => n + 1) : submit())}
            grading={phase === "grading"}
            error={error}
          />
        )}

        {phase === "next-offer" && (
          <div className="space-y-3">
            <p className="font-medium">Base de {topic}, superada: acertaste {score} de {results.length}.</p>
            <p>¿Seguimos con 8 preguntas algo más difíciles para afinar tu nivel?</p>
            {error && <ErrorLine message={error} />}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={load}>
                {error ? "Reintentar" : "Seguir"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPhase("style")}>
                Empezar mi clase
              </Button>
            </div>
            <Answers results={results} />
          </div>
        )}

        {phase === "style" && (
          <div className="space-y-3">
            {placement && (
              <p className="text-sm text-muted-foreground">
                Tu punto de partida en {topic}: <span className="font-medium text-foreground">{LEVEL_NAME[placement.level]}</span>.
              </p>
            )}
            {/* Tras la nivelación, antes de empezar la clase: cuánto estudiar */}
            {isPlacement && <StudyGoalsPicker />}
            <p className="font-medium">¿Cómo prefieres que te explique?</p>
            <StylePicker value={style} onChoose={chooseStyle} disabled={savingStyle} compact />
            <p className="text-xs text-muted-foreground">Vale para todos los temas. Puedes cambiarlo en tu perfil.</p>
          </div>
        )}

        {phase === "lesson" && (
          <div className="space-y-4">
            <p className="font-medium">Preparando tu clase de {topic}</p>
            <ol className="space-y-3" aria-live="polite">
              <StepRow status="done" label="Revisando tus respuestas" detail={`Acertaste ${score} de ${results.length}`} />
              <StepRow
                status={steps.level}
                label={placement ? `Ajustando la clase a tu nivel (${LEVEL_NAME[placement.level]})` : "Ajustando la clase a tu nivel"}
                detail={placement ? LEVEL_COPY[placement.level].title : null}
              />
              <StepRow status={steps.lesson} label="Preparando tu ruta y tu primera clase" />
            </ol>
            {error && (
              <>
                <ErrorLine message={error} />
                {!refused && (
                  <Button size="sm" onClick={() => startLesson(placement, topic)}>
                    Reintentar
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {phase === "done" && isStyleOnly && (
          <p>
            Te explicaré:{" "}
            <span className="font-medium">{STYLE_OPTIONS.find((o) => o.value === (style ?? null))?.label}</span>. Puedes
            cambiarlo en tu perfil.
          </p>
        )}

        {phase === "done" && !isStyleOnly && (
          <div className="space-y-2">
            {isPlacement ? (
              <p>
                Nivelación de <span className="font-medium">{topic}</span>
                {placement && (
                  <>
                    : nivel <span className="font-medium">{LEVEL_NAME[placement.level]}</span>
                  </>
                )}
                . Acertaste {score} de {results.length}.
              </p>
            ) : (
              <p>
                Acertaste <span className="font-medium">{score} de {results.length}</span>. Queda guardado en tu perfil.
              </p>
            )}
            <Answers results={results} open={!isPlacement} />
            {!isPlacement && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Cerrar
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

function Answers({ results, open = false }: { results: QuizResult[]; open?: boolean }) {
  if (results.length === 0) return null
  return (
    <details open={open} className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Ver tus respuestas</summary>
      <div className="px-3 pb-3 text-sm">
        <ResultsList results={results} />
      </div>
    </details>
  )
}

// La versión compacta de una pregunta, para que quepa en la conversación
function InlineQuestion({
  title,
  questions,
  current,
  answers,
  onAnswer,
  onPrev,
  onNext,
  grading,
  error,
}: {
  title: string
  questions: QuizQuestion[]
  current: number
  answers: Record<number, string>
  onAnswer: (question: QuizQuestion, letter: string) => void
  onPrev: () => void
  onNext: () => void
  grading: boolean
  error: string | null
}) {
  const question = questions[current]
  const isLast = current === questions.length - 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{title}</span>
        <span className="shrink-0">
          {current + 1} de {questions.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="message-text font-medium"><MathText text={question.text} /></p>
      <div className="space-y-2">
        {Object.entries(question.options).map(([key, value]) => (
          <button
            key={key}
            onClick={() => onAnswer(question, key)}
            aria-pressed={answers[question.index] === key}
            disabled={grading}
            className={`message-text w-full rounded-lg border px-3 py-2 text-left text-[13.5px] transition-colors ${
              answers[question.index] === key ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <span className="mr-2 font-medium">{key}.</span>
            <MathText text={value} />
          </button>
        ))}
      </div>
      {error && <ErrorLine message={error} />}
      <div className="flex justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={onPrev} disabled={current === 0 || grading}>
          Anterior
        </Button>
        <Button size="sm" onClick={onNext} disabled={!answers[question.index] || grading}>
          {grading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isLast ? "Finalizar" : "Siguiente"}
          {!grading && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
