"use client"

import { ArrowRight, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { QuizAttemptQuestion, QuizQuestion } from "@/lib/laria-api"

// Piezas comunes del quiz sobre material y de la nivelación

// "B. Cloroplasto" en lugar de solo "B" cuando se conoce el texto de la opción
export function answerLabel(question: QuizQuestion, letter: string): string {
  const text = question.options[letter]
  return text ? `${letter}. ${text}` : letter
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

// Una pregunta con su progreso, sus opciones y la navegación
export function QuestionStep({ questions, current, answers, onAnswer, onPrev, onNext, isSubmitting, error }: QuestionStepProps) {
  const question = questions[current]
  const progress = ((current + 1) / questions.length) * 100
  const isLast = current === questions.length - 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Pregunta {current + 1} de {questions.length}
        </span>
        <span className="text-sm font-medium">{Math.round(progress)}%</span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <DifficultyBadge difficulty={question.difficulty} />
        </div>

        <h2 className="text-lg font-medium mb-4">{question.text}</h2>

        <div className="space-y-3">
          {Object.entries(question.options).map(([key, value]) => (
            <button
              key={key}
              onClick={() => onAnswer(question, key)}
              aria-pressed={answers[question.index] === key}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                answers[question.index] === key ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <span className="font-medium mr-2">{key}.</span>
              {value}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev} disabled={current === 0} className="flex-1">
          Anterior
        </Button>
        <Button onClick={onNext} disabled={!answers[question.index] || isSubmitting} className="flex-1">
          {isLast ? "Finalizar" : "Siguiente"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// Cada pregunta corregida: lo que respondiste y, si fallaste, lo correcto
export function ResultsList({ results }: { results: QuizResult[] }) {
  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <div
          key={index}
          className={`p-4 rounded-xl border ${
            result.isCorrect
              ? "border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10"
              : "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.isCorrect ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium mb-2">{result.question.text}</p>
              <p className="text-sm text-muted-foreground">
                Tu respuesta:{" "}
                <span className="font-medium">
                  {result.userAnswer ? answerLabel(result.question, result.userAnswer) : "Sin respuesta"}
                </span>
              </p>
              {!result.isCorrect && (
                <p className="text-sm text-green-700 dark:text-green-400">
                  Respuesta correcta:{" "}
                  <span className="font-medium">{answerLabel(result.question, result.correctAnswer)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
