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
      setMessages(chat.messages || [])
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

  const createChat = useCallback(async (title?: string, documentId?: string): Promise<Chat> => {
    const chat = await lariaAPI.chats.create(title, documentId)
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
    setMessages(chat.messages || [])
  }, [])

  const clearActiveChat = useCallback(() => {
    setActiveChatId(null)
    setMessages([])
  }, [])

  const generateTitle = useCallback(async (chatId: string, msgs: { role: string; content: string }[]) => {
    try {
      const response = await lariaAPI.chats.generateTitle(msgs)
      await lariaAPI.chats.update(chatId, { title: response.title })
      await loadChats()
    } catch (error) {
      console.error("Error generating title:", error)
    }
  }, [loadChats])

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
