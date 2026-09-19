"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Search, Paperclip, Mic, Send, Loader2 } from "lucide-react"
import { useChat } from "@/app/contexts/chat-context"
import { lariaAPI, Document } from "@/lib/laria-api"
import { FileCard } from "./file-card"
import { FileViewer } from "./file-viewer"

const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".odt", ".epub",
  ".pptx", ".ppt", ".odp", ".xlsx", ".xls", ".csv", ".ods",
  ".py", ".java", ".c", ".cpp", ".cs", ".js", ".ts", ".html",
  ".css", ".sql", ".json", ".xml", ".php", ".rb",
]



interface UploadedFile {
  file: File
  document?: Document
  dataUrl?: string
}

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [viewerFile, setViewerFile] = useState<{
    filename: string
    mimeType: string
    documentId?: string
    dataUrl?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { messages, setMessages, loadChats, activeChatId, createChat: ctxCreateChat, generateTitle } = useChat()
  const chatId = activeChatId

  const generatePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(file)
      } else if (
        file.type.startsWith("text/") ||
        file.type.includes("json") ||
        file.type.includes("xml") ||
        file.type.includes("javascript") ||
        file.type.includes("typescript") ||
        file.type.includes("python")
      ) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsText(file)
      } else {
        resolve(undefined)
      }
    })
  }

  const handleFileUpload = async (file: File) => {
    if (isUploading) return

    const ext = "." + (file.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`Tipo de archivo no soportado: ${ext}\nFormatos admitidos: ${ALLOWED_EXTENSIONS.join(", ")}`)
      return
    }

    setIsUploading(true)
    try {
      const doc = await lariaAPI.documents.upload(file)

      const dataUrl = await generatePreview(file)

      setUploadedFiles((prev) => [
        ...prev,
        { file, document: doc, dataUrl },
      ])

      let currentChatId = chatId
      let isNewChat = false
      if (!currentChatId) {
        const chat = await ctxCreateChat(undefined, doc.id)
        currentChatId = chat.id
        isNewChat = true
      } else {
        await lariaAPI.chats.update(currentChatId, { document_id: doc.id })
      }

      await lariaAPI.chats.addMessage(currentChatId, "user", `📎 Subí el archivo: ${file.name}`)

      const chatFinal = await lariaAPI.chats.get(currentChatId)
      setMessages(chatFinal.messages || [])

      if (isNewChat) {
        generateTitle(currentChatId, [{ role: "user", content: `Archivo: ${file.name}` }])
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert(error instanceof Error ? error.message : "Error al subir el archivo")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    const userMessage = query.trim()
    if (!userMessage || isLoading) return

    setQuery("")
    setIsLoading(true)

    try {
      let currentChatId = chatId
      let isNewChat = false
      if (!currentChatId) {
        const chat = await ctxCreateChat()
        currentChatId = chat.id
        isNewChat = true
      }

      const newUserMsg = { role: "user" as const, content: userMessage }
      setMessages([...messages, newUserMsg])

      const chatAfterSend = await lariaAPI.chats.addMessage(currentChatId, "user", userMessage)
      setMessages(chatAfterSend.messages || [])

      if (isNewChat) {
        generateTitle(currentChatId, [{ role: "user", content: userMessage }])
      }
    } catch (error) {
      console.error("Chat error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {uploadedFiles.map((uf, index) => (
            <FileCard
              key={`${uf.document?.id || index}`}
              filename={uf.file.name}
              size={uf.file.size}
              mimeType={uf.file.type}
              documentId={uf.document?.id}
              previewDataUrl={uf.dataUrl}
              onClick={() =>
                setViewerFile({
                  filename: uf.file.name,
                  mimeType: uf.file.type,
                  documentId: uf.document?.id,
                  dataUrl: uf.dataUrl,
                })
              }
              onRemove={() => removeFile(index)}
            />
          ))}
        </div>
      )}

      {/* File Viewer Modal */}
      {viewerFile && (
        <FileViewer
          filename={viewerFile.filename}
          mimeType={viewerFile.mimeType}
          documentId={viewerFile.documentId}
          previewDataUrl={viewerFile.dataUrl}
          onClose={() => setViewerFile(null)}
        />
      )}

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
          isFocused ? "border-ring/50 ring-1 ring-ring/20" : "border-border hover:border-ring/40"
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
                className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
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
