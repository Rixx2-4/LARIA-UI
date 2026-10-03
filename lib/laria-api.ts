const API_BASE_URL = process.env.NEXT_PUBLIC_LARIA_API_URL || "http://localhost:8000/api/v1"

// Metadatos que el tutor adjunta a cada respuesta. El backend los guarda tal cual
// en `metadata` del mensaje: { type, emotion, payload: { content, intent, grounded, … } }
interface TutorEnvelope {
  type?: string
  emotion?: string
  payload?: {
    content?: string
    // "learn" con cualquier pregunta conceptual; no sirve para decidir si ofrecer nivelación
    intent?: string
    grounded?: boolean
    // Solo cuando pidió aprender un TEMA ("quiero aprender X"): ofrecer la nivelación
    suggest_placement?: boolean
    // El tema tal como lo escribió el estudiante, con tildes
    topic_hint?: string
    // Pidió un quiz ("ponme un quiz de X"): abrir uno interactivo, con topic_hint si nombró tema
    offer_quiz?: boolean
    // Ya se niveló en el tema: la clase parte de este nivel (y no se ofrece nivelarse)
    placement_level?: PlacementLevel
    // El tutor pregunta cómo prefiere aprender (con las 7 opciones en el texto)
    ask_learning_style?: boolean
    // Contestó en el chat ("la 4", "paso a paso") y el backend ya lo guardó; null = que decida LARIA
    explanation_style_chosen?: ExplanationStyle | null
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface ChatMessage {
  // "system": notas y avisos que no son de nadie (el backend no responde a ellas)
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
  metadata?: TutorEnvelope | null
}

interface Chat {
  id: string
  title: string
  document_id?: string | null
  messages?: ChatMessage[]
  message_count?: number
  last_message_preview?: string
  created_at: string
  updated_at: string
}

interface ChatListResponse {
  chats: Chat[]
}

export interface SpeechConfig {
  enabled: boolean
  max_chars: number
}

export type SpeechEmotion = "calm" | "encouraging" | "patient" | "celebratory"

interface User {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  auth_provider?: string
}

interface QuizAttemptSummary {
  attempt_id: string
  quiz_id: string
  // null en una ronda de nivelación, que no nace de un documento
  document_id: string | null
  score: number
  total_points: number
  completed_at: string
}

interface TutorInteraction {
  id: string
  document_id: string | null
  question: string
  answer: string
  asked_at: string
}

interface LearningRecommendation {
  kind: string
  message: string
  document_id: string | null
  concept: string | null
  priority: number
  suggested_minutes: number | null
}

interface LearningHistory {
  attempts: QuizAttemptSummary[]
  tutor_interactions: TutorInteraction[]
  recommendations: LearningRecommendation[]
}

interface PedagogicalMemory {
  frequent_misconceptions: string[]
  successful_examples: string[]
  successful_analogies: string[]
  preferred_explanation_style: string
  last_effective_strategies: string[]
}

interface DocumentMastery {
  document_id: string
  attempts: number
  mastery: number
  last_score_ratio: number
  struggle_signals: number
}

interface ConceptMastery {
  concept_key: string
  attempts: number
  mastery: number
  last_score_ratio: number
  effective_mastery: number
  confidence: number
  last_practiced_at: string | null
  subject: string | null
  help_requests: number
  error_streak: number
}

interface StudentProfile {
  student_id: string
  pace: string
  total_attempts: number
  total_struggle_signals: number
  frequent_errors: string[]
  updated_at: string
  learning_velocity: number
  pedagogical_memory: PedagogicalMemory | null
  mastery_by_document: DocumentMastery[]
  mastery_by_concept: ConceptMastery[]
  // Nivel alcanzado en cada tema nivelado, por clave interna del tema ({} si ninguno)
  level_by_topic?: Record<string, PlacementLevel>
  // El nombre para mostrar de cada clave, con tildes; las nivelaciones antiguas no lo tienen
  topic_labels?: Record<string, string>
  // Cómo eligió que le expliquen (null si no eligió; lo deducido va en pedagogical_memory)
  explanation_style_choice?: ExplanationStyle | null
}

interface Document {
  id: string
  owner_id: string
  filename: string
  subject: string
  status: string
  uploaded_at: string
  has_analysis: boolean
  error_message: string | null
}

interface AnalysisResponse {
  summary: string
  key_concepts: string[]
  suggested_questions: string[]
}

interface QuestionResponse {
  answer: string
}

interface QuizQuestion {
  index: number
  text: string
  options: Record<string, string>
  difficulty: string
}

interface QuizResponse {
  id: string
  // null en una ronda de nivelación
  document_id: string | null
  // El tema nivelado, con el nombre canónico del backend ("ecuaciones" → "ecuaciones lineales")
  topic?: string | null
  // El tema como lo escribió el estudiante, con tildes, para mostrarlo (aún no en Render)
  topic_label?: string | null
  questions: QuizQuestion[]
  total_points: number
  created_at: string
}

interface QuizAttemptQuestion {
  index: number
  text: string
  selected: string | null
  correct_answer: string
  is_correct: boolean
}

// Ruta de aprendizaje guiada (ADR-028): evaluación → ruta → clase por conceptos,
// con una comprobación corta tras cada explicación
type PathModuleStatus = "locked" | "available" | "in_progress" | "completed" | "assumed"
type TeachingPhase = "assessment" | "teaching" | "check" | "remediation" | "advance" | "completed"
type CheckOutcome = "understood" | "partial" | "not_understood"

interface PathModule {
  title: string
  concept: string
  // "prerequisite": algo que hace falta saber antes del tema
  kind: "content" | "prerequisite"
  status: PathModuleStatus
  mastery: number
  position: number
}

interface TeachingState {
  phase: TeachingPhase
  concept: string | null
  concept_title: string | null
  // En un repaso: el concepto al que se vuelve después
  return_to: string | null
  return_to_title: string | null
  variant: string | null
  pending_check_quiz_id: string | null
  last_outcome: CheckOutcome | null
  passed_concepts: string[]
  reason: string | null
}

interface LearningPath {
  id: string
  // Tema de la clase; vacío en las rutas creadas a mano (no son clases)
  topic?: string | null
  title?: string | null
  modules: PathModule[]
  // De 0 a 1: módulos completados sobre el total
  progress?: number
  updated_at?: string
  teaching: TeachingState | null
}

// Cómo seguir tras completar una ruta: el mismo tema a otro nivel o temas nuevos
interface NextSuggestion {
  topic: string
  label: string
  // level_up: el mismo tema, un nivel más (siempre con nivelación)
  kind: "advance" | "level_up" | "related"
  reason: string
  needs_placement: boolean
}

// Cuánto estudiar: duración de cada sesión de clase y objetivo diario (null = sin límite)
type SessionMinutes = 10 | 20 | 30 | 45
type DailyGoalMinutes = 10 | 15 | 30 | 45 | 60

interface StudyGoals {
  session_minutes: SessionMinutes | null
  daily_goal_minutes: DailyGoalMinutes | null
}

interface StudyTimeSummary {
  today_minutes: number
  daily_goal_minutes: number | null
  session_minutes: number | null
  goal_met_today: boolean
  // Días seguidos cumpliendo el objetivo (o estudiando algo, sin objetivo)
  streak_days: number
  last_7_days: { date: string; minutes: number }[]
}

// Voces del tutor (ADR-030): 3 masculinas y 3 femeninas; la elegida se guarda en el perfil
interface TutorVoice {
  id: string
  label: string
  gender: "masculina" | "femenina"
  description: string
}

interface VoicesResponse {
  voices: TutorVoice[]
  default: string
  // La elegida; null = la de por defecto
  selected: string | null
  sample_text: string
  // Frase de ejemplo por género («tu tutor» / «tu tutora»), si el backend la manda
  sample_texts?: Partial<Record<TutorVoice["gender"], string>>
}

interface LessonResponse {
  path: LearningPath
  markdown: string | null
  // La comprobación (sin respuestas); null cuando la ruta está completada
  check: QuizResponse | null
}

interface CheckNext {
  phase: TeachingPhase
  concept: string | null
  concept_title: string | null
  variant: string | null
  reason: string | null
}

interface CheckResponse {
  outcome: CheckOutcome
  score: number
  total_points: number
  questions: QuizAttemptQuestion[]
  next: CheckNext
  path: LearningPath
}

type PlacementLevel = "basico" | "intermedio" | "avanzado"

// Cómo prefiere que le expliquen; vale para todo, con y sin material
type ExplanationStyle = "simple" | "step_by_step" | "analogy" | "visual" | "mathematical" | "technical"

// Veredicto de una ronda de nivelación
interface PlacementResult {
  topic: string
  // Para mostrar; `topic` es la clave canónica (aún no en Render)
  topic_label?: string | null
  round: "base" | "avanzada"
  level: PlacementLevel
  passed: boolean
  // Si hay otra ronda que ofrecer: se pide con el mismo tema, el backend sabe cuál toca
  has_next_round: boolean
}

interface QuizAttemptResponse {
  attempt_id: string
  quiz_id: string
  document_id?: string | null
  // Solo en rondas de nivelación
  placement?: PlacementResult | null
  score: number
  total_points: number
  questions: QuizAttemptQuestion[]
  completed_at: string
}

interface StreamCallbacks {
  onToken?: (token: string) => void
  onEnvelope?: (envelope: Record<string, unknown>) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

// La sesión la lleva Clerk: quien la conoce (ClerkBridge) registra aquí cómo pedir
// el token, y cada petición pide uno al salir (dura ~60 s; Clerk lo renueva solo)
type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>
export type SessionState = "loading" | "signed-in" | "signed-out"

let tokenGetter: TokenGetter | null = null
let sessionState: SessionState = "loading"
const sessionListeners = new Set<() => void>()

export function setSession(state: SessionState, getter: TokenGetter | null = null) {
  sessionState = state
  tokenGetter = state === "signed-in" ? getter : null
  sessionListeners.forEach((listener) => listener())
}

export function getSessionState(): SessionState {
  return sessionState
}

export function onSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

// Salir lo hace Clerk (ClerkBridge registra cómo); sin él, basta olvidar la sesión
let signOutHandler: (() => Promise<unknown> | void) | null = null

export function setSignOutHandler(handler: (() => Promise<unknown> | void) | null) {
  signOutHandler = handler
}

export async function signOut() {
  if (signOutHandler) await signOutHandler()
  else setSession("signed-out")
}

// Una sesión con un token fijo (los tests); null, sin sesión
export function setAuthToken(token: string | null) {
  setSession(token ? "signed-in" : "signed-out", token ? async () => token : null)
}

// Las sesiones de antes de Clerk guardaban su token aquí: ya no vale
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("laria_token")
  } catch {
    // Sin almacenamiento no hay nada que limpiar
  }
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// Quien necesite enterarse de que la sesión caducó (el AuthProvider) se suscribe aquí
const unauthorizedListeners = new Set<() => void>()

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

const FIELD_NAMES: Record<string, string> = {
  username: "El nombre de usuario",
  email: "El email",
  password: "La contraseña",
}

interface ValidationIssue {
  type?: string
  loc?: (string | number)[]
  msg?: string
  ctx?: { min_length?: number; max_length?: number }
}

// Un error de validación del backend (en inglés y con jerga) contado en español
function describeIssue(issue: ValidationIssue): string {
  const key = String(issue.loc?.[issue.loc.length - 1] ?? "")
  const field = FIELD_NAMES[key] ?? "Un campo"
  switch (issue.type) {
    case "missing":
      return `${field} es obligatorio.`
    case "string_too_short":
      return `${field} debe tener al menos ${issue.ctx?.min_length} caracteres.`
    case "string_too_long":
      return `${field} no puede tener más de ${issue.ctx?.max_length} caracteres.`
  }
  if (key === "email") return "El email no es válido."
  // Los validadores propios del backend ya escriben en español
  return (issue.msg ?? "").replace(/^Value error, /, "") || `${field} no es válido.`
}

// El "detail" de FastAPI puede ser un texto o una lista de errores de validación
export function describeErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((issue: ValidationIssue) => describeIssue(issue)).join(" ")
  }
  return fallback
}

