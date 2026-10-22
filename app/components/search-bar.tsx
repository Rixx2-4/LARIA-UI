"use client"

import { Fragment, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Paperclip, Mic, Send, Loader2, Square, Copy, Volume2, VolumeX } from "lucide-react"
import { useChat } from "@/app/contexts/chat-context"
import { lariaAPI, Document, type ChatMessage } from "@/lib/laria-api"
import { FileCard } from "./file-card"
import { FileViewer } from "./file-viewer"
import { MessageContent } from "./message-content"
import { MessagesSkeleton } from "./skeletons"
import { ThinkingIndicator } from "./thinking-indicator"
import { ChatQuiz, type ChatQuizRequest } from "./chat-quiz"
import { STYLE_OPTIONS } from "./style-picker"
import { markPlacementOffered, wasPlacementOffered } from "@/lib/placement"
import { isTextMime, mimeFromFilename } from "@/lib/file-types"
import { chatHref } from "@/lib/routes"
import { envelopeGrounded, envelopeLabel, tutorEnvelope } from "@/lib/tutor-envelope"
import { LEVEL_NAME } from "@/app/quiz/quiz-parts"
import { useStreamingChat } from "@/hooks/use-streaming-chat"
import { useDictation } from "@/hooks/use-dictation"
import { useTypeToFocus } from "@/hooks/use-type-to-focus"
import { toEmotion, useSpeech } from "@/hooks/use-speech"
import { takeSpeakable } from "@/lib/speech-chunks"

// La nota que deja en el chat un archivo adjunto (los chats ya guardados la llevan): se
// guarda al enviar el mensaje que lo acompaña, justo antes de él, y se pinta como el
// archivo de ese mensaje, no como texto
const UPLOAD_NOTE_PREFIX = "📎 "
const UPLOAD_NOTE = `${UPLOAD_NOTE_PREFIX}Subí el archivo: `

// El nombre del archivo si el mensaje es esa nota. Las más antiguas se guardaron como
// mensaje del usuario en vez de sistema: se pintan igual
function attachedFilename(msg: ChatMessage): string | null {
  return msg.role !== "assistant" && msg.content.startsWith(UPLOAD_NOTE) ? msg.content.slice(UPLOAD_NOTE.length) : null
}

// «Copiar» y «Escuchar» bajo cada respuesta: en móvil, con zona táctil más alta que el texto
const MESSAGE_ACTION_CLASS =
  "relative flex items-center gap-1 transition-colors hover:text-foreground before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-[''] md:before:hidden"

// "apuntes_tema-3.pdf" → "Apuntes tema 3"
function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : filename
}

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

// Un mensaje del chat tiene como mucho 20000 caracteres (el backend responde 422 si se
// pasa); el contador aparece cuando quedan 500
const MAX_MESSAGE_CHARS = 20000
const MESSAGE_WARNING_CHARS = 500
// Con Shift+Enter el mensaje crece hacia arriba hasta unas 8 líneas; luego, scroll
const MAX_INPUT_HEIGHT_PX = 200

const LEGACY_OFFICE: Record<string, string> = { ".doc": ".docx", ".ppt": ".pptx", ".xls": ".xlsx" }

// Un adjunto del chat: recién subido (con tamaño y vista previa local) o
// recuperado del servidor tras recargar (solo con sus datos básicos)
interface UploadedFile {
  filename: string
  mimeType: string
  size?: number
  document?: Document
  dataUrl?: string
  // Ya salió con un mensaje: se ve en la conversación, no en la caja de texto
  sent?: boolean
}


// En una clase (ADR-054) el chat es el de esa ruta: sin adjuntos ni propuestas de quiz,
// sin quitarle el teclado a la comprobación y con la voz de la pizarra, para que no
// suenen dos a la vez
interface ClassMode {
  // El paso que se está viendo: LARIA responde sobre ese
  concept?: string
  speech: ReturnType<typeof useSpeech>
  // Tras una respuesta de otro tema, para cerrar el chat y seguir con la clase
  onBackToClass?: () => void
}

