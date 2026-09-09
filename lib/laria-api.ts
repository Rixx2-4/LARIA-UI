const API_BASE_URL = process.env.NEXT_PUBLIC_LARIA_API_URL || "http://localhost:8000/api/v1"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp?: string
  metadata?: Record<string, unknown>
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

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getAuthToken()
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }))
    throw new Error(error.detail || `Error ${response.status}`)
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
    
    create: (title?: string) =>
      fetchAPI<Chat>("/chats/", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    
    update: (chatId: string, title: string) =>
      fetchAPI<Chat>(`/chats/${chatId}`, {
        method: "PUT",
        body: JSON.stringify({ title }),
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
  },

  learning: {
    history: () => fetchAPI<LearningHistory>("/learning/me"),
    profile: () => fetchAPI<StudentProfile>("/learning/me/profile"),
  },

  documents: {
    list: () => fetchAPI<Document[]>("/documents/"),

    upload: async (file: File, subject: string): Promise<Document> => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("subject", subject)

      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error de subida" }))
        throw new Error(error.detail || `Error ${response.status}`)
      }

      return response.json()
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
}