// Convierte una respuesta fallida en ApiError; un 401 con sesión (ya reintentado
// con un token nuevo) la cierra
async function responseError(response: Response, fallback: string, sentToken: string | null): Promise<ApiError> {
  const body = await response.json().catch(() => ({ detail: fallback }))
  if (response.status === 401 && sentToken) {
    unauthorizedListeners.forEach((listener) => listener())
  }
  return new ApiError(describeErrorDetail(body.detail, `Error ${response.status}`), response.status)
}

// Un id va siempre como un solo tramo de la ruta: uno manipulado en la URL
// ("../users/me") no puede apuntar a otro endpoint
const segment = (id: string) => encodeURIComponent(id)

// Petición autenticada a la API; si falla, lanza un ApiError con el motivo en español
async function request(endpoint: string, init: RequestInit = {}, fallback = "Error desconocido"): Promise<Response> {
  const send = async (skipCache: boolean) => {
    const token = tokenGetter ? await tokenGetter(skipCache ? { skipCache: true } : undefined) : null
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string>) || {}),
      ...authHeaders(token),
    }
    // Solo con cuerpo JSON: así los GET no necesitan la petición previa de CORS
    if (typeof init.body === "string") headers["Content-Type"] ??= "application/json"
    return { token, response: await fetch(`${API_BASE_URL}${endpoint}`, { ...init, headers }) }
  }

  let { token, response } = await send(false)
  // Un token recién caducado: se pide uno nuevo y se reintenta una sola vez
  if (response.status === 401 && token && tokenGetter) ({ token, response } = await send(true))
  if (!response.ok) throw await responseError(response, fallback, token)
  return response
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await request(endpoint, options)

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const lariaAPI = {
  auth: {
    // Entrar, registrarse y salir lo hace Clerk; el backend solo dice quién eres
    me: () => fetchAPI<User>("/users/me"),
  },

  chats: {
    list: () => fetchAPI<ChatListResponse>("/chats/"),

    get: (chatId: string) => fetchAPI<Chat>(`/chats/${segment(chatId)}`),

    create: (title?: string, documentId?: string) =>
      fetchAPI<Chat>("/chats/", {
        method: "POST",
        body: JSON.stringify({ title, document_id: documentId }),
      }),

    update: (chatId: string, data: { title?: string; document_id?: string }) =>
      fetchAPI<Chat>(`/chats/${segment(chatId)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    delete: (chatId: string) =>
      fetchAPI<void>(`/chats/${segment(chatId)}`, {
        method: "DELETE",
      }),

    // Ojo: con role "user" el backend ejecuta un turno completo del tutor;
    // para dejar solo una nota en el chat, usar "system"
    addMessage: (chatId: string, role: "user" | "assistant" | "system", content: string) =>
      fetchAPI<Chat>(`/chats/${segment(chatId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ role, content }),
      }),

    stream: async (
      chatId: string,
      role: "user" | "assistant",
      content: string,
      callbacks: StreamCallbacks,
      options: { signal?: AbortSignal } = {}
    ): Promise<void> => {
      try {
        const response = await request(
          `/chats/${segment(chatId)}/stream`,
          { method: "POST", body: JSON.stringify({ role, content }), signal: options.signal },
          "Error de streaming",
        )

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No se pudo leer el stream")

        const decoder = new TextDecoder()
        let buffer = ""
        // El evento en curso: "event: token" + "data: {...}" hasta la línea en blanco
        let eventName = ""
        let dataLines: string[] = []

        // Entrega un evento completo; devuelve true cuando la respuesta terminó.
        // El backend nombra cada evento (thinking, token, envelope, done, error);
        // sin nombre, se mira el "type" del JSON o el [DONE] del formato anterior.
        const dispatch = (): boolean => {
          const name = eventName
          const data = dataLines.join("\n")
          eventName = ""
          dataLines = []
          if (!data) return false
          if (data === "[DONE]") return true

          let parsed: Record<string, unknown> | null = null
          try {
            parsed = JSON.parse(data)
          } catch {
            if (!name) callbacks.onToken?.(data)
            return false
          }
          switch (name || parsed?.type) {
            case "token":
              callbacks.onToken?.(typeof parsed?.content === "string" ? parsed.content : "")
              return false
            case "envelope":
              callbacks.onEnvelope?.(parsed ?? {})
              return false
            case "done":
              return true
            case "error": {
              const payload = parsed?.payload as { content?: unknown } | undefined
              throw new Error(
                typeof payload?.content === "string" ? payload.content : "No pude generar la respuesta. Intenta de nuevo.",
              )
            }
            default:
              return false
          }
        }

        // Devuelve true cuando la respuesta terminó
        const handleLine = (line: string): boolean => {
          if (line === "") return dispatch()
          if (line.startsWith("event:")) eventName = line.slice(6).trim()
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""))
          return false
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
            buffer.split(/\r?\n/).forEach(handleLine)
            dispatch()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ""

          if (lines.some(handleLine)) {
            reader.cancel().catch(() => {})
            break
          }
        }
      } catch (error) {
        if (options.signal?.aborted) return
        // fetch y reader.read() fallan con TypeError cuando la red se cae
        const message = error instanceof TypeError || !(error instanceof Error)
          ? "Se perdió la conexión con Plenum"
          : error.message
        callbacks.onError?.(new Error(message))
        return
      }
      callbacks.onDone?.()
    },

    // Genera (y guarda) un quiz nuevo: es un POST, el backend responde 405 a un GET
    generateQuiz: (chatId: string, numQuestions: number = 5) =>
      fetchAPI<QuizResponse>(`/chats/${segment(chatId)}/quiz?num_questions=${numQuestions}`, { method: "POST" }),

    generateTitle: (messages: { role: string; content: string }[]) =>
      fetchAPI<{ title: string }>("/chats/generate-title", {
        method: "POST",
        body: JSON.stringify({ messages }),
      }),
  },

  quizzes: {
    // Quiz de práctica sobre un tema, sin documento: deja evidencia pero no cambia el nivel
    practice: (topic: string, numQuestions: number = 5) =>
      fetchAPI<QuizResponse>("/quizzes/practice", {
        method: "POST",
        body: JSON.stringify({ topic, num_questions: numQuestions }),
      }),

    // Una ronda de nivelación sobre un tema; el backend decide si toca la base o la avanzada
    diagnostic: (topic: string) =>
      fetchAPI<QuizResponse>("/quizzes/diagnostic", {
        method: "POST",
        body: JSON.stringify({ topic }),
      }),

    submitAttempt: (quizId: string, answers: Record<string, string>) =>
      fetchAPI<QuizAttemptResponse>(`/quizzes/${segment(quizId)}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
  },

  // Voz del tutor (ADR-026): el backend limpia el texto (markdown, fórmulas, código)
  // y devuelve MP3. Se manda el trozo tal cual se ve en pantalla
  speech: {
    voices: () => fetchAPI<VoicesResponse>("/speech/voices"),

    // null vuelve a la voz por defecto
    setVoice: (voice: string | null) =>
      fetchAPI<{ voice: string | null }>("/speech/voice", { method: "PUT", body: JSON.stringify({ voice }) }),

    // Sin el endpoint (backend antiguo) o sin conexión, no hay voz: se lee solo texto
    config: async (): Promise<SpeechConfig> => {
      try {
        const response = await request("/speech/config")
        const data = await response.json()
        return { enabled: data?.enabled === true, max_chars: Number(data?.max_chars) > 0 ? Number(data.max_chars) : 1200 }
      } catch {
        return { enabled: false, max_chars: 1200 }
      }
    },

    // null (204) si, limpio, no queda nada que decir. Sin voice, la que eligió el estudiante
    synthesize: async (text: string, emotion: SpeechEmotion, signal?: AbortSignal, voice?: string): Promise<Blob | null> => {
      const body = voice ? { text, emotion, voice } : { text, emotion }
      const response = await request("/speech", { method: "POST", body: JSON.stringify(body), signal }, "No se pudo leer en voz")
      if (response.status === 204) return null
      return response.blob()
    },
  },

  paths: {
    // Idempotente: si la ruta del tema ya existe, devuelve la misma con su estado
    fromTopic: (topic: string) =>
      fetchAPI<LearningPath>("/learning/paths/from-topic", { method: "POST", body: JSON.stringify({ topic }) }),

    // Hasta 3 formas de seguir tras completarla (la primera vez tarda ~2 s)
    next: async (pathId: string): Promise<NextSuggestion[]> =>
      (await fetchAPI<{ suggestions: NextSuggestion[] }>(`/learning/paths/${segment(pathId)}/next`)).suggestions ?? [],

    list: async (): Promise<LearningPath[]> => (await fetchAPI<{ paths: LearningPath[] }>("/learning/paths")).paths ?? [],

    get: (pathId: string) => fetchAPI<LearningPath>(`/learning/paths/${segment(pathId)}`),

    // Con una comprobación pendiente devuelve la MISMA: recargar la clase es seguro
    lesson: (pathId: string) => fetchAPI<LessonResponse>(`/learning/paths/${segment(pathId)}/lesson`, { method: "POST" }),

    check: (pathId: string, quizId: string, answers: Record<number, string>) =>
      fetchAPI<CheckResponse>(`/learning/paths/${segment(pathId)}/check`, {
        method: "POST",
        body: JSON.stringify({
          quiz_id: quizId,
          answers: Object.fromEntries(Object.entries(answers).map(([index, letter]) => [String(index), letter])),
        }),
      }),
  },

  study: {
    goals: () => fetchAPI<StudyGoals>("/learning/me/study-goals"),

    setGoals: (goals: StudyGoals) =>
      fetchAPI<StudyGoals>("/learning/me/study-goals", { method: "PUT", body: JSON.stringify(goals) }),

    // Un aviso por minuto estudiado; el servidor acota lo que cuenta (varias
    // pestañas no suman doble) y devuelve el resumen del día
    ping: (seconds: number, timezone: string) =>
      fetchAPI<StudyTimeSummary>("/learning/me/study-time", { method: "POST", body: JSON.stringify({ seconds, timezone }) }),

    summary: (timezone: string) =>
      fetchAPI<StudyTimeSummary>(`/learning/me/study-time?tz=${encodeURIComponent(timezone)}`),
  },

  learning: {
    history: () => fetchAPI<LearningHistory>("/learning/me"),
    profile: () => fetchAPI<StudentProfile>("/learning/me/profile"),
    // null = "que lo decida LARIA"
    preferences: () => fetchAPI<{ explanation_style: ExplanationStyle | null }>("/learning/me/preferences"),
    setPreferences: (explanationStyle: ExplanationStyle | null) =>
      fetchAPI<{ explanation_style: ExplanationStyle | null }>("/learning/me/preferences", {
        method: "PUT",
        body: JSON.stringify({ explanation_style: explanationStyle }),
      }),
  },

  documents: {
    list: () => fetchAPI<Document[]>("/documents/"),

    get: (documentId: string) => fetchAPI<Document>(`/documents/${segment(documentId)}`),

    upload: async (file: File, subject?: string): Promise<Document> => {
      const formData = new FormData()
      formData.append("file", file)
      if (subject) formData.append("subject", subject)

      const response = await request("/documents/upload", { method: "POST", body: formData }, "Error de subida")
      return response.json()
    },

    // El archivo original, para previsualizarlo o descargarlo
    content: async (documentId: string): Promise<Blob> => {
      const response = await request(`/documents/${segment(documentId)}/content`, {}, "Error al cargar el archivo")
      return response.blob()
    },

    analyze: (documentId: string) =>
      fetchAPI<AnalysisResponse>(`/documents/${segment(documentId)}/analyze`, {
        method: "POST",
      }),

    ask: (documentId: string, question: string) =>
      fetchAPI<QuestionResponse>(`/documents/${segment(documentId)}/ask`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }),

    delete: (documentId: string) =>
      fetchAPI<void>(`/documents/${segment(documentId)}`, {
        method: "DELETE",
      }),
  },
}

export type {
  Chat, ChatMessage, ChatListResponse, User,
  LearningHistory, StudentProfile, Document, AnalysisResponse, QuestionResponse,
  QuizAttemptSummary, TutorInteraction, LearningRecommendation,
  PedagogicalMemory, DocumentMastery, ConceptMastery,
  QuizResponse, QuizQuestion, QuizAttemptResponse, QuizAttemptQuestion,
  StreamCallbacks, TutorEnvelope, PlacementResult, PlacementLevel, ExplanationStyle,
  TutorVoice, VoicesResponse, NextSuggestion, StudyGoals, StudyTimeSummary, SessionMinutes, DailyGoalMinutes,
  LearningPath, PathModule, PathModuleStatus, TeachingState, TeachingPhase, LessonResponse, CheckResponse, CheckOutcome,
}
