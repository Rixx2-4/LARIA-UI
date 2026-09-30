"use client"

import { Fragment, useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Paperclip, Mic, Send, Loader2, Square, Copy, Volume2, VolumeX } from "lucide-react"
import { useChat } from "@/app/contexts/chat-context"
import { lariaAPI, Document } from "@/lib/laria-api"
import { FileCard } from "./file-card"
import { FileViewer } from "./file-viewer"
import { MessageContent } from "./message-content"
import { MessagesSkeleton } from "./skeletons"
import { ChatQuiz, type ChatQuizRequest } from "./chat-quiz"
import { STYLE_OPTIONS } from "./style-picker"
import { markPlacementOffered, wasPlacementOffered } from "@/lib/placement"
import { isTextMime, mimeFromFilename } from "@/lib/file-types"
import { chatHref } from "@/lib/routes"
import { envelopeGrounded, envelopeLabel, tutorEnvelope } from "@/lib/tutor-envelope"
import { LEVEL_NAME } from "@/app/quiz/quiz-parts"
import { useStreamingChat } from "@/hooks/use-streaming-chat"
import { useDictation } from "@/hooks/use-dictation"
import { toEmotion, useSpeech } from "@/hooks/use-speech"
import { takeSpeakable } from "@/lib/speech-chunks"

// Lo mismo que acepta el backend (file_parser.py): texto, datos, código y cuatro binarios
const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".pptx", ".xlsx",
  ".txt", ".md", ".markdown",
  ".csv", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".tex", ".rst", ".log",
  ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".htm", ".css", ".scss", ".sh", ".bash", ".sql",
  ".java", ".c", ".cpp", ".h", ".cs", ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".r", ".jl", ".lua", ".pl",
]

// Los formatos antiguos de Office tienen arreglo fácil: guardarlos en el formato nuevo
// Límite de subida del backend (DOCUMENT_MAX_UPLOAD_BYTES en Render): mejor avisar
// antes que esperar a subir el archivo entero para recibir un 413
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const LEGACY_OFFICE: Record<string, string> = { ".doc": ".docx", ".ppt": ".pptx", ".xls": ".xlsx" }

