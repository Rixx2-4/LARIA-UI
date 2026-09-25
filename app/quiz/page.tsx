"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { SelectSkeleton } from "../components/skeletons"
import { useChat } from "@/app/contexts/chat-context"
import { NEW_CHAT_HREF, chatHref, placementHref, quizHref } from "@/lib/routes"
import { lariaAPI, QuizQuestion } from "@/lib/laria-api"
import { QuestionStep, ResultsList, toResults, type QuizResult } from "./quiz-parts"

const PRESET_COUNTS = [5, 10, 20]
// El backend acepta de 1 a 20 preguntas por quiz
const MAX_QUESTIONS = 20


export default function QuizPage() {
  return (
    <RequireAuth>
      {/* useSearchParams necesita un Suspense para poder prerenderizar la página */}
      <Suspense>
        <QuizForUrlChat />
      </Suspense>
    </RequireAuth>
  )
}

// El chat viene en la URL (/quiz?chat=<id>) para sobrevivir a una recarga; cambiarlo
// empieza un quiz de cero (la key descarta el estado del chat anterior)
function QuizForUrlChat() {
  const chatId = useSearchParams().get("chat")
  return <Quiz key={chatId ?? ""} chatId={chatId} />
}

function Quiz({ chatId }: { chatId: string | null }) {
  const router = useRouter()
  const { chats, chatsLoaded } = useChat()
  const selectedChat = chats.find((c) => c.id === chatId)
  const chatMissing = chatsLoaded && !!chatId && !selectedChat
  // Por qué no se puede generar todavía; sin chats ya lo dice el aviso de arriba
  const generateBlockedReason =
    !chatsLoaded || chats.length === 0 || chatMissing || chatId
      ? null
      : chats.some((c) => c.document_id)
        ? "Elige un chat para generar el quiz."
        : "Ninguno de tus chats tiene un documento. Sube uno en un chat para generar un quiz."
  const [step, setStep] = useState<"config" | "quiz" | "results">("config")
  const [questionCount, setQuestionCount] = useState(5)
  const [isCustomCount, setIsCustomCount] = useState(false)
  // Lo que se está escribiendo; solo se valida al generar
  const [customCountText, setCustomCountText] = useState("")
  const [quizId, setQuizId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  // Respuestas por el index que el backend da a cada pregunta
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<QuizResult[]>([])
  const [error, setError] = useState<string | null>(null)
  // Tema para nivelarse sin material
  const [topicDraft, setTopicDraft] = useState("")

  const generateQuiz = async () => {
    if (!chatId) return
    const count = isCustomCount ? Number(customCountText) : questionCount
    if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
      setError(`Elige entre 1 y ${MAX_QUESTIONS} preguntas.`)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await lariaAPI.chats.generateQuiz(chatId, count)
      if (data.questions && data.questions.length > 0) {
        setQuizId(data.id)
        setQuestions(data.questions)
        setCurrentQuestion(0)
        setAnswers({})
        setStep("quiz")
      } else {
        setError("El quiz generado no tiene preguntas. Prueba de nuevo.")
      }
    } catch (err) {
      console.error("Failed to generate quiz:", err)
      setError(err instanceof Error ? err.message : "Error al generar el quiz")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = (question: QuizQuestion, answer: string) => {
    setAnswers({ ...answers, [question.index]: answer })
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
    if (!quizId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await lariaAPI.quizzes.submitAttempt(quizId, answers)

      const quizResults = toResults(questions, data.questions)
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
    setQuizId(null)
    setQuestions([])
    setCurrentQuestion(0)
    setAnswers({})
    setResults([])
    setError(null)
  }

  const current: QuizQuestion | undefined = questions[currentQuestion]
  const score = results.filter((r) => r.isCorrect).length
  const total = results.length
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0

  return (
    <AppShell>
      <div className="h-full overflow-auto">
        <div className="max-w-3xl mx-auto py-8 px-6">
          {step === "config" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-2">Quiz</h1>
                <p className="text-muted-foreground">
                  Genera un quiz basado en el material de un chat
                </p>
              </div>

              {error && (
                <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="quiz-chat" className="text-sm font-medium mb-2 block">Chat</label>
                {!chatsLoaded ? (
                  <SelectSkeleton label="Cargando tus chats…" />
                ) : chats.length > 0 ? (
                  <select
                    id="quiz-chat"
                    value={selectedChat ? chatId! : ""}
                    onChange={(e) => router.replace(quizHref(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  >
                    <option value="" disabled>
                      Elige un chat…
                    </option>
                    {/* El quiz se genera a partir del documento del chat */}
                    {chats.map((chat) => (
                      <option key={chat.id} value={chat.id} disabled={!chat.document_id}>
                        {chat.document_id ? chat.title : `${chat.title} (sin documento)`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                    Aún no tienes chats. Sube un documento en un chat para generar un quiz sobre él.
                  </p>
                )}
                {chatMissing && (
                  <p className="mt-2 text-sm text-destructive">Ese chat ya no existe. Elige otro.</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Número de preguntas</label>
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_COUNTS.map((count) => (
                    <Button
                      key={count}
                      variant={!isCustomCount && questionCount === count ? "default" : "outline"}
                      onClick={() => {
                        setIsCustomCount(false)
                        setQuestionCount(count)
                      }}
                      className="h-12"
                    >
                      {count}
                    </Button>
                  ))}
                  <Button
                    variant={isCustomCount ? "default" : "outline"}
                    onClick={() => {
                      setIsCustomCount(true)
                      setCustomCountText(String(questionCount))
                    }}
                    className="h-12"
                  >
                    Personalizar
                  </Button>
                </div>
              </div>

              {isCustomCount && (
                <div>
                  <label htmlFor="quiz-count" className="text-sm font-medium mb-2 block">Cantidad personalizada</label>
                  <input
                    id="quiz-count"
                    type="number"
                    min={1}
                    max={MAX_QUESTIONS}
                    value={customCountText}
                    placeholder={`1–${MAX_QUESTIONS}`}
                    onChange={(e) => setCustomCountText(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
              )}

              <Button
                onClick={generateQuiz}
                disabled={isLoading || !chatId || chatMissing}
                aria-describedby={generateBlockedReason ? "quiz-blocked-reason" : undefined}
                className="w-full h-12"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Generar Quiz
              </Button>
              {generateBlockedReason && (
                <p id="quiz-blocked-reason" className="-mt-3 text-center text-sm text-muted-foreground">
                  {generateBlockedReason}
                </p>
              )}

              <form
                className="border-t border-border pt-6"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (topicDraft.trim().length >= 2) router.push(placementHref(topicDraft.trim(), chatId))
                }}
              >
                <label htmlFor="placement-topic" className="text-sm font-medium block">
                  ¿Sin material? Dime qué quieres aprender
                </label>
                <p className="mt-1 mb-3 text-sm text-muted-foreground">
                  Te hago unas preguntas para ver por dónde empezar. No es un examen.
                </p>
                <div className="flex gap-2">
                  <input
                    id="placement-topic"
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    placeholder="Por ejemplo: ecuaciones, derivadas, la célula…"
                    maxLength={120}
                    className="min-w-0 flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  />
                  <Button type="submit" variant="outline" disabled={topicDraft.trim().length < 2}>
                    Nivelarme
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === "quiz" && current && (
            <QuestionStep
              questions={questions}
              current={currentQuestion}
              answers={answers}
              onAnswer={handleAnswer}
              onPrev={prevQuestion}
              onNext={nextQuestion}
              isSubmitting={isLoading}
              error={error}
            />
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

              <ResultsList results={results} />

              <div className="flex gap-3">
                <Button variant="outline" onClick={restartQuiz} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Nuevo Quiz
                </Button>
                <Button onClick={() => router.push(chatId ? chatHref(chatId) : NEW_CHAT_HREF)} className="flex-1">
                  Volver al Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
