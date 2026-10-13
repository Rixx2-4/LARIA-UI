"use client"

import { MathText } from "@/app/components/message-content"
import { useEffect, useRef } from "react"
import { ArrowLeft, ArrowRight, Check, CheckCircle, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PlacementLevel, QuizAttemptQuestion, QuizQuestion } from "@/lib/laria-api"

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

export interface QuizResult {
  question: QuizQuestion
  userAnswer: string | null
  isCorrect: boolean
  correctAnswer: string
}

// Junta la corrección del servidor con las preguntas originales (para mostrar el texto de las opciones)
export function toResults(questions: QuizQuestion[], graded: QuizAttemptQuestion[]): QuizResult[] {
  return graded.map((q) => ({
    question: questions.find((original) => original.index === q.index) ?? { index: q.index, text: q.text, options: {}, difficulty: "medium" },
    userAnswer: q.selected,
    isCorrect: q.is_correct,
    correctAnswer: q.correct_answer,
  }))
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
  const canContinue = !!selected && !isSubmitting

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

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onPrev} disabled={current === 0} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Anterior
        </Button>
        <p className="hidden flex-1 text-center text-xs text-muted-foreground sm:block">
          {`Atajos: teclas 1–${Object.keys(question.options).length} para elegir, Enter para seguir`}
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

// Cada pregunta corregida: lo que respondiste y, si fallaste, lo correcto
export function ResultsList({ results }: { results: QuizResult[] }) {
  return (
    <ol className="space-y-3">
      {results.map((result, index) => (
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
      ))}
    </ol>
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
