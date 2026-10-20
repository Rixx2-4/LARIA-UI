"use client"

import { MathText } from "@/app/components/message-content"
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { ArrowLeft, ArrowRight, Check, CheckCircle, Circle, CircleDot, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiError, type OpenVerdict, type PlacementLevel, type QuizAttemptQuestion, type QuizQuestion } from "@/lib/laria-api"

// Piezas comunes del quiz sobre material y de la nivelación

// "B. Cloroplasto" en lugar de solo "B" cuando se conoce el texto de la opción
export function answerLabel(question: QuizQuestion, letter: string): string {
  const text = question.options[letter]
  return text ? `${letter}. ${text}` : letter
}

// Lo mismo, con las fórmulas de la opción dibujadas
function AnswerLabel({ question, letter }: { question: QuizQuestion; letter: string }) {
  const text = question.options[letter]
  if (!text) return <>{letter}</>
  return (
    <>
      {letter}. <MathText text={text} />
    </>
  )
}

// Pregunta abierta (ADR-052): se responde por escrito y la corrige el servidor
export function isOpen(question: QuizQuestion): boolean {
  return question.kind === "open"
}

// Lo que se puede escribir en una abierta si el servidor no lo dice
const DEFAULT_MAX_CHARS = 2000

export interface QuizResult {
  question: QuizQuestion
  userAnswer: string | null
  isCorrect: boolean
  correctAnswer: string
  // 0..1: crédito parcial en las abiertas; 0 o 1 en las de opción
  score: number
  // Solo en las abiertas
  open?: {
    verdict: OpenVerdict
    feedback: string
    keyPoints: { text: string; covered: boolean }[]
    modelAnswer: string
  }
}

// Junta la corrección del servidor con las preguntas originales (para mostrar el texto de las opciones)
export function toResults(questions: QuizQuestion[], graded: QuizAttemptQuestion[]): QuizResult[] {
  return graded.map((q) => {
    const question = questions.find((original) => original.index === q.index) ?? {
      index: q.index,
      text: q.text,
      options: {},
      difficulty: "medium",
      kind: q.kind,
    }
    const open = q.kind === "open" || isOpen(question)
    return {
      question,
      userAnswer: q.selected,
      isCorrect: q.is_correct,
      correctAnswer: q.correct_answer,
      score: typeof q.score === "number" ? q.score : q.is_correct ? 1 : 0,
      open: open
        ? {
            verdict: q.verdict ?? (q.is_correct ? "correct" : "incorrect"),
            feedback: q.feedback ?? "",
            keyPoints: q.key_points ?? [],
            modelAnswer: q.model_answer ?? "",
          }
        : undefined,
    }
  })
}

// "Acertaste 4 de 6" o, si hay abiertas (crédito parcial), "Sacaste 4,5 de 6"
export function scoreLine(results: QuizResult[]): string {
  if (!results.some((result) => result.open)) {
    return `Acertaste ${results.filter((result) => result.isCorrect).length} de ${results.length}`
  }
  const earned = results.reduce((sum, result) => sum + result.score, 0)
  const shown = new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(Math.round(earned * 10) / 10)
  return `Sacaste ${shown} de ${results.length}`
}

// El porcentaje del resultado, con el crédito parcial de las abiertas
export function scorePercentage(results: QuizResult[]): number {
  if (results.length === 0) return 0
  return Math.round((results.reduce((sum, result) => sum + result.score, 0) / results.length) * 100)
}

// Por qué no se pudo enviar: los fallos del corrector de abiertas se explican aparte,
// y en ninguno se pierde lo escrito (el servidor no guarda el intento)
export function submitErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.reason === "grader_unavailable") {
      return "No se pudieron corregir tus respuestas ahora mismo. No se ha perdido nada: vuelve a enviarlas en un momento."
    }
    if (error.reason === "grade_rate_limited") {
      return "Has enviado muchas respuestas seguidas. Espera un minuto y vuelve a enviarlas: siguen aquí."
    }
    if (error.reason === "answer_too_long") return "Una de tus respuestas es demasiado larga. Acórtala y vuelve a enviarla."
  }
  return error instanceof Error ? error.message : fallback
}

// Mientras se corrige: las escritas tardan unos segundos más
export function GradingNotice({ questions }: { questions: QuizQuestion[] }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {questions.some(isOpen) ? "Corrigiendo tus respuestas… las escritas tardan unos segundos." : "Corrigiendo tus respuestas…"}
    </p>
  )
}