// Un adjunto del chat: recién subido (con tamaño y vista previa local) o
// recuperado del servidor tras recargar (solo con sus datos básicos)
interface UploadedFile {
  filename: string
  mimeType: string
  size?: number
  document?: Document
  dataUrl?: string
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
  const {
    messages,
    setMessages,
    addMessage,
    activeChatId,
    activeDocumentId,
    createChat: ctxCreateChat,
    generateTitle,
    takeFirstMessage,
    loadedChatId,
  } = useChat()
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
    fullContent,
    envelope: liveEnvelope,
  } = useStreamingChat({
    messages,
    setMessages,
    chatId,
  })

  // Voz del tutor: con «Leer en voz», cada frase que se cierra en el stream se lee
  // mientras sigue escribiendo. spokenRef: hasta dónde de la respuesta ya se leyó
  const speech = useSpeech()
  const speakAlong = speech.enabled && speech.mode === "voice"
  const spokenRef = useRef(0)
  const liveKeyRef = useRef("")
  const { enqueue: enqueueSpeech, maxChars: speechMaxChars, stop: stopSpeech } = speech
  useEffect(() => {
    if (!speakAlong || (!isStreaming && !isDone)) return
    const unread = fullContent.slice(spokenRef.current)
    if (!unread) return
    const { chunks, rest } = takeSpeakable(unread, isDone, speechMaxChars)
    spokenRef.current = fullContent.length - rest.length
    // La emoción llega con el envelope, al final; hasta entonces, la de ánimo
    enqueueSpeech(chunks, isDone ? toEmotion(liveEnvelope?.emotion) : "encouraging", liveKeyRef.current)
  }, [speakAlong, fullContent, isStreaming, isDone, liveEnvelope, speechMaxChars, enqueueSpeech])
  // Otro chat: lo que se estaba leyendo ya no toca
  useEffect(() => stopSpeech, [chatId, stopSpeech])

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
    router.replace(chatHref(chat.id))
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
      toast.error(`No se pueden subir archivos ${ext}`, {
        description: LEGACY_OFFICE[ext]
          ? `Guárdalo antes como ${LEGACY_OFFICE[ext]} y súbelo de nuevo.`
          : "Admite PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), texto y código.",
      })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("El archivo es demasiado grande", { description: "El máximo es 25 MB." })
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

  const handleSend = () => sendMessage(shownQuery.trim())

  const sendMessage = async (userMessage: string) => {
    if (!userMessage || isStreaming) return

    setQuery("")
    dictation.cancel()
    // Un mensaje nuevo corta la lectura del anterior
    speech.stop()
    if (speakAlong) speech.prime()
    spokenRef.current = 0
    resetStreaming()
    isUserScrolledRef.current = false

    try {
      const { id: currentChatId, isNew: isNewChat } = await ensureChat()
      // La respuesta será el mensaje tras el del usuario: la misma clave que su «Escuchar»
      liveKeyRef.current = `${currentChatId}:${messages.length + 1}`

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

  // Un chat recién creado con un primer mensaje en cola (la clase tras nivelarse)
  // lo envía en cuanto sus mensajes llegan del servidor: antes, la recarga del
  // chat al abrirse pisaría la respuesta que se está escribiendo
  const sendMessageRef = useRef(sendMessage)
  useEffect(() => {
    sendMessageRef.current = sendMessage
  })
  useEffect(() => {
    if (!chatId || loadedChatId !== chatId) return
    const text = takeFirstMessage(chatId)
    if (text) sendMessageRef.current(text)
  }, [chatId, loadedChatId, takeFirstMessage])

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
    speech.stop()
  }

  // Quiz dentro de la conversación, bajo la respuesta del tutor que lo propone:
  // - suggest_placement: pidió aprender un tema → nivelación con el tema del backend
  // - ask_learning_style: el tutor pregunta cómo prefiere aprender → las opciones para elegir
  // - offer_quiz: pidió un quiz → práctica sobre el documento del chat o, sin él, sobre
  //   el tema que nombró (sin tema, el tutor se lo pregunta y no se abre nada)
  const lastIndex = messages.length - 1
  const lastEnvelope = lastIndex >= 0 && messages[lastIndex].role === "assistant" ? tutorEnvelope(messages[lastIndex]) : null
  const offerFor = (payload: NonNullable<typeof lastEnvelope>["payload"]): ChatQuizRequest | null => {
    if (!payload || !chatId) return null
    if (payload.ask_learning_style) return { kind: "style" }
    if (payload.suggest_placement && !wasPlacementOffered(chatId)) return { kind: "placement", topic: payload.topic_hint ?? "" }
    if (payload.offer_quiz && activeDocumentId) return { kind: "practice" }
    if (payload.offer_quiz && payload.topic_hint) return { kind: "practice", topic: payload.topic_hint }
    return null
  }
  const offeredQuiz = isStreaming || !lastEnvelope ? null : offerFor(lastEnvelope.payload)

  // La tarjeta se queda anclada a su mensaje: cuando empieza la clase o llegan más
  // mensajes, sigue en su sitio con el resumen
  const [quizCard, setQuizCard] = useState<{ chatId: string; anchor: number; request: ChatQuizRequest } | null>(null)
  const [dismissedQuizzes, setDismissedQuizzes] = useState<string[]>([])
  const offerKey = `${chatId}:${lastIndex}`
  if (
    offeredQuiz &&
    chatId &&
    !dismissedQuizzes.includes(offerKey) &&
    (quizCard?.chatId !== chatId || quizCard.anchor !== lastIndex)
  ) {
    setQuizCard({ chatId, anchor: lastIndex, request: offeredQuiz })
  }
  const visibleQuiz = quizCard && quizCard.chatId === chatId && quizCard.anchor <= lastIndex ? quizCard : null

  const dismissQuiz = () => {
    if (!visibleQuiz) return
    if (visibleQuiz.request.kind === "placement") markPlacementOffered(visibleQuiz.chatId)
    setDismissedQuizzes((prev) => [...prev, `${visibleQuiz.chatId}:${visibleQuiz.anchor}`])
    setQuizCard(null)
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
              const envelope = tutorEnvelope(msg)
              const label = envelopeLabel(envelope)
              const grounded = envelopeGrounded(envelope)
              // Notas del sistema (archivo subido, avisos): una línea centrada, no una burbuja
              if (msg.role === "system") {
                return (
                  <p key={`${index}-system`} className="text-center text-xs text-muted-foreground">
                    {msg.content}
                  </p>
                )
              }
              return (
                <Fragment key={`${index}-${msg.role}`}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
                        {speech.enabled && (() => {
                          const key = `${chatId}:${index}`
                          const playing = speech.speakingKey === key
                          return (
                            <button
                              onClick={() => (playing ? speech.stop() : speech.playMessage(key, msg.content, toEmotion(envelope?.emotion)))}
                              aria-label={playing ? "Detener la lectura" : "Escuchar respuesta"}
                              className="flex items-center gap-1 transition-colors hover:text-foreground"
                            >
                              {playing ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                              {playing ? "Detener" : "Escuchar"}
                            </button>
                          )
                        })()}
                        {label && <span className="px-1.5 py-0.5 rounded bg-secondary/50">{label}</span>}
                        {/* Contestó en el chat cómo prefiere aprender y el backend ya lo guardó */}
                        {envelope?.payload?.explanation_style_chosen !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary/50">
                            Estilo guardado:{" "}
                            {STYLE_OPTIONS.find((o) => o.value === envelope.payload?.explanation_style_chosen)?.label ?? "a tu medida"}
                          </span>
                        )}
                        {/* El tutor partió del nivel que sacó en la nivelación de este tema */}
                        {envelope?.payload?.placement_level && LEVEL_NAME[envelope.payload.placement_level] && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary/50">
                            Tu nivel: {LEVEL_NAME[envelope.payload.placement_level]}
                          </span>
                        )}
                        {grounded !== null && (
                          <span className={`px-1.5 py-0.5 rounded ${grounded ? "bg-green-500/20 text-green-700 dark:text-green-300" : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"}`}>
                            {grounded ? "Tutoría" : "Chat libre"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {visibleQuiz && visibleQuiz.anchor === index && chatId && (
                  <ChatQuiz
                    key={`${visibleQuiz.chatId}:${visibleQuiz.anchor}`}
                    chatId={chatId}
                    request={visibleQuiz.request}
                    onDismiss={dismissQuiz}
                    onStartLesson={(message) => {
                      markPlacementOffered(chatId)
                      sendMessage(message)
                    }}
                  />
                )}
                </Fragment>
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
              {speech.enabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => speech.setMode(speech.mode === "voice" ? "text" : "voice")}
                  aria-pressed={speech.mode === "voice"}
                  aria-label={speech.mode === "voice" ? "Leer en voz: activado" : "Leer en voz: desactivado (solo texto)"}
                  title={speech.mode === "voice" ? "LARIA lee sus respuestas en voz. Pulsa para solo texto" : "Solo texto. Pulsa para que LARIA lea en voz"}
                  className={`h-8 gap-1.5 rounded-lg px-2 text-xs md:h-9 transition-all hover:bg-accent/60 ${
                    speech.mode === "voice" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {speech.mode === "voice" ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <span aria-hidden className="hidden sm:inline">{speech.mode === "voice" ? "Leer en voz" : "Solo texto"}</span>
                </Button>
              )}
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
