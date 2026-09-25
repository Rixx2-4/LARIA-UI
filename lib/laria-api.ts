const API_BASE_URL = process.env.NEXT_PUBLIC_LARIA_API_URL || "http://localhost:8000/api/v1"

// Metadatos que el tutor adjunta a cada respuesta
interface TutorEnvelope {
  type?: string
  emotion?: string
  grounded?: boolean
  quiz_id?: string
  [key: string]: unknown
}

interface ChatMessage {
  // "system": notas y avisos que no son de nadie (el backend no responde a ellas)
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
  metadata?: {
    source?: string
    type?: string
    emotion?: string
    envelope?: TutorEnvelope
    [key: string]: unknown
  }
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

interface User {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface AuthResponse {
  access_token: string
  token_type: string
}

interface QuizAttemptSummary {
  attempt_id: string
  quiz_id: string
  document_id: string
  score: number
  total_points: number
  completed_at: string
}

interface TutorInteraction {
  id: string
  document_id: string
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
  document_id: string
  questions: QuizQuestion[]
  total_points: number
  created_at: string
}

interface QuizAttemptQuestion {
  index: number
  text: string
  selected: string
  correct_answer: string
  is_correct: boolean
}

interface QuizAttemptResponse {
  attempt_id: string
  quiz_id: string
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

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem("laria_token", token)
  } else {
    localStorage.removeItem("laria_token")
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("laria_token")
  }
  return authToken
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

// Convierte una respuesta fallida en ApiError; un 401 además cierra la sesión,
// salvo que la petición se hiciera con un token que ya no es el actual
async function responseError(response: Response, fallback: string, sentToken: string | null): Promise<ApiError> {
  const body = await response.json().catch(() => ({ detail: fallback }))
  if (response.status === 401 && sentToken && sentToken === getAuthToken()) {
    setAuthToken(null)
    unauthorizedListeners.forEach((listener) => listener())
  }
  return new ApiError(describeErrorDetail(body.detail, `Error ${response.status}`), response.status)
}

// Un id va siempre como un solo tramo de la ruta: uno manipulado en la URL
// ("../users/me") no puede apuntar a otro endpoint
const segment = (id: string) => encodeURIComponent(id)

// Petición autenticada a la API; si falla, lanza un ApiError con el motivo en español
async function request(endpoint: string, init: RequestInit = {}, fallback = "Error desconocido"): Promise<Response> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
    ...authHeaders(token),
  }
  // Solo con cuerpo JSON: así los GET no necesitan la petición previa de CORS
  if (typeof init.body === "string") headers["Content-Type"] ??= "application/json"

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...init, headers })
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
    login: async (email: string, password: string): Promise<AuthResponse> => {
      const formData = new URLSearchParams()
      formData.append("username", email)
      formData.append("password", password)
      
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      })

      if (!response.ok) {
        // El detalle del backend puede venir en inglés; los casos habituales se dicen en español
        if (response.status === 401) throw new Error("Email o contraseña incorrectos")
        if (response.status === 429) throw new Error("Demasiados intentos. Espera un momento y vuelve a probar")
        const error = await response.json().catch(() => ({ detail: "Error de autenticación" }))
        throw new Error(describeErrorDetail(error.detail, "Error de autenticación"))
      }

      const data = await response.json()
      setAuthToken(data.access_token)
      return data
    },

    register: (username: string, email: string, password: string) =>
      fetchAPI<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      }),

    logout: () => {
      setAuthToken(null)
    },

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
          ? "Se perdió la conexión con LARIA"
          : error.message
        callbacks.onError?.(new Error(message))
        return
      }
      callbacks.onDone?.()
    },

    generateQuiz: (chatId: string, numQuestions: number = 5) =>
      fetchAPI<QuizResponse>(`/chats/${segment(chatId)}/quiz?num_questions=${numQuestions}`),

    generateTitle: (messages: { role: string; content: string }[]) =>
      fetchAPI<{ title: string }>("/chats/generate-title", {
        method: "POST",
        body: JSON.stringify({ messages }),
      }),
  },

  quizzes: {
    submitAttempt: (quizId: string, answers: Record<string, string>) =>
      fetchAPI<QuizAttemptResponse>(`/quizzes/${segment(quizId)}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
  },

  learning: {
    history: () => fetchAPI<LearningHistory>("/learning/me"),
    profile: () => fetchAPI<StudentProfile>("/learning/me/profile"),
  },

  documents: {
    list: () => fetchAPI<Document[]>("/documents/"),

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
  Chat, ChatMessage, ChatListResponse, User, AuthResponse,
  LearningHistory, StudentProfile, Document, AnalysisResponse, QuestionResponse,
  QuizAttemptSummary, TutorInteraction, LearningRecommendation,
  PedagogicalMemory, DocumentMastery, ConceptMastery,
  QuizResponse, QuizQuestion, QuizAttemptResponse, QuizAttemptQuestion,
  StreamCallbacks, TutorEnvelope,
}