// La respuesta escrita de una pregunta abierta. Ctrl/⌘ + Enter pasa a la siguiente
export function OpenAnswerField({
  question,
  value,
  onChange,
  onSubmit,
  disabled,
  compact = false,
}: {
  question: QuizQuestion
  value: string
  onChange: (text: string) => void
  onSubmit: () => void
  disabled: boolean
  compact?: boolean
}) {
  const max = question.max_chars ?? DEFAULT_MAX_CHARS
  const id = `respuesta-${question.index}`
  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && value.trim()) {
      event.preventDefault()
      onSubmit()
    }
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="sr-only">
        Tu respuesta
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={max}
        disabled={disabled}
        rows={compact ? 4 : 6}
        placeholder="Explícalo con tus palabras…"
        className={`w-full resize-y rounded-xl border border-border bg-background p-3 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${compact ? "text-[13.5px]" : "text-base"}`}
      />
      <p className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>No hace falta que sea perfecta: cuenta que se entienda la idea.</span>
        {/* El contador, solo cuando se acerca al límite */}
        {value.length > max * 0.8 && (
          <span aria-live="polite">
            {value.length} / {max}
          </span>
        )}
      </p>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const [label, style] =
    difficulty === "hard"
      ? ["Difícil", "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"]
      : difficulty === "medium"
        ? ["Medio", "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300"]
        : ["Fácil", "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"]
  return <span className={`text-xs px-2 py-0.5 rounded-full ${style}`}>{label}</span>
}

// Escribiendo en un campo, las teclas son texto y no atajos del quiz
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

interface QuestionStepProps {
  questions: QuizQuestion[]
  current: number
  answers: Record<number, string>
  onAnswer: (question: QuizQuestion, letter: string) => void
  onPrev: () => void
  onNext: () => void
  isSubmitting: boolean
  error: string | null
}

