"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import { lariaAPI, ApiError, Chat, ChatMessage, getAuthToken } from "@/lib/laria-api"
import { toast } from "sonner"
import { titleRequestMessages, fallbackTitle } from "@/lib/chat-titles"
import { useAuth } from "./auth-context"

const MAX_TITLE_ATTEMPTS = 3

export type ChatLoadError = "not-found" | "load-failed"

interface ChatContextType {
  chats: Chat[]
  // false hasta que llega la primera lista (para no decir "no hay chats" mientras carga)
  chatsLoaded: boolean
  activeChatId: string | null
  // El documento vinculado al chat activo, según el servidor
  activeDocumentId: string | null
  messages: ChatMessage[]
  // Por qué no se pudo abrir el chat activo
  chatError: ChatLoadError | null
  loadChats: () => Promise<void>
  createChat: (title?: string, documentId?: string) => Promise<Chat>
  selectChat: (chatId: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  // provisional: un título de apoyo que el generado podrá sustituir más tarde
  renameChat: (chatId: string, title: string, options?: { provisional?: boolean }) => Promise<void>
  addMessage: (chatId: string, role: "user" | "assistant", content: string) => Promise<void>
  setMessages: (msgs: ChatMessage[]) => void
  clearActiveChat: () => void
  maybeGenerateTitle: (chatId: string, messages: { role: string; content: string }[]) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [chatsLoaded, setChatsLoaded] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<ChatLoadError | null>(null)
  const requestedChatIdRef = useRef<string | null>(null)
  // Chats recién creados que aún esperan un título generado, con los intentos fallidos
  const pendingTitlesRef = useRef(new Map<string, number>())
  const titleInFlightRef = useRef(new Set<string>())

  // Al cerrar sesión se vacía todo durante el render, sin esperar a un efecto
  const [wasAuthenticated, setWasAuthenticated] = useState(isAuthenticated)
  if (wasAuthenticated !== isAuthenticated) {
    setWasAuthenticated(isAuthenticated)
    if (!isAuthenticated) {
      setChats([])
      setActiveChatId(null)
      setActiveDocumentId(null)
      setChatError(null)
      setMessages([])
    }
  }

  const loadChats = useCallback(async () => {
    if (!getAuthToken()) return
    try {
      const response = await lariaAPI.chats.list()
      setChats(response.chats)
      setChatsLoaded(true)
    } catch (error) {
      console.error("Error loading chats:", error)
      setChats([])
      setChatsLoaded(true)
      toast.error("No se pudieron cargar tus chats")
    }
  }, [])

  useEffect(() => {
    // Carga de datos al iniciar sesión; el estado se actualiza tras el await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) loadChats()
  }, [isAuthenticated, loadChats])

  const createChat = useCallback(async (title?: string, documentId?: string): Promise<Chat> => {
    const chat = await lariaAPI.chats.create(title, documentId)
    await loadChats()
    requestedChatIdRef.current = chat.id
    pendingTitlesRef.current.set(chat.id, 0)
    setActiveChatId(chat.id)
    setActiveDocumentId(chat.document_id ?? documentId ?? null)
    setChatError(null)
    setMessages([])
    return chat
  }, [loadChats])

  const selectChat = useCallback(async (chatId: string) => {
    requestedChatIdRef.current = chatId
    setActiveChatId(chatId)
    setChatError(null)
    setActiveDocumentId(null)
    setMessages([])
    try {
      const chat = await lariaAPI.chats.get(chatId)
      // Si mientras tanto se abrió otro chat, esta respuesta ya no interesa
      if (requestedChatIdRef.current !== chatId) return
      setMessages(chat.messages || [])
      setActiveDocumentId(chat.document_id ?? null)
    } catch (error) {
      if (requestedChatIdRef.current !== chatId) return
      const notFound = error instanceof ApiError && (error.status === 404 || error.status === 403)
      setChatError(notFound ? "not-found" : "load-failed")
    }
  }, [])

  const renameChat = useCallback(async (chatId: string, title: string, options?: { provisional?: boolean }) => {
    // Un nombre puesto a mano manda: ya no se sustituye por uno generado
    if (!options?.provisional) pendingTitlesRef.current.delete(chatId)
    await lariaAPI.chats.update(chatId, { title })
    await loadChats()
  }, [loadChats])

  const deleteChat = useCallback(async (chatId: string) => {
    await lariaAPI.chats.delete(chatId)
    if (activeChatId === chatId) {
      setActiveChatId(null)
      setActiveDocumentId(null)
      setMessages([])
    }
    await loadChats()
  }, [activeChatId, loadChats])

  const addMessage = useCallback(async (chatId: string, role: "user" | "assistant", content: string) => {
    const chat = await lariaAPI.chats.addMessage(chatId, role, content)
    setMessages(chat.messages || [])
  }, [])

  const clearActiveChat = useCallback(() => {
    requestedChatIdRef.current = null
    setActiveChatId(null)
    setActiveDocumentId(null)
    setChatError(null)
    setMessages([])
  }, [])

  // Tras cada respuesta, mientras el chat no tenga título, se pide al backend con la
  // conversación hasta ese momento; si falla se reintenta en la siguiente respuesta
  const maybeGenerateTitle = useCallback(async (chatId: string, msgs: { role: string; content: string }[]) => {
    const failures = pendingTitlesRef.current.get(chatId)
    if (failures === undefined || titleInFlightRef.current.has(chatId)) return
    const request = titleRequestMessages(msgs)
    if (request.length === 0) return

    titleInFlightRef.current.add(chatId)
    try {
      const { title } = await lariaAPI.chats.generateTitle(request)
      if (!pendingTitlesRef.current.has(chatId)) return // renombrado a mano mientras tanto
      pendingTitlesRef.current.delete(chatId)
      await lariaAPI.chats.update(chatId, { title: title.trim() })
      await loadChats()
    } catch (error) {
      console.error("Error generating title:", error)
      if (!pendingTitlesRef.current.has(chatId)) return
      if (failures + 1 < MAX_TITLE_ATTEMPTS) {
        pendingTitlesRef.current.set(chatId, failures + 1)
        return
      }
      pendingTitlesRef.current.delete(chatId)
      const fallback = fallbackTitle(msgs)
      if (fallback) {
        await lariaAPI.chats.update(chatId, { title: fallback }).catch(() => {})
        await loadChats()
      }
    } finally {
      titleInFlightRef.current.delete(chatId)
    }
  }, [loadChats])

  return (
    <ChatContext.Provider
      value={{
        chats,
        chatsLoaded,
        activeChatId,
        activeDocumentId,
        messages,
        chatError,
        loadChats,
        createChat,
        selectChat,
        deleteChat,
        renameChat,
        addMessage,
        setMessages,
        clearActiveChat,
        maybeGenerateTitle,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
