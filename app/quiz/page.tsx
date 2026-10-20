"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, FileText, MessageSquare, RotateCcw, Settings2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { SelectSkeleton } from "../components/skeletons"
import { useChat } from "@/app/contexts/chat-context"
import { NEW_CHAT_HREF, chatHref, placementHref, quizHref } from "@/lib/routes"
import { lariaAPI, QuizQuestion } from "@/lib/laria-api"
import { LariaMascot, type MascotEmotion } from "../components/laria-mascot"
import { QuestionStep, ResultsList, scoreLine, scorePercentage, submitErrorMessage, toResults, type QuizResult } from "./quiz-parts"

// Cuántas preguntas, con lo que se tarda más o menos (unos 40 s por pregunta)
const PRESETS = [
  { count: 5, label: "Rápido" },
  { count: 10, label: "Normal" },
  { count: 20, label: "A fondo" },
]
const minutesFor = (count: number) => Math.max(1, Math.round((count * 40) / 60))
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
  // Un quiz de chat es sobre su documento: sin él, el backend respondería 422
  const chatWithoutDocument = !!selectedChat && !selectedChat.document_id
  // Por qué no se puede generar todavía; sin chats ya lo dice el aviso de arriba
  const generateBlockedReason =
    chatWithoutDocument
      ? "Este chat no tiene un documento. Sube uno en el chat, o nivélate en un tema aquí abajo."
      : !chatsLoaded || chats.length === 0 || chatMissing || chatId
      ? null
      : chats.some((c) => c.document_id)
        ? "Elige un material para empezar."
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
  // En los resultados: todas las preguntas o solo las falladas
  const [onlyMistakes, setOnlyMistakes] = useState(false)
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
        setOnlyMistakes(false)
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
      setError(submitErrorMessage(err, "Error al enviar el intento"))
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
  // Con abiertas, el crédito parcial cuenta (media de 0..1 por pregunta)
  const percentage = scorePercentage(results)
  const total = results.length
  const mistakes = results.filter((r) => !r.isCorrect)
  const pendingCount = isCustomCount ? Number(customCountText) || 0 : questionCount
  const docChats = chats.filter((c) => c.document_id)
  // Generando (al empezar o con «Otro quiz igual»): LARIA lo cuenta en vez de un botón girando
  const generating = isLoading && step !== "quiz"
  const chatsWithoutDocument = chats.length - docChats.length

  return (
    <AppShell>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          {generating && (
            <div role="status" className="flex flex-col items-center gap-4 py-16 text-center">
              <LariaMascot state="thinking" className="w-28" />
              <div className="space-y-1">
                <p className="text-lg font-medium">
                  Preparando {pendingCount} {pendingCount === 1 ? "pregunta" : "preguntas"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Sobre {selectedChat ? <span className="font-medium text-foreground">{selectedChat.title}</span> : "tu material"}. Tardo unos segundos.
                </p>
              </div>
            </div>
          )}

          {step === "config" && !generating && (
            <div className="space-y-7">
              <header className="flex items-center gap-4">
                <LariaMascot emotion="encouraging" className="w-16 shrink-0" />
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight">Ponte a prueba</h1>
                  <p className="text-sm text-muted-foreground">
                    Un quiz sobre tus apuntes para ver qué dominas y qué conviene repasar. Cuenta para tu perfil, no es un examen.
                  </p>
                </div>
              </header>

              {error && (
                <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
                  ¿Sobre qué material?
                </legend>
                {!chatsLoaded ? (
                  <SelectSkeleton label="Cargando tus chats…" />
                ) : chats.length > 0 ? (
                  <>
                    {/* El quiz se genera a partir del documento del chat */}
                    <div role="radiogroup" aria-label="Chat" className="grid max-h-80 gap-2 overflow-auto p-0.5 sm:grid-cols-2">
                      {chats.map((chat) => {
                        const hasDocument = !!chat.document_id
                        const checked = chat.id === chatId
                        return (
                          <label
                            key={chat.id}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                              !hasDocument
                                ? "cursor-not-allowed border-dashed border-border opacity-55"
                                : checked
                                  ? "cursor-pointer border-primary bg-primary/5 shadow-sm"
                                  : "cursor-pointer border-border hover:border-primary/40 hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="quiz-chat"
                              value={chat.id}
                              checked={checked}
                              disabled={!hasDocument}
                              onChange={() => router.replace(quizHref(chat.id))}
                              className="sr-only"
                            />
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              }`}
                              aria-hidden
                            >
                              {hasDocument ? <FileText className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{chat.title}</span>
                              <span className="block text-xs text-muted-foreground">{hasDocument ? "Con documento" : "Sin documento"}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {chatsWithoutDocument > 0 && docChats.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Los chats sin documento no sirven para un quiz: sube un archivo en el chat y aparecerá aquí.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                    Aún no tienes chats. Sube un documento en un chat para generar un quiz sobre él.
                  </p>
                )}
                {chatMissing && <p className="text-sm text-destructive">Ese chat ya no existe. Elige otro.</p>}
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                  ¿Cuántas preguntas?
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PRESETS.map(({ count, label }) => {
                    const active = !isCustomCount && questionCount === count
                    return (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setIsCustomCount(false)
                          setQuestionCount(count)
                        }}
                        className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <span className="block text-xl font-semibold">{count}</span>
                        <span className="block text-xs text-muted-foreground">
                          {label} · ~{minutesFor(count)} min
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    aria-pressed={isCustomCount}
                    onClick={() => {
                      setIsCustomCount(true)
                      setCustomCountText(String(questionCount))
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isCustomCount ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <Settings2 className="mb-1 h-5 w-5" aria-hidden />
                    <span className="block text-xs text-muted-foreground">Personalizar</span>
                  </button>
                </div>
                {isCustomCount && (
                  <div className="flex items-center gap-3">
                    <label htmlFor="quiz-count" className="text-sm">
                      Cantidad personalizada
                    </label>
                    <input
                      id="quiz-count"
                      type="number"
                      min={1}
                      max={MAX_QUESTIONS}
                      value={customCountText}
                      placeholder={`1–${MAX_QUESTIONS}`}
                      onChange={(e) => setCustomCountText(e.target.value)}
                      className="w-24 rounded-lg border border-border bg-background px-3 py-2"
                    />
                    <span className="text-xs text-muted-foreground">de 1 a {MAX_QUESTIONS}</span>
                  </div>
                )}
              </fieldset>

              <div className="space-y-2">
                <Button
                  onClick={generateQuiz}
                  disabled={isLoading || !chatId || chatMissing || chatWithoutDocument}
                  aria-describedby={generateBlockedReason ? "quiz-blocked-reason" : undefined}
                  className="h-12 w-full gap-2 text-base"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Empezar quiz
                </Button>
                {generateBlockedReason && (
                  <p id="quiz-blocked-reason" className="text-center text-sm text-muted-foreground">
                    {generateBlockedReason}
                  </p>
                )}
              </div>

              <form
                className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5"
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
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">Quiz · {selectedChat?.title ?? "tu material"}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={restartQuiz}>
                  Salir
                </Button>
              </div>
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
            </div>
          )}

          {step === "results" && !generating && (
            <div className="space-y-6">
              <section aria-live="polite" className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left">
                <ScoreRing percentage={percentage} />
                <div className="flex-1 space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight">{verdict(percentage).title}</h1>
                  <p className="text-muted-foreground">
                    {scoreLine(results)}
                  </p>
                  <p className="text-sm text-muted-foreground">{verdict(percentage).detail}</p>
                </div>
                <LariaMascot emotion={verdict(percentage).emotion} className="w-20 shrink-0" />
              </section>

              <div className="flex flex-wrap gap-2">
                <Button onClick={generateQuiz} disabled={isLoading} className="gap-2">
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Otro quiz igual
                </Button>
                <Button variant="outline" onClick={restartQuiz} className="gap-2">
                  <Settings2 className="h-4 w-4" aria-hidden />
                  Cambiar ajustes
                </Button>
                <Button variant="ghost" onClick={() => router.push(chatId ? chatHref(chatId) : NEW_CHAT_HREF)} className="gap-2">
                  Volver al chat
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {error && (
                <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium">Tus respuestas</h2>
                  {mistakes.length > 0 && mistakes.length < total && (
                    <div role="group" aria-label="Qué preguntas ver" className="flex rounded-lg border border-border p-0.5 text-sm">
                      {[
                        { value: false, label: `Todas (${total})` },
                        { value: true, label: `Para repasar (${mistakes.length})` },
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={onlyMistakes === option.value}
                          onClick={() => setOnlyMistakes(option.value)}
                          className={`rounded-md px-3 py-1 transition-colors ${
                            onlyMistakes === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ResultsList results={onlyMistakes ? mistakes : results} />
              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

// Cómo se cuenta el resultado: sin tono de aprobado o suspenso
function verdict(percentage: number): { title: string; detail: string; emotion: MascotEmotion } {
  if (percentage >= 80) return { title: "¡Lo dominas!", detail: "Buen trabajo. Prueba con más preguntas o con otro material.", emotion: "celebratory" }
  if (percentage >= 50) return { title: "Vas bien", detail: "Repasa las que fallaste y vuelve a intentarlo: cada intento cuenta.", emotion: "encouraging" }
  return { title: "Hay que repasar", detail: "Mira las respuestas correctas abajo y pregúntame en el chat lo que no te cuadre.", emotion: "patient" }
}

// El porcentaje de aciertos en un anillo
function ScoreRing({ percentage }: { percentage: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const color = percentage >= 80 ? "text-green-600 dark:text-green-400" : percentage >= 50 ? "text-primary" : "text-amber-500"
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percentage / 100)}
          className={`${color} transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{percentage}%</span>
    </div>
  )
}