// Una pregunta con su progreso, sus opciones y la navegación. Con teclado: 1-4 o
// A-D eligen la opción y Enter pasa a la siguiente
export function QuestionStep({ questions, current, answers, onAnswer, onPrev, onNext, isSubmitting, error }: QuestionStepProps) {
  const question = questions[current]
  const isLast = current === questions.length - 1
  const selected = answers[question.index]
  const open = isOpen(question)
  // Una abierta en blanco no se puede enviar (el servidor la daría por vacía)
  const canContinue = (open ? !!selected?.trim() : !!selected) && !isSubmitting

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      const letters = Object.keys(question.options)
      const key = event.key.toUpperCase()
      const letter = /^[1-9]$/.test(event.key) ? letters[Number(event.key) - 1] : letters.includes(key) ? key : undefined
      if (letter && !isSubmitting) {
        event.preventDefault()
        onAnswer(question, letter)
      } else if (event.key === "Enter" && canContinue && !(event.target instanceof HTMLButtonElement)) {
        // Enter sobre un botón ya lo pulsa: no se avanza dos veces
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [question, isSubmitting, canContinue, onAnswer, onNext])

  // Al cambiar de pregunta, el foco va al enunciado (los lectores de pantalla lo leen);
  // no al abrir, para no mover la página
  const headingRef = useRef<HTMLHeadingElement>(null)
  const shownRef = useRef(current)
  useEffect(() => {
    if (shownRef.current === current) return
    shownRef.current = current
    headingRef.current?.focus({ preventScroll: true })
  }, [current])

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            Pregunta {current + 1} de {questions.length}
          </span>
          <DifficultyBadge difficulty={question.difficulty} />
        </div>
        {/* Un tramo por pregunta: hecho si ya tiene respuesta; el actual, resaltado */}
        <div className="flex gap-1" aria-hidden>
          {questions.map((q, i) => (
            <span
              key={q.index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === current ? "bg-primary" : answers[q.index] ? "bg-primary/45" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 ref={headingRef} tabIndex={-1} className="message-text mb-5 text-lg font-medium leading-snug outline-none sm:text-xl">
          <MathText text={question.text} />
        </h2>

        {open && (
          <OpenAnswerField
            key={question.index}
            question={question}
            value={selected ?? ""}
            onChange={(text) => onAnswer(question, text)}
            onSubmit={() => canContinue && onNext()}
            disabled={isSubmitting}
          />
        )}
        <div className="space-y-2.5">
          {Object.entries(question.options).map(([key, value]) => {
            const isSelected = selected === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onAnswer(question, key)}
                aria-pressed={isSelected}
                className={`group flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {key}
                  <span className="sr-only">.</span>
                </span>{" "}
                <span className="min-w-0 flex-1">
                  <MathText text={value} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}
      {isSubmitting && isLast && <GradingNotice questions={questions} />}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onPrev} disabled={current === 0} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Anterior
        </Button>
        <p className="hidden flex-1 text-center text-xs text-muted-foreground sm:block">
          {open ? "Ctrl + Enter para seguir" : `Atajos: teclas 1–${Object.keys(question.options).length} para elegir, Enter para seguir`}
        </p>
        <Button onClick={onNext} disabled={!canContinue} className="ml-auto min-w-36 gap-2 sm:ml-0">
          {isSubmitting && isLast ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {isLast ? "Finalizar" : "Siguiente"}
          {!(isSubmitting && isLast) && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  )
}

// Cómo se nombra cada veredicto de una abierta: lo que pasó, sin tono de suspenso
const VERDICT: Record<OpenVerdict, { label: string; tone: "good" | "partial" | "bad" | "neutral" }> = {
  correct: { label: "Bien explicado", tone: "good" },
  partial: { label: "En parte", tone: "partial" },
  incorrect: { label: "Aún no", tone: "bad" },
  copied: { label: "Con tus palabras", tone: "neutral" },
  empty: { label: "Sin responder", tone: "neutral" },
}

const TONE_BORDER = {
  good: "border-green-200 dark:border-green-500/30",
  partial: "border-border",
  bad: "border-red-200 dark:border-red-500/30",
  neutral: "border-border",
}

// Cada pregunta corregida: lo que respondiste y, si fallaste, lo correcto. En las
// abiertas, el veredicto (no un ✓/✗: el crédito puede ser parcial), el comentario del
// corrector, las ideas clave que cubriste y una respuesta de ejemplo
export function ResultsList({ results }: { results: QuizResult[] }) {
  return (
    <ol className="space-y-3">
      {results.map((result, index) =>
        result.open ? (
          <OpenResult key={index} result={result} number={index + 1} />
        ) : (
          <li
            key={index}
            className={`rounded-xl border bg-card p-4 ${
              result.isCorrect ? "border-green-200 dark:border-green-500/30" : "border-red-200 dark:border-red-500/30"
            }`}
          >
            <div className="flex items-start gap-3">
              {result.isCorrect ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" aria-label="Correcta" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" aria-label="Incorrecta" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="message-text font-medium">
                  <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
                  <MathText text={result.question.text} />
                </p>
                <p
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    result.isCorrect
                      ? "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300"
                      : "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
                  }`}
                >
                  Tu respuesta:{" "}
                  <span className="font-medium">
                    {result.userAnswer ? <AnswerLabel question={result.question} letter={result.userAnswer} /> : "Sin respuesta"}
                  </span>
                </p>
                {!result.isCorrect && (
                  <p className="rounded-lg bg-green-50 px-3 py-1.5 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300">
                    Respuesta correcta:{" "}
                    <span className="font-medium"><AnswerLabel question={result.question} letter={result.correctAnswer} /></span>
                  </p>
                )}
              </div>
            </div>
          </li>
        ),
      )}
    </ol>
  )
}

function OpenResult({ result, number }: { result: QuizResult; number: number }) {
  const open = result.open!
  const verdict = VERDICT[open.verdict] ?? VERDICT.incorrect
  const covered = open.keyPoints.filter((point) => point.covered).length
  const Icon = verdict.tone === "good" ? CheckCircle : verdict.tone === "bad" ? XCircle : CircleDot
  const iconColor =
    verdict.tone === "good" ? "text-green-600 dark:text-green-400" : verdict.tone === "bad" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
  return (
    <li className={`rounded-xl border bg-card p-4 ${TONE_BORDER[verdict.tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="message-text font-medium">
            <span className="mr-1.5 text-muted-foreground">{number}.</span>
            <MathText text={result.question.text} />
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{verdict.label}</span>
            {open.keyPoints.length > 0 && (
              <span className="text-muted-foreground">
                Cubriste {covered} de {open.keyPoints.length} {open.keyPoints.length === 1 ? "idea clave" : "ideas clave"}
              </span>
            )}
          </p>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Tu respuesta</p>
            <p className="whitespace-pre-wrap break-words">{result.userAnswer?.trim() ? result.userAnswer : "Sin respuesta"}</p>
          </div>
          {open.feedback && <p className="text-sm leading-relaxed">{open.feedback}</p>}
          {open.keyPoints.length > 0 && (
            <ul className="space-y-1 text-sm" aria-label="Ideas clave">
              {open.keyPoints.map((point, i) => (
                <li key={i} className="flex gap-2">
                  {point.covered ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={point.covered ? undefined : "text-muted-foreground"}>
                    <span className="sr-only">{point.covered ? "La mencionaste: " : "Te faltó: "}</span>
                    <MathText text={point.text} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {open.modelAnswer && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver una respuesta de ejemplo</summary>
              <p className="message-text mt-1.5 rounded-lg bg-muted/50 px-3 py-2">
                <MathText text={open.modelAnswer} />
              </p>
            </details>
          )}
        </div>
      </div>
    </li>
  )
}

export const LEVEL_NAME: Record<PlacementLevel, string> = {
  basico: "básico",
  intermedio: "intermedio",
  avanzado: "avanzado",
}

// Cómo se nombra cada punto de partida: sin tono de aprobado o suspenso
export const LEVEL_COPY: Record<PlacementLevel, { title: string }> = {
  basico: { title: "Empezamos por lo básico" },
  intermedio: { title: "Tienes la base" },
  avanzado: { title: "Vas por delante" },
}

export type StepStatus = "pending" | "active" | "done"

// Un paso de la preparación de la clase: pendiente, en curso o hecho
export function StepRow({ status, label, detail }: { status: StepStatus; label: string; detail?: string | null }) {
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
