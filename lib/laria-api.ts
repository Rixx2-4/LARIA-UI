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
  role: "user" | "assistant"
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

// Convierte una respuesta fallida en ApiError; un 401 además cierra la sesión,
// salvo que la petición se hiciera con un token que ya no es el actual
async function responseError(response: Response, fallback: string, sentToken: string | null): Promise<ApiError> {
  const body = await response.json().catch(() => ({ detail: fallback }))
  if (response.status === 401 && sentToken && sentToken === getAuthToken()) {
    setAuthToken(null)
    unauthorizedListeners.forEach((listener) => listener())
  }
  return new ApiError(body.detail || `Error ${response.status}`, response.status)
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getAuthToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
    ...authHeaders(token),
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw await responseError(response, "Error desconocido", token)
  }

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
        throw new Error(error.detail || "Error de autenticación")
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

    get: (chatId: string) => fetchAPI<Chat>(`/chats/${chatId}`),

    create: (title?: string, documentId?: string) =>
      fetchAPI<Chat>("/chats/", {
        method: "POST",
        body: JSON.stringify({ title, document_id: documentId }),
      }),

    update: (chatId: string, data: { title?: string; document_id?: string }) =>
      fetchAPI<Chat>(`/chats/${chatId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    delete: (chatId: string) =>
      fetchAPI<void>(`/chats/${chatId}`, {
        method: "DELETE",
      }),

    addMessage: (chatId: string, role: "user" | "assistant", content: string) =>
      fetchAPI<Chat>(`/chats/${chatId}/messages`, {
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
      const url = `${API_BASE_URL}/chats/${chatId}/stream`
      const token = getAuthToken()
      const headers = { "Content-Type": "application/json", ...authHeaders(token) }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ role, content }),
          signal: options.signal,
        })

        if (!response.ok) {
          throw await responseError(response, "Error de streaming", token)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No se pudo leer el stream")

        const decoder = new TextDecoder()
        let buffer = ""

        // Devuelve true cuando llega el [DONE]
        const handleLine = (line: string): boolean => {
          if (!line.startsWith("data:")) return false
          const data = line.slice(5).replace(/^ /, "")
          if (data === "[DONE]") return true
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === "token") {
              callbacks.onToken?.(parsed.content || "")
            } else if (parsed.type === "envelope") {
              callbacks.onEnvelope?.(parsed)
            }
          } catch {
            callbacks.onToken?.(data)
          }
          return false
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
            handleLine(buffer)
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
      fetchAPI<QuizResponse>(`/chats/${chatId}/quiz?num_questions=${numQuestions}`),

    generateTitle: (messages: { role: string; content: string }[]) =>
      fetchAPI<{ title: string }>("/chats/generate-title", {
        method: "POST",
        body: JSON.stringify({ messages }),
      }),
  },

  quizzes: {
    submitAttempt: (quizId: string, answers: Record<string, string>) =>
      fetchAPI<QuizAttemptResponse>(`/quizzes/${quizId}/attempts`, {
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

      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      })

      if (!response.ok) {
        throw await responseError(response, "Error de subida", token)
      }

      return response.json()
    },

    // El archivo original, para previsualizarlo o descargarlo
    content: async (documentId: string): Promise<Blob> => {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}/content`, {
        headers: authHeaders(token),
      })
      if (!response.ok) {
        throw await responseError(response, "Error al cargar el archivo", token)
      }
      return response.blob()
    },

    analyze: (documentId: string) =>
      fetchAPI<AnalysisResponse>(`/documents/${documentId}/analyze`, {
        method: "POST",
      }),

    ask: (documentId: string, question: string) =>
      fetchAPI<QuestionResponse>(`/documents/${documentId}/ask`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }),

    delete: (documentId: string) =>
      fetchAPI<void>(`/documents/${documentId}`, {
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
