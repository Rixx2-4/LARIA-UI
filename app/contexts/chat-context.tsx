"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import { lariaAPI, ApiError, Chat, ChatMessage, getAuthToken } from "@/lib/laria-api"
import { useAuth } from "./auth-context"

interface ChatContextType {
  chats: Chat[]
  activeChatId: string | null
  messages: ChatMessage[]
  // Por qué no se pudo abrir el chat activo (p. ej. no existe)
  chatError: string | null
  loadChats: () => Promise<void>
  createChat: (title?: string, documentId?: string) => Promise<Chat>
  selectChat: (chatId: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  addMessage: (chatId: string, role: "user" | "assistant", content: string) => Promise<void>
  setMessages: (msgs: ChatMessage[]) => void
  clearActiveChat: () => void
  generateTitle: (chatId: string, messages: { role: string; content: string }[]) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<string | null>(null)
  const requestedChatIdRef = useRef<string | null>(null)

  // Al cerrar sesión se vacía todo durante el render, sin esperar a un efecto
  const [wasAuthenticated, setWasAuthenticated] = useState(isAuthenticated)
  if (wasAuthenticated !== isAuthenticated) {
    setWasAuthenticated(isAuthenticated)
    if (!isAuthenticated) {
      setChats([])
      setActiveChatId(null)
      setChatError(null)
      setMessages([])
    }
  }

  const loadChats = useCallback(async () => {
    if (!getAuthToken()) return
    try {
      const response = await lariaAPI.chats.list()
      setChats(response.chats)
    } catch (error) {
      console.error("Error loading chats:", error)
      setChats([])
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
    setActiveChatId(chat.id)
    setChatError(null)
    setMessages([])
    return chat
  }, [loadChats])

  const selectChat = useCallback(async (chatId: string) => {
    requestedChatIdRef.current = chatId
    setActiveChatId(chatId)
    setChatError(null)
    setMessages([])
    try {
      const chat = await lariaAPI.chats.get(chatId)
      // Si mientras tanto se abrió otro chat, esta respuesta ya no interesa
      if (requestedChatIdRef.current === chatId) setMessages(chat.messages || [])
    } catch (error) {
      if (requestedChatIdRef.current !== chatId) return
      const notFound = error instanceof ApiError && (error.status === 404 || error.status === 403)
      setChatError(notFound ? "Este chat no existe" : "No se pudo cargar el chat")
    }
  }, [])

  const deleteChat = useCallback(async (chatId: string) => {
    await lariaAPI.chats.delete(chatId)
    if (activeChatId === chatId) {
      setActiveChatId(null)
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
    setChatError(null)
    setMessages([])
  }, [])

  const generateTitle = useCallback(async (chatId: string, msgs: { role: string; content: string }[]) => {
    try {
      const response = await lariaAPI.chats.generateTitle(msgs)
      await lariaAPI.chats.update(chatId, { title: response.title })
      await loadChats()
    } catch (error) {
      console.error("Error generating title:", error)
      if (msgs.length > 0 && msgs[0].content) {
        const fallbackTitle = msgs[0].content.length > 50
          ? msgs[0].content.substring(0, 50).trim() + "..."
          : msgs[0].content.trim()
        try {
          await lariaAPI.chats.update(chatId, { title: fallbackTitle })
          await loadChats()
        } catch (updateError) {
          console.error("Error updating fallback title:", updateError)
        }
      }
    }
  }, [loadChats])

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        messages,
        chatError,
        loadChats,
        createChat,
        selectChat,
        deleteChat,
        addMessage,
        setMessages,
        clearActiveChat,
        generateTitle,
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
