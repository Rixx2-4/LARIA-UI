"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { lariaAPI, Chat, ChatMessage, getAuthToken } from "@/lib/laria-api"
import { useAuth } from "./auth-context"

interface ChatContextType {
  chats: Chat[]
  activeChatId: string | null
  messages: ChatMessage[]
  isLoading: boolean
  loadChats: () => Promise<void>
  createChat: (title?: string) => Promise<Chat>
  selectChat: (chatId: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  addMessage: (chatId: string, role: "user" | "assistant", content: string) => Promise<void>
  setMessages: (msgs: ChatMessage[]) => void
  clearActiveChat: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadChats = useCallback(async () => {
    if (!getAuthToken()) {
      setChats([])
      return
    }
    try {
      const response = await lariaAPI.chats.list()
      setChats(response.chats)
    } catch (error) {
      console.error("Error loading chats:", error)
      setChats([])
    }
  }, [])

  const loadChatMessages = useCallback(async (chatId: string) => {
    if (!getAuthToken()) {
      setMessages([])
      return
    }
    try {
      const chat = await lariaAPI.chats.get(chatId)
      const realMessages = (chat.messages || []).filter(
        (m: { metadata?: { source?: string } }) => m.metadata?.source !== "tutor"
      )
      setMessages(realMessages)
    } catch (error) {
      console.error("Error loading chat messages:", error)
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadChats()
    } else {
      setChats([])
      setActiveChatId(null)
      setMessages([])
    }
  }, [isAuthenticated, loadChats])

  useEffect(() => {
    if (activeChatId) {
      loadChatMessages(activeChatId)
    } else {
      setMessages([])
    }
  }, [activeChatId, loadChatMessages])

  const createChat = useCallback(async (title?: string): Promise<Chat> => {
    const chat = await lariaAPI.chats.create(title)
    await loadChats()
    setActiveChatId(chat.id)
    setMessages([])
    return chat
  }, [loadChats])

  const selectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId)
    await loadChatMessages(chatId)
  }, [loadChatMessages])

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
    const realMessages = (chat.messages || []).filter(
      (m: { metadata?: { source?: string } }) => m.metadata?.source !== "tutor"
    )
    setMessages(realMessages)
  }, [])

  const clearActiveChat = useCallback(() => {
    setActiveChatId(null)
    setMessages([])
  }, [])

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        messages,
        isLoading,
        loadChats,
        createChat,
        selectChat,
        deleteChat,
        addMessage,
        setMessages,
        clearActiveChat,
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