export function SearchBar({ isOpeningChat = false, inClass }: { isOpeningChat?: boolean; inClass?: ClassMode }) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // El archivo que se está subiendo: se ve ya en la caja de texto de su chat (null, el
  // chat nuevo, hasta que se crea), con «Subiendo…»
  const [uploadingFile, setUploadingFile] = useState<{ chatId: string | null; filename: string; mimeType: string } | null>(null)
  // Los adjuntos de cada chat, para que no se vean en los demás
  const [uploadsByChat, setUploadsByChat] = useState<Record<string, UploadedFile[]>>({})
  const [viewerFile, setViewerFile] = useState<{
    filename: string
    mimeType: string
    documentId?: string
    dataUrl?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
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
    renameChat,
    maybeGenerateTitle,
    takeFirstMessage,
    loadedChatId,
    linkDocument,
  } = useChat()
  const chatId = activeChatId

  // Empezar a escribir en cualquier parte de la página escribe en el chat (salvo con el visor abierto)
  useTypeToFocus(messageInputRef, !viewerFile && !inClass)

  const {
    isStreaming,
    isThinking,
    thinkingLabel,
    displayedContent,
    error: streamError,
    isDone,
    startStreaming,
    stopStreaming,
    resetStreaming,
    fullContent,
    envelope: liveEnvelope,
  } = useStreamingChat({
    messages,
    setMessages,
    chatId,
    concept: inClass?.concept,
    // Si la respuesta falla, lo que se envió vuelve al campo para reintentarlo
    onError: () => setQuery((current) => current || lastSentRef.current),
  })

  // Voz del tutor: con «Leer en voz», cada frase que se cierra en el stream se lee
  // mientras sigue escribiendo. spokenRef: hasta dónde de la respuesta ya se leyó
  const ownSpeech = useSpeech()
  const speech = inClass?.speech ?? ownSpeech
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

  // Diagramas, fórmulas e imágenes se dibujan después de llegar el mensaje y lo alargan, y
  // la zona de mensajes se encoge al aparecer la tarjeta del archivo o el teclado del
  // móvil: si se estaba al final, se sigue al final (si no, al abrir un chat la última
  // respuesta quedaba tapada por la caja de texto)
  const hasMessages = messages.length > 0
  useEffect(() => {
    const container = messagesContainerRef.current
    const content = container?.firstElementChild
    if (!container || !content || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (!isUserScrolledRef.current) scrollToBottom(false)
    })
    observer.observe(container)
    observer.observe(content)
    return () => observer.disconnect()
  }, [hasMessages, scrollToBottom])

  // El chat activo, o uno nuevo si no hay (y la URL pasa a apuntar a él). Si ya se está
  // creando uno (enviar y adjuntar a la vez), se espera a ese: nunca se crean dos
  const creatingChatRef = useRef<Promise<string> | null>(null)
  // Lo mismo, para el render: el chat que llega es el que se creó aquí
  const [creatingChat, setCreatingChat] = useState(false)
  useEffect(() => {
    creatingChatRef.current = null
  }, [chatId])
  const ensureChat = async (documentId?: string) => {
    if (chatId) return { id: chatId, isNew: false }
    if (creatingChatRef.current) return { id: await creatingChatRef.current, isNew: false }
    // Lo que se esté escribiendo pasa al chat que se crea (ver los borradores)
    setCreatingChat(true)
    const creating = ctxCreateChat(undefined, documentId).then((chat) => {
      router.replace(chatHref(chat.id))
      return chat.id
    })
    creatingChatRef.current = creating
    try {
      return { id: await creating, isNew: true }
    } catch (error) {
      creatingChatRef.current = null
      setCreatingChat(false)
      throw error
    }
  }

  const generatePreview = (file: File, mimeType: string): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (mimeType.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(file)
      } else if (isTextMime(mimeType)) {
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

    // Hay navegadores que no dan el tipo (.md, .py) o dan otro (.ts como vídeo MPEG-TS):
    // si la extensión es conocida, manda ella
    const known = mimeFromFilename(file.name)
    const mimeType = known !== "application/octet-stream" ? known : file.type || known

    setIsUploading(true)
    setUploadingFile({ chatId, filename: file.name, mimeType })
    try {
      const doc = await lariaAPI.documents.upload(file)
      const { id: currentChatId, isNew: isNewChat } = await ensureChat(doc.id)
      setUploadingFile((prev) => prev && { ...prev, chatId: currentChatId })
      // Un chat nuevo ya nace con el documento; uno que ya existía se vincula ahora.
      // Hasta que el chat lo tiene, no se enseña como adjunto
      if (!isNewChat) await linkDocument(currentChatId, doc.id)

      const dataUrl = await generatePreview(file, mimeType)
      // El backend vincula un documento por chat (el nuevo sustituye al anterior): el
      // adjunto pendiente es el que el tutor usa de verdad. Los ya enviados se quedan para
      // poder abrirlos desde su mensaje. En el chat no se escribe nada hasta enviar
      setUploadsByChat((prev) => ({
        ...prev,
        [currentChatId]: [
          ...(prev[currentChatId] ?? []).filter((uf) => uf.sent),
          { filename: file.name, mimeType, size: file.size, document: doc, dataUrl },
        ],
      }))

      if (isNewChat) {
        // Título de apoyo hasta que la primera respuesta permita generar uno de verdad
        renameChat(currentChatId, titleFromFilename(file.name), { provisional: true }).catch(() => {})
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "Error al subir el archivo")
    } finally {
      setIsUploading(false)
      setUploadingFile(null)
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

  // Los documentos que se quitaron de cada chat: no vuelven a salir, tampoco como el
  // vinculado. Quitar la tarjeta no desvincula el documento en el servidor (el contrato
  // conocido no tiene cómo)
  const [hiddenByChat, setHiddenByChat] = useState<Record<string, string[]>>({})
  const hidden = (chatId && hiddenByChat[chatId]) || []
  const isShown = (documentId?: string) => !documentId || !hidden.includes(documentId)
  const chatUploads = (chatId && uploadsByChat[chatId]) || []
  const linkedFile: UploadedFile | null = linkedDocument
    ? { document: linkedDocument, filename: linkedDocument.filename, mimeType: mimeFromFilename(linkedDocument.filename) }
    : null
  // El adjunto que espera en la caja de texto a salir con el próximo mensaje. Tras
  // recargar, el documento vinculado al chat, si aún no salió con ningún mensaje
  const localPending = chatUploads.filter((uf) => !uf.sent && isShown(uf.document?.id))
  const linkedPending =
    chatUploads.length === 0 && linkedFile && isShown(linkedFile.document?.id) && !messages.some((m) => attachedFilename(m) === linkedFile.filename)
      ? [linkedFile]
      : []
  const pendingFiles: UploadedFile[] = localPending.length > 0 ? localPending : linkedPending
  // El archivo de un mensaje ya enviado, para abrirlo desde la conversación
  const uploadingHere = uploadingFile?.chatId === chatId ? uploadingFile : null
  const sentFile = (filename: string) =>
    chatUploads.findLast((uf) => uf.filename === filename) ?? (linkedFile?.filename === filename ? linkedFile : undefined)

  const removeFile = (file: UploadedFile) => {
    if (!chatId) return
    const documentId = file.document?.id
    if (documentId) setHiddenByChat((prev) => ({ ...prev, [chatId]: [...(prev[chatId] ?? []), documentId] }))
    setUploadsByChat((prev) => ({ ...prev, [chatId]: (prev[chatId] ?? []).filter((uf) => uf !== file) }))
  }

  // Lo dictado se añade a lo que ya se hubiera escrito; mientras la frase no termina
  // se muestra detrás, sin fijarla en el mensaje
  const [interimText, setInterimText] = useState("")
  // Lo escrito antes de pulsar el micrófono: lo dictado va detrás y se REEMPLAZA en
  // cada evento (el navegador puede repetir frases; sumarlas las duplicaría)
  const dictationBaseRef = useRef("")
  // El dictado se corta al límite del mensaje (el backend rechaza los más largos)
  const joinText = (base: string, text: string) =>
    (base.trim() && text ? `${base.trimEnd()} ${text}` : base.trim() ? base : text).slice(0, MAX_MESSAGE_CHARS)
  const dictation = useDictation({
    onTranscript: (finalText, interim) => {
      setQuery(joinText(dictationBaseRef.current, finalText))
      setInterimText(interim)
    },
    onError: (message) => toast.error(message),
  })
  const startDictation = () => {
    dictationBaseRef.current = query
    dictation.start()
  }

  // Lo escrito en cada chat se queda en ese chat: al volver a él, sigue ahí ("" es el
  // chat nuevo). Al pasar del chat nuevo al que se acaba de crear desde él (p. ej. al
  // adjuntar) el texto lo acompaña: es el mismo chat
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftChatId, setDraftChatId] = useState(chatId)
  if (draftChatId !== chatId) {
    setDraftChatId(chatId)
    if (draftChatId === null && creatingChat) {
      setCreatingChat(false)
      // Lo del chat nuevo ya es de este: el próximo chat nuevo empieza vacío
      setDrafts((prev) => ({ ...prev, "": "" }))
    } else {
      setDrafts((prev) => ({ ...prev, [draftChatId ?? ""]: query }))
      setQuery(drafts[chatId ?? ""] ?? "")
      setInterimText("")
    }
  }
  // Y lo que se estuviera dictando no sigue escribiendo en otro chat
  const { cancel: cancelDictation } = dictation
  const dictationChatRef = useRef(chatId)
  useEffect(() => {
    if (dictationChatRef.current !== null && dictationChatRef.current !== chatId) cancelDictation()
    dictationChatRef.current = chatId
  }, [chatId, cancelDictation])
  const shownQuery = (interimText ? (query.trim() ? `${query.trimEnd()} ${interimText}` : interimText) : query).slice(0, MAX_MESSAGE_CHARS)
  // El campo mide una línea y crece con cada salto de línea, hasta el tope. Sin medida
  // (oculto), se deja con su alto natural
  useLayoutEffect(() => {
    const field = messageInputRef.current
    if (!field) return
    field.style.height = ""
    field.style.overflowY = ""
    const height = field.scrollHeight
    // Con una línea se queda con su alto natural (scrollHeight redondea: 22,5 px → 23)
    if (!height || height - field.getBoundingClientRect().height <= 1) return
    field.style.height = `${Math.min(height, MAX_INPUT_HEIGHT_PX)}px`
    field.style.overflowY = height > MAX_INPUT_HEIGHT_PX ? "auto" : "hidden"
  }, [shownQuery])
  // Cerca del límite se ve cuánto queda
  const remaining = MAX_MESSAGE_CHARS - shownQuery.length

  const handleSend = () => sendMessage(shownQuery.trim())

  // Lo último que se envió, para devolverlo al campo si la respuesta falla
  const lastSentRef = useRef("")
  // Desde que se pulsa Enviar hasta que termina la respuesta: mientras se crea el chat
  // aún no hay stream, y un segundo envío lanzaría otro turno a la vez
  const sendingRef = useRef(false)

  const sendMessage = async (userMessage: string) => {
    // Con un archivo subiéndose se espera: el mensaje saldría sin él
    if (!userMessage || isStreaming || uploadingHere || sendingRef.current) return
    sendingRef.current = true
    lastSentRef.current = userMessage
    const attachment = pendingFiles[0]

    setQuery("")
    dictation.cancel()
    setInterimText("")
    // Un mensaje nuevo corta la lectura del anterior
    speech.stop()
    if (speakAlong) speech.prime()
    spokenRef.current = 0
    resetStreaming()
    isUserScrolledRef.current = false

    try {
      const { id: currentChatId } = await ensureChat()

      // El archivo adjunto sale con este mensaje: su nota se guarda justo antes, como
      // mensaje de sistema (con "user" el backend lanzaría un turno del tutor), y en la
      // conversación se ve como el archivo del mensaje. Si no se guarda, el archivo ya
      // está vinculado al chat igual: el mensaje sale de todos modos
      const before: ChatMessage[] = []
      if (attachment) {
        const note = `${UPLOAD_NOTE}${attachment.filename}`
        // Deja la zona de escritura en el acto y pasa ya a la conversación, sin esperar a
        // que el servidor guarde la nota
        setUploadsByChat((prev) => ({
          ...prev,
          [currentChatId]: (prev[currentChatId]?.length ? prev[currentChatId] : [attachment]).map((uf) =>
            uf.filename === attachment.filename ? { ...uf, sent: true } : uf,
          ),
        }))
        setMessages([...messages, { role: "system", content: note }])
        try {
          await addMessage(currentChatId, "system", note)
          before.push({ role: "system", content: note })
        } catch (error) {
          // Sin la nota guardada, el archivo sigue vinculado al chat: el mensaje sale igual
          // (y startStreaming parte de los mensajes sin ella)
          console.warn("No se pudo guardar la nota del archivo:", error)
        }
      }

      // La respuesta será el mensaje tras el del usuario: la misma clave que su «Escuchar»
      liveKeyRef.current = `${currentChatId}:${messages.length + before.length + 1}`

      const previous = [...messages, ...before]
      const reply = await startStreaming(userMessage, currentChatId, before)
      // Con la respuesta ya completa, el título puede resumir de qué va el chat
      if (reply) {
        maybeGenerateTitle(currentChatId, [
          ...previous,
          { role: "user", content: userMessage },
          { role: "assistant", content: reply },
        ])
      }
    } catch (error) {
      console.error("Chat error:", error)
      // Lo escrito no se pierde: vuelve al campo para reintentarlo
      setQuery((current) => current || userMessage)
      toast.error("No se pudo enviar el mensaje")
    } finally {
      sendingRef.current = false
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
    stopStreaming()
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
    // Tras un mensaje del filtro de seguridad no se propone nada
    if (!payload || !chatId || payload.safety || inClass) return null
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
      <div className="message-text text-[14px] whitespace-pre-wrap">{msg.content}</div>
    ) : (
      // Mientras se escribe, el cursor se dibuja (CSS) al final del último párrafo
      <div className={`message-text text-[14px] leading-relaxed ${isLive ? "typing-live" : ""}`}>
        <MessageContent content={msg.content} />
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

      {/* Chat Messages: siempre montado para que el scroll tenga a quién escuchar. Sin el
          anclaje de scroll del navegador: al cambiar el alto del contenido movía la posición
          y ese scroll se tomaba por el usuario subiendo a leer (y se dejaba de seguir el final) */}
      <div ref={messagesContainerRef} className="relative min-h-0 flex-1 overflow-y-auto [overflow-anchor:none] motion-safe:scroll-smooth">
        {messages.length === 0 && isOpeningChat ? (
          <MessagesSkeleton />
        ) : messages.length === 0 && inClass ? (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-balance text-center text-sm text-muted-foreground">
              ¿Algo de la explicación no te queda claro? Pregúntame: te ayudo a entenderlo, sin darte las respuestas de la
              comprobación.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <h1 className="text-center text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              ¿Qué quieres aprender hoy?
            </h1>
          </div>
        ) : (
          <div className={`mx-auto w-full max-w-3xl space-y-4 ${inClass ? "px-3 py-4" : "px-4 py-6 md:px-6"}`}>
            {messages.map((msg, index) => {
              // La respuesta que se está escribiendo ahora mismo
              const isLive = isStreaming && index === messages.length - 1 && msg.role === "assistant"
              const envelope = tutorEnvelope(msg)
              // Las respuestas del filtro de seguridad van sin etiquetas de tutoría; la de
              // apoyo, además, con un estilo sobrio
              const safety = envelope?.payload?.safety
              const label = safety ? null : envelopeLabel(envelope)
              const grounded = safety ? null : envelopeGrounded(envelope)
              // El archivo adjunto a un mensaje: va encima de él, a la derecha, como en el
              // mensaje del usuario (no un aviso de texto en medio del chat)
              const attached = attachedFilename(msg)
              if (attached) {
                const file = sentFile(attached)
                return (
                  <div key={`${index}-file`} className="mb-2 flex justify-end">
                    <FileCard
                      filename={attached}
                      mimeType={file?.mimeType ?? mimeFromFilename(attached)}
                      size={file?.size}
                      documentId={file?.document?.id}
                      documentStatus={file?.document?.status}
                      previewDataUrl={file?.dataUrl}
                      onClick={
                        file
                          ? () => setViewerFile({ filename: file.filename, mimeType: file.mimeType, documentId: file.document?.id, dataUrl: file.dataUrl })
                          : undefined
                      }
                    />
                  </div>
                )
              }
              // Otras notas del sistema (avisos): una línea centrada, no una burbuja
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
                    className={`min-w-0 rounded-2xl px-4 py-3 ${msg.role === "user" ? "max-w-[85%] md:max-w-[80%]" : "max-w-full md:max-w-[80%]"} ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : safety === "support"
                          ? "border border-border bg-background text-foreground"
                          : "bg-muted text-foreground"
                    }`}
                  >
                    {renderMessageContent(msg, isLive)}

                    {msg.role === "assistant" && !isLive && (
                      <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground md:gap-2 md:text-[11px]">
                        <button
                          onClick={() => copyToClipboard(msg.content)}
                          aria-label="Copiar respuesta"
                          className={MESSAGE_ACTION_CLASS}
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
                              className={MESSAGE_ACTION_CLASS}
                            >
                              {playing ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                              {playing ? "Detener" : "Escuchar"}
                            </button>
                          )
                        })()}
                        {label && <span className="px-1.5 py-0.5 rounded bg-secondary/50">{label}</span>}
                        {/* En el chat de una clase: el paso del que habla la respuesta */}
                        {envelope?.payload?.in_class && envelope.payload.concept_title && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary/50">Sobre: {envelope.payload.concept_title}</span>
                        )}
                        {/* Preguntó por otro tema: LARIA contestó corto y propone volver */}
                        {envelope?.payload?.off_topic && inClass?.onBackToClass && (
                          <button
                            onClick={inClass.onBackToClass}
                            className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-primary/20"
                          >
                            Volver a la clase
                          </button>
                        )}
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
                  <ThinkingIndicator label={thinkingLabel} />
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

      <div className={`mx-auto w-full max-w-3xl shrink-0 ${inClass ? "px-3 pb-3" : "px-4 pb-4 md:px-6 md:pb-6"}`}>
        {/* El adjunto, justo encima de la caja de texto (fuera de ella: la caja no cambia
            de tamaño) hasta que sale con el mensaje */}
        {!inClass && (uploadingHere || pendingFiles.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {uploadingHere ? (
            <FileCard filename={uploadingHere.filename} mimeType={uploadingHere.mimeType} uploading />
          ) : pendingFiles.map((uf, index) => (
            <FileCard
              key={`${uf.document?.id || index}`}
              filename={uf.filename}
              size={uf.size}
              mimeType={uf.mimeType}
              documentId={uf.document?.id}
              documentStatus={uf.document?.status}
              previewDataUrl={uf.dataUrl}
              onClick={() =>
                setViewerFile({
                  filename: uf.filename,
                  mimeType: uf.mimeType,
                  documentId: uf.document?.id,
                  dataUrl: uf.dataUrl,
                })
              }
              onRemove={() => removeFile(uf)}
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
            <textarea
              ref={messageInputRef}
              rows={1}
              value={shownQuery}
              onChange={(e) => {
                setQuery(e.target.value)
                setInterimText("")
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                // Enter envía; Shift+Enter, un salto de línea. Con un método de entrada (IME)
                // a medias, Enter confirma la palabra: no envía
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
                e.preventDefault()
                if (shownQuery.trim() && !isStreaming && !uploadingHere) handleSend()
              }}
              data-tour={inClass ? undefined : "chat"}
              placeholder={
                isStreaming
                  ? "Generando respuesta…"
                  : inClass
                    ? "Pregunta sobre esta clase…"
                    : uploadingHere || pendingFiles.length > 0
                      ? "Pregunta algo sobre el archivo…"
                      : "Pregunta lo que quieras…"
              }
              aria-label="Mensaje"
              maxLength={MAX_MESSAGE_CHARS}
              aria-describedby={remaining <= MESSAGE_WARNING_CHARS ? "message-limit" : undefined}
              disabled={isStreaming}
              className="block w-full resize-none overflow-hidden border-0 bg-transparent text-[14px] md:text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            {remaining <= MESSAGE_WARNING_CHARS && (
              <span
                id="message-limit"
                aria-live="polite"
                className={`ml-2 shrink-0 text-xs tabular-nums ${remaining === 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {shownQuery.length}/{MAX_MESSAGE_CHARS}
              </span>
            )}
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
                  // Se vacía ya: así elegir otra vez el mismo archivo (tras un error o un
                  // formato no admitido) vuelve a avisar
                  e.target.value = ""
                  if (file) handleFileUpload(file)
                }}
              />
              {!inClass && (
                <Button
                  data-tour="adjuntar"
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
              )}
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
                  onClick={dictation.isListening ? dictation.stop : startDictation}
                  data-tour={inClass ? undefined : "dictar"}
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
                  // Mismo botón que "Enviar", en el mismo sitio: parar no es un error ni algo
                  // peligroso, así que no va en rojo
                  className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  <Square className="h-3 w-3 fill-current" />
                </Button>
              ) : shownQuery.trim() ? (
                <Button
                  aria-label="Enviar"
                  variant="ghost"
                  size="icon"
                  disabled={!!uploadingHere}
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
