"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Paperclip, Mic, Send, Loader2, Square, Copy } from "lucide-react"
import { useChat } from "@/app/contexts/chat-context"
import { lariaAPI, Document } from "@/lib/laria-api"
import { FileCard } from "./file-card"
import { FileViewer } from "./file-viewer"
import { MessageContent } from "./message-content"
import { MessagesSkeleton } from "./skeletons"
import { isTextMime, mimeFromFilename } from "@/lib/file-types"
import { useStreamingChat } from "@/hooks/use-streaming-chat"
import { useDictation } from "@/hooks/use-dictation"

const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".odt", ".epub",
  ".pptx", ".ppt", ".odp", ".xlsx", ".xls", ".csv", ".ods",
  ".py", ".java", ".c", ".cpp", ".cs", ".js", ".ts", ".html",
  ".css", ".sql", ".json", ".xml", ".php", ".rb",
]

// Un adjunto del chat: recién subido (con tamaño y vista previa local) o
// recuperado del servidor tras recargar (solo con sus datos básicos)
interface UploadedFile {
  filename: string
  mimeType: string
  size?: number
  document?: Document
  dataUrl?: string
}

// Cómo llama el tutor a cada tipo de respuesta; lo que no esté aquí se muestra tal cual
const ENVELOPE_TYPE_LABEL: Record<string, string> = {
  explanation: "Explicación",
  example: "Ejemplo",
  hint: "Pista",
  feedback: "Corrección",
  question: "Pregunta",
  quiz: "Quiz",
  summary: "Resumen",
}

