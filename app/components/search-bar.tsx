"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Search, Paperclip, Mic, Send, Loader2, FileText, X } from "lucide-react"
import { useChat } from "@/app/contexts/chat-context"
import { lariaAPI } from "@/lib/laria-api"
import { useAuth } from "@/app/contexts/auth-context"

interface SearchBarProps {
  onRequireAuth?: () => void
}

const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".odt", ".epub",
  ".pptx", ".ppt", ".odp", ".xlsx", ".xls", ".csv", ".ods",
  ".py", ".java", ".c", ".cpp", ".cs", ".js", ".ts", ".html",
  ".css", ".sql", ".json", ".xml", ".php", ".rb",
]

export function SearchBar({ onRequireAuth }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { messages, setMessages, loadChats } = useChat()
  const { isAuthenticated } = useAuth()

  const generateTitle = async (chatId: string, history: { role: string; content: string }[]) => {
    try {
      const titlePrompt = [
        ...history,
        { role: "user", content: "Genera un título muy corto (máximo 5 palabras) que resuma el tema de esta conversación. Responde SOLO con el título, sin comillas ni puntuación extra." },
      ]

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: titlePrompt }),
      })

      const data = await res.json()
      if (res.ok && data.response) {
        const title = data.response.replace(/["']/g, "").trim().slice(0, 50)
        await lariaAPI.chats.update(chatId, title)
        await loadChats()
      }
    } catch {
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!isAuthenticated) {
      onRequireAuth?.()
      return
    }
    if (isUploading) return

    const ext = "." + (file.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`Tipo de archivo no soportado: ${ext}\nFormatos admitidos: ${ALLOWED_EXTENSIONS.join(", ")}`)
      return
    }

    setIsUploading(true)
    try {
      let currentChatId = chatId
      const isNewChat = !currentChatId
      if (!currentChatId) {
        const chat = await lariaAPI.chats.create()
        currentChatId = chat.id
        setChatId(currentChatId)
        await loadChats()
      }

      const doc = await lariaAPI.documents.upload(file, "General")
      await lariaAPI.chats.addMessage(currentChatId, "user", `📎 Subí el archivo: ${file.name}`)

      const analysis = await lariaAPI.documents.analyze(doc.id)

      const summary = `📄 **${file.name}**\n\n**Resumen:**\n${analysis.summary}\n\n**Conceptos clave:**\n${analysis.key_concepts.map((c: string) => `• ${c}`).join("\n")}\n\n**Preguntas sugeridas:**\n${analysis.suggested_questions.map((q: string) => `• ${q}`).join("\n")}`

      await lariaAPI.chats.addMessage(currentChatId, "assistant", summary)

      const chatFinal = await lariaAPI.chats.get(currentChatId)
      const finalMessages = (chatFinal.messages || []).filter(
        (m: { metadata?: { source?: string } }) => m.metadata?.source !== "tutor"
      )
      setMessages(finalMessages)

      if (isNewChat) {
        const history = finalMessages.map(
          (m: { role: string; content: string }) => ({ role: m.role, content: m.content })
        )
        generateTitle(currentChatId, history)
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert(error instanceof Error ? error.message : "Error al subir el archivo")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSend = async () => {
    const userMessage = query.trim()
    if (!userMessage || isLoading) return

    if (!isAuthenticated) {
      onRequireAuth?.()
      return
    }

    setQuery("")
    setIsLoading(true)

    try {
      let currentChatId = chatId
      const isNewChat = !currentChatId
      if (!currentChatId) {
        const chat = await lariaAPI.chats.create()
        currentChatId = chat.id
        setChatId(currentChatId)
        await loadChats()
      }

      const newUserMsg = { role: "user" as const, content: userMessage }
      const updatedLocal = [...messages, newUserMsg]
      setMessages(updatedLocal)

      await lariaAPI.chats.addMessage(currentChatId, "user", userMessage)

      const chatAfterUser = await lariaAPI.chats.get(currentChatId)
      const realMessages = (chatAfterUser.messages || []).filter(
        (m: { metadata?: { source?: string } }) => m.metadata?.source !== "tutor"
      )

      const history = realMessages.map(
        (m: { role: string; content: string }) => ({ role: m.role, content: m.content })
      )

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response")
      }

      await lariaAPI.chats.addMessage(currentChatId, "assistant", data.response)

      const chatFinal = await lariaAPI.chats.get(currentChatId)
      const finalMessages = (chatFinal.messages || []).filter(
        (m: { metadata?: { source?: string } }) => m.metadata?.source !== "tutor"
      )
      setMessages(finalMessages)

      if (isNewChat) {
        generateTitle(currentChatId, history)
      }
    } catch (error) {
      console.error("Chat error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="mb-6 space-y-4 max-h-[400px] overflow-y-auto">
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}-${msg.content.substring(0, 20)}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-[14px] whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div
        className={`animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-2xl border-2 bg-card shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all hover:shadow-[0_4px_30px_rgb(0,0,0,0.06)] ${
          isFocused ? "border-teal-500/50 ring-1 ring-teal-500/20" : "border-teal-500/20 hover:border-teal-500/30"
        }`}
      >
        <div className="flex items-center px-4 md:px-5 py-3 md:py-3.5">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowSuggestions(e.target.value.length > 0)
            }}
            onFocus={() => {
              setIsFocused(true)
              if (query.length > 0) setShowSuggestions(true)
            }}
            onBlur={() => {
              setIsFocused(false)
              setTimeout(() => setShowSuggestions(false), 150)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask anything..."
            className="w-full border-0 bg-transparent text-[14px] md:text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between px-2 md:px-2.5 py-2 gap-2">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-muted-foreground transition-all hover:bg-accent/60 hover:text-foreground"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4 md:h-[17px] md:w-[17px]" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-muted-foreground transition-all hover:bg-accent/60 hover:text-foreground"
            >
              <Mic className="h-4 w-4 md:h-[17px] md:w-[17px]" />
            </Button>
            {query.trim() && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-all"
                onClick={handleSend}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {showSuggestions && query && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200 border-t border-border/40">
            {["test", "test internet speed", "test my speed", "testament", "test my internet speed"]
              .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
              .map((suggestion, index) => (
                <button
                  key={index}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setQuery(suggestion)
                    setShowSuggestions(false)
                  }}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent/50"
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-normal">{suggestion}</span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
