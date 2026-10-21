"use client"

import { useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lariaAPI, type QuizQuestion, type QuizResponse } from "@/lib/laria-api"
import { QuestionStep, ResultsList, scoreLine, submitErrorMessage, toResults, type QuizResult } from "@/app/quiz/quiz-parts"

// Repasar un concepto que no está en ninguna ruta: unas preguntas de práctica aquí
// mismo (ADR-051: sin ruta, se repasa con /quizzes/practice). Al calificarse, la
// agenda se actualiza sola

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "question"; quiz: QuizResponse }
  | { kind: "grading"; quiz: QuizResponse }
  | { kind: "done"; results: QuizResult[] }

export function ReviewPractice({ topic, onClose }: { topic: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setPhase({ kind: "loading" })
    setCurrent(0)
    setAnswers({})
    setError(null)
    try {
      const quiz = await lariaAPI.quizzes.practice(topic, 5)
      if (!quiz.questions?.length) throw new Error("No se pudieron preparar las preguntas. Prueba de nuevo.")
      setPhase({ kind: "question", quiz })
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "No se pudieron preparar las preguntas" })
    }
  }

  useEffect(() => {
    // Se piden al abrir: el estado se actualiza tras la respuesta
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Solo al abrir este repaso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (quiz: QuizResponse) => {
    setPhase({ kind: "grading", quiz })
    setError(null)
    try {
      const attempt = await lariaAPI.quizzes.submitAttempt(quiz.id, answers)
      setPhase({ kind: "done", results: toResults(quiz.questions, attempt.questions) })
    } catch (err) {
      setError(submitErrorMessage(err, "No se pudieron enviar tus respuestas"))
      setPhase({ kind: "question", quiz })
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      {phase.kind === "loading" && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          Preparando preguntas de repaso…
        </p>
      )}
      {phase.kind === "error" && (
        <div role="alert" className="space-y-3">
          <p className="text-sm">{phase.message}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reintentar
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
      {(phase.kind === "question" || phase.kind === "grading") && phase.quiz.questions[current] && (
        <QuestionStep
          questions={phase.quiz.questions}
          current={current}
          answers={answers}
          onAnswer={(question: QuizQuestion, letter: string) => setAnswers((prev) => ({ ...prev, [question.index]: letter }))}
          onPrev={() => setCurrent((n) => Math.max(0, n - 1))}
          onNext={() => (current < phase.quiz.questions.length - 1 ? setCurrent((n) => n + 1) : submit(phase.quiz))}
          isSubmitting={phase.kind === "grading"}
          error={error}
        />
      )}
      {phase.kind === "done" && (
        <section aria-live="polite" className="space-y-4">
          <p className="font-medium">{scoreLine(phase.results)}. Tu próximo repaso se recalcula con esta nota.</p>
          <ResultsList results={phase.results} />
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </section>
      )}
    </div>
  )
}