export function SearchBar({ isOpeningChat = false }: { isOpeningChat?: boolean }) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // Los adjuntos de cada chat, para que no se vean en los demás
  const [uploadsByChat, setUploadsByChat] = useState<Record<string, UploadedFile[]>>({})
  const [viewerFile, setViewerFile] = useState<{
    filename: string
    mimeType: string
    documentId?: string
    dataUrl?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isUserScrolledRef = useRef(false)

  const router = useRouter()
  const { messages, setMessages, addMessage, activeChatId, activeDocumentId, createChat: ctxCreateChat, generateTitle } = useChat()
  const chatId = activeChatId

  const {
    isStreaming,
    isThinking,
    displayedContent,
    error: streamError,
    isDone,
    startStreaming,
    cancelStreaming,
    resetStreaming,
  } = useStreamingChat({
    messages,
    setMessages,
    chatId,
  })

  // Para lectores de pantalla: se anuncia el principio y el final de la respuesta,
  // no cada fragmento que llega
  const [wasStreaming, setWasStreaming] = useState(isStreaming)
  const [streamAnnouncement, setStreamAnnouncement] = useState("")
  if (wasStreaming !== isStreaming) {
    setWasStreaming(isStreaming)
    setStreamAnnouncement(isStreaming ? "LARIA está respondiendo…" : streamError ? "" : "Respuesta de LARIA lista.")
  }

  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true
    const threshold = 100
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }, [])

  const scrollToBottom = useCallback((smooth = true) => {
    const container = messagesContainerRef.current
    if (!container) return
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth && !reduceMotion ? "smooth" : "instant",
    })
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      isUserScrolledRef.current = !isAtBottom()
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [isAtBottom])

  // Mientras llega la respuesta se sigue el final, salvo que el usuario haya subido a leer
  useEffect(() => {
    if (isStreaming && !isUserScrolledRef.current) scrollToBottom(false)
  }, [displayedContent, isStreaming, scrollToBottom])

  useEffect(() => {
    if (!isDone || isUserScrolledRef.current) return
    const timer = setTimeout(() => scrollToBottom(), 100)
    return () => clearTimeout(timer)
  }, [isDone, scrollToBottom])

  // Al abrir otro chat, o cuando llegan sus mensajes, se muestra el final
  useEffect(() => {
    isUserScrolledRef.current = false
  }, [activeChatId])

  useEffect(() => {
    if (!isUserScrolledRef.current) scrollToBottom(false)
  }, [activeChatId, messages.length, scrollToBottom])

  // El chat activo, o uno nuevo si no hay (y la URL pasa a apuntar a él)
  const ensureChat = async (documentId?: string) => {
    if (chatId) return { id: chatId, isNew: false }
    const chat = await ctxCreateChat(undefined, documentId)
    router.replace(`/chat/${chat.id}`)
    return { id: chat.id, isNew: true }
  }

  const generatePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(file)
      } else if (isTextMime(file.type)) {
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
      toast.error(`Tipo de archivo no soportado: ${ext}`, {
        description: `Formatos admitidos: ${ALLOWED_EXTENSIONS.join(", ")}`,
      })
      return
    }

    setIsUploading(true)
    try {
      const doc = await lariaAPI.documents.upload(file)
      const dataUrl = await generatePreview(file)

      const { id: currentChatId, isNew: isNewChat } = await ensureChat(doc.id)
      setUploadsByChat((prev) => ({
        ...prev,
        [currentChatId]: [...(prev[currentChatId] ?? []), { filename: file.name, mimeType: file.type, size: file.size, document: doc, dataUrl }],
      }))
      if (!isNewChat) {
        await lariaAPI.chats.update(currentChatId, { document_id: doc.id })
      }

      // Una nota, no una pregunta: con "user" el backend lanzaría un turno del tutor
      // (llamada a la IA, respuesta fantasma y el perfil del alumno alterado)
      await addMessage(currentChatId, "system", `📎 Subí el archivo: ${file.name}`)

      if (isNewChat) {
        generateTitle(currentChatId, [{ role: "user", content: `Archivo: ${file.name}` }])
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "Error al subir el archivo")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Tras recargar, los adjuntos locales se pierden: se muestra el documento que el
  // servidor tiene vinculado al chat
  const [fetchedDocument, setFetchedDocument] = useState<Document | null>(null)
  const linkedDocument = fetchedDocument?.id === activeDocumentId ? fetchedDocument : null
  useEffect(() => {
    if (!activeDocumentId) return
    let cancelled = false
    lariaAPI.documents
      .list()
      .then((docs) => {
        const doc = docs.find((d) => d.id === activeDocumentId)
        if (!cancelled && doc) setFetchedDocument(doc)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeDocumentId])

  const localUploads = (chatId && uploadsByChat[chatId]) || []
  const uploadedFiles: UploadedFile[] =
    localUploads.length > 0 || !linkedDocument
      ? localUploads
      : [{ document: linkedDocument, filename: linkedDocument.filename, mimeType: mimeFromFilename(linkedDocument.filename) }]

  const removeFile = (index: number) => {
    if (!chatId) return
    setUploadsByChat((prev) => ({ ...prev, [chatId]: (prev[chatId] ?? []).filter((_, i) => i !== index) }))
  }

  // Lo dictado se añade a lo que ya se hubiera escrito; mientras la frase no termina
  // se muestra detrás, sin fijarla en el mensaje
  const [interimText, setInterimText] = useState("")
  const dictation = useDictation({
    onFinal: (text) => setQuery((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text)),
    onInterim: setInterimText,
    onError: (message) => toast.error(message),
  })
  const shownQuery = interimText ? (query.trim() ? `${query.trimEnd()} ${interimText}` : interimText) : query

  const handleSend = async () => {
    const userMessage = shownQuery.trim()
    if (!userMessage || isStreaming) return

    setQuery("")
    dictation.cancel()
    resetStreaming()
    isUserScrolledRef.current = false

    try {
      const { id: currentChatId, isNew: isNewChat } = await ensureChat()

      await startStreaming(userMessage, currentChatId)

      if (isNewChat) {
        generateTitle(currentChatId, [{ role: "user", content: userMessage }])
      }
    } catch (error) {
      console.error("Chat error:", error)
      // Lo escrito no se pierde: vuelve al campo para reintentarlo
      setQuery((current) => current || userMessage)
      toast.error("No se pudo enviar el mensaje")
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Respuesta copiada")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const handleStopGeneration = () => {
    cancelStreaming()
  }

  const renderMessageContent = (msg: typeof messages[0], isLive: boolean) =>
    msg.role === "user" ? (
      <div className="text-[14px] whitespace-pre-wrap">{msg.content}</div>
    ) : (
      <div className="text-[14px] leading-relaxed">
        <MessageContent content={msg.content} />
        {isLive && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/70 animate-pulse" />
        )}
      </div>
    )

  return (
    <div className="relative flex h-full flex-col">
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

      <p aria-live="polite" className="sr-only">{streamAnnouncement}</p>

      {/* Chat Messages: siempre montado para que el scroll tenga a quién escuchar */}
      <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto motion-safe:scroll-smooth">
        {messages.length === 0 && isOpeningChat ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <h1 className="text-center text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              ¿Qué quieres aprender hoy?
            </h1>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-6">
            {messages.map((msg, index) => {
              // La respuesta que se está escribiendo ahora mismo
              const isLive = isStreaming && index === messages.length - 1 && msg.role === "assistant"
              // Notas del sistema (archivo subido, avisos): una línea centrada, no una burbuja
              if (msg.role === "system") {
                return (
                  <p key={`${index}-system`} className="text-center text-xs text-muted-foreground">
                    {msg.content}
                  </p>
                )
              }
              return (
                <div
                  key={`${index}-${msg.role}`}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {renderMessageContent(msg, isLive)}

                    {msg.role === "assistant" && !isLive && (
                      <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <button
                          onClick={() => copyToClipboard(msg.content)}
                          aria-label="Copiar respuesta"
                          className="flex items-center gap-1 transition-colors hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </button>
                        {msg.metadata?.envelope?.type && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary/50">
                            {ENVELOPE_TYPE_LABEL[msg.metadata.envelope.type] ?? msg.metadata.envelope.type}
                          </span>
                        )}
                        {msg.metadata?.envelope?.emotion && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary/50">
                            {msg.metadata.envelope.emotion}
                          </span>
                        )}
                        {msg.metadata?.envelope?.grounded !== undefined && (
                          <span className={`px-1.5 py-0.5 rounded ${msg.metadata.envelope.grounded ? "bg-green-500/20 text-green-700 dark:text-green-300" : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"}`}>
                            {msg.metadata.envelope.grounded ? "Tutoría" : "Chat libre"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {isStreaming && isThinking && !displayedContent && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-2xl px-4 py-3 max-w-[80%]">
                  <div className="thinking-container">
                    <span className="thinking-shimmer" />
                    <span className="thinking-text" />
                  </div>
                </div>
              </div>
            )}

            {streamError && (
              <div className="flex justify-start">
                <div role="alert" className="bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3 max-w-[80%]">
                  <p className="text-sm text-destructive">{streamError}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 md:px-6 md:pb-6">
        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {uploadedFiles.map((uf, index) => (
              <FileCard
                key={`${uf.document?.id || index}`}
                filename={uf.filename}
                size={uf.size}
                mimeType={uf.mimeType}
                documentId={uf.document?.id}
                previewDataUrl={uf.dataUrl}
                onClick={() =>
                  setViewerFile({
                    filename: uf.filename,
                    mimeType: uf.mimeType,
                    documentId: uf.document?.id,
                    dataUrl: uf.dataUrl,
                  })
                }
                onRemove={() => removeFile(index)}
              />
            ))}
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
              value={shownQuery}
              onChange={(e) => {
                setQuery(e.target.value)
                setInterimText("")
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shownQuery.trim() && !isStreaming) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={isStreaming ? "Generando respuesta…" : "Pregunta lo que quieras…"}
              aria-label="Mensaje"
              disabled={isStreaming}
              className="w-full border-0 bg-transparent text-[14px] md:text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
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
                aria-label="Adjuntar archivo"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isStreaming}
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
              {dictation.isSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isStreaming}
                  onClick={dictation.isListening ? dictation.stop : dictation.start}
                  aria-label={dictation.isListening ? "Parar dictado" : "Dictar"}
                  aria-pressed={dictation.isListening}
                  className={`h-8 w-8 md:h-9 md:w-9 rounded-lg transition-all hover:bg-accent/60 ${
                    dictation.isListening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mic className="h-4 w-4 md:h-[17px] md:w-[17px]" />
                </Button>
              )}

              {isStreaming ? (
                <Button
                  aria-label="Detener respuesta"
                  variant="ghost"
                  size="icon"
                  onClick={handleStopGeneration}
                  className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : shownQuery.trim() ? (
                <Button
                  aria-label="Enviar"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          </div>
      </div>
    </div>
  )
}
