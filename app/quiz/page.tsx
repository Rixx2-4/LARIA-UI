"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle, XCircle, ArrowRight, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "../components/sidebar"
import { useChat } from "@/app/contexts/chat-context"
import { lariaAPI, QuizQuestion, QuizAttemptQuestion } from "@/lib/laria-api"

interface QuizResult {
  question: QuizQuestion
  userAnswer: string
  isCorrect: boolean
  correctAnswer: string
}

export default function QuizPage() {
  const router = useRouter()
  const { activeChatId } = useChat()
  const [step, setStep] = useState<"config" | "quiz" | "results">("config")
  const [questionCount, setQuestionCount] = useState(5)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<QuizResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const generateQuiz = async () => {
    if (!activeChatId) {
      setError("Abre o crea un chat con un documento vinculado antes de generar un quiz.")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await lariaAPI.chats.generateQuiz(activeChatId, questionCount)
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions)
        setStep("quiz")
      }
    } catch (err) {
      console.error("Failed to generate quiz:", err)
      setError(err instanceof Error ? err.message : "Error al generar el quiz")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = (questionIndex: number, answer: string) => {
    setAnswers({ ...answers, [questionIndex]: answer })
  }

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      submitQuiz()
    }
  }

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const submitQuiz = async () => {
    if (!activeChatId) return
    setIsLoading(true)
    try {
      const chat = await lariaAPI.chats.get(activeChatId)
      const quizMsg = (chat.messages || []).find(
        (m) => m.metadata?.type === "quiz"
      )
      const quizId = quizMsg?.metadata?.envelope?.quiz_id

      if (!quizId) {
        setError("No se encontró el quiz activo.")
        setIsLoading(false)
        return
      }

      const answerRecord: Record<string, string> = {}
      Object.entries(answers).forEach(([idx, ans]) => {
        answerRecord[String(idx)] = ans
      })

      const data = await lariaAPI.quizzes.submitAttempt(quizId, answerRecord)

      const quizResults: QuizResult[] = data.questions.map((q: QuizAttemptQuestion) => {
        const original = questions.find((oq) => oq.index === q.index)
        return {
          question: original || { index: q.index, text: q.text, options: {}, difficulty: "medium" },
          userAnswer: q.selected,
          isCorrect: q.is_correct,
          correctAnswer: q.correct_answer,
        }
      })
      setResults(quizResults)
      setStep("results")
    } catch (err) {
      console.error("Failed to submit quiz:", err)
      setError(err instanceof Error ? err.message : "Error al enviar el intento")
    } finally {
      setIsLoading(false)
    }
  }

  const restartQuiz = () => {
    setStep("config")
    setQuestions([])
    setCurrentQuestion(0)
    setAnswers({})
    setResults([])
    setError(null)
  }

  const score = results.filter((r) => r.isCorrect).length
  const total = results.length
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-background">
        <div className="max-w-3xl mx-auto py-8 px-6">
          {step === "config" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-2">Quiz</h1>
                <p className="text-muted-foreground">
                  Genera un quiz basado en el material del chat activo
                </p>
              </div>

              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              {!activeChatId && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Abre o crea un chat con un documento vinculado para generar un quiz.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-3 block">Número de preguntas</label>
                <div className="grid grid-cols-4 gap-3">
                  {[5, 10, 20, "custom"].map((count) => (
                    <Button
                      key={String(count)}
                      variant={questionCount === count ? "default" : "outline"}
                      onClick={() => typeof count === "number" && setQuestionCount(count)}
                      className="h-12"
                    >
                      {count === "custom" ? "Personalizar" : count}
                    </Button>
                  ))}
                </div>
              </div>

              {questionCount === 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Cantidad personalizada</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
              )}

              <Button
                onClick={generateQuiz}
                disabled={isLoading || questionCount < 1 || !activeChatId}
                className="w-full h-12"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Generar Quiz
              </Button>
            </div>
          )}

          {step === "quiz" && questions.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Pregunta {currentQuestion + 1} de {questions.length}
                </span>
                <span className="text-sm font-medium">
                  {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
                </span>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                />
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    questions[currentQuestion].difficulty === "hard"
                      ? "bg-red-100 text-red-700"
                      : questions[currentQuestion].difficulty === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {questions[currentQuestion].difficulty === "hard" ? "Difícil" :
                     questions[currentQuestion].difficulty === "medium" ? "Medio" : "Fácil"}
                  </span>
                </div>

                <h2 className="text-lg font-medium mb-4">{questions[currentQuestion].text}</h2>

                <div className="space-y-3">
                  {Object.entries(questions[currentQuestion].options).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => handleAnswer(currentQuestion, key)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        answers[currentQuestion] === key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-medium mr-2">{key}.</span>
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={prevQuestion}
                  disabled={currentQuestion === 0}
                  className="flex-1"
                >
                  Anterior
                </Button>
                <Button
                  onClick={nextQuestion}
                  disabled={!answers[currentQuestion]}
                  className="flex-1"
                >
                  {currentQuestion === questions.length - 1 ? "Finalizar" : "Siguiente"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <h1 className="text-2xl font-semibold mb-2">Resultados del Quiz</h1>
                <div className="text-6xl font-bold text-primary mb-2">{percentage}%</div>
                <p className="text-muted-foreground">
                  {score} de {total} respuestas correctas
                </p>
              </div>

              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      result.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {result.isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium mb-2">{result.question.text}</p>
                        <p className="text-sm text-muted-foreground">
                          Tu respuesta: <span className="font-medium">{result.userAnswer || "Sin respuesta"}</span>
                        </p>
                        {!result.isCorrect && (
                          <p className="text-sm text-green-600">
                            Respuesta correcta: <span className="font-medium">{result.correctAnswer}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={restartQuiz} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Nuevo Quiz
                </Button>
                <Button onClick={() => router.push("/")} className="flex-1">
                  Volver al Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}