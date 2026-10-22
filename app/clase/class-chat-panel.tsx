"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, MessageCircleQuestion, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/app/components/search-bar"
import { FixedChatProvider } from "@/app/contexts/chat-context"
import { ApiError, lariaAPI, type Chat, type ChatMessage } from "@/lib/laria-api"
import type { useSpeech } from "@/hooks/use-speech"

// «Pregúntale a LARIA» durante la clase (ADR-054): el chat de esa ruta, con el SSE, la
// voz y el dictado de siempre. En pantallas anchas va al lado de la explicación; en las
// demás, una hoja que sube desde abajo. El chat se pide al abrirlo la primera vez (el
// backend lo crea entonces) y sigue ahí al cerrarlo y volver

// Ancho a partir del cual cabe al lado: barra lateral + explicación + panel
export const DOCKED_QUERY = "(min-width: 1280px)"
// Si lo cerró en escritorio, la próxima clase empieza cerrado
const CLOSED_KEY = "laria_clase_chat_cerrado"

type ChatState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; chat: Chat }
  | { kind: "error" }

function readClosed(): boolean {
  try {
    return localStorage.getItem(CLOSED_KEY) === "1"
  } catch {
    return false
  }
}

function saveClosed(closed: boolean) {
  try {
    if (closed) localStorage.setItem(CLOSED_KEY, "1")
    else localStorage.removeItem(CLOSED_KEY)
  } catch {
    // Sin almacenamiento se recuerda solo en esta visita
  }
}

export function useDocked(): boolean {
  const [docked, setDocked] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.(DOCKED_QUERY)
    if (!query) return
    // matchMedia solo existe en el cliente: se lee al montar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDocked(query.matches)
    const onChange = (e: MediaQueryListEvent) => setDocked(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return docked
}

interface ClassChatPanelProps {
  pathId: string
  // El paso que se está viendo (clave canónica) y su título
  concept?: string
  conceptTitle?: string | null
  speech: ReturnType<typeof useSpeech>
  docked: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Si el backend tiene activas las preguntas en clase; hasta saberlo, no se ofrece
export function useClassQuestionsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let cancelled = false
    lariaAPI.learning
      .preferences()
      .then((prefs) => !cancelled && setEnabled(!!prefs.class_questions_enabled))
      // Sin preferencias no se ofrece
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return enabled
}

// Abierto por defecto al lado de la explicación (salvo que lo cerrara); en la hoja, cerrado
export function useClassChatOpen(docked: boolean) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // localStorage y el ancho solo se conocen en el cliente
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(docked && !readClosed())
  }, [docked])
  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (docked) saveClosed(!next)
    },
    [docked],
  )
  return { open, onOpenChange }
}

export function ClassChatPanel({ pathId, concept, conceptTitle, speech, docked, open, onOpenChange }: ClassChatPanelProps) {
  const [state, setState] = useState<ChatState>({ kind: "idle" })
  // Si el backend dice que está apagado, no se vuelve a ofrecer
  const [disabled, setDisabled] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(false)

  const load = useCallback(async () => {
    // Un solo GET en vuelo: el backend crea el chat la primera vez
    if (requestRef.current) return
    requestRef.current = true
    setState({ kind: "loading" })
    try {
      setState({ kind: "ready", chat: await lariaAPI.paths.chat(pathId) })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.reason === "class_questions_disabled") {
        setDisabled(true)
        onOpenChange(false)
      } else {
        setState({ kind: "error" })
      }
    } finally {
      requestRef.current = false
    }
  }, [pathId, onOpenChange])

  // El chat se desmonta al cerrar el panel: lo hablado se guarda aquí para que al
  // volver a abrirlo siga ahí (y no solo lo que había al pedirlo la primera vez)
  const keepMessages = useCallback((messages: ChatMessage[]) => {
    setState((prev) => (prev.kind === "ready" ? { kind: "ready", chat: { ...prev.chat, messages } } : prev))
  }, [])

  // Al volver a abrirlo (o al pasar de panel lateral a hoja, que vuelve a montar el chat)
  // se trae la versión guardada: si se cortó a mitad de una respuesta, lo que quedó a
  // medias se sustituye por lo que el servidor guardó. Solo si entretanto no se ha
  // escrito nada nuevo (no pisa una respuesta en curso)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  const wasClosedRef = useRef(false)
  const dockedRef = useRef(docked)
  useEffect(() => {
    const remounted = dockedRef.current !== docked
    dockedRef.current = docked
    if (!open) {
      wasClosedRef.current = true
      return
    }
    if (!wasClosedRef.current && !remounted) return
    wasClosedRef.current = false
    const current = stateRef.current
    if (current.kind !== "ready") return
    const shown = current.chat.messages
    lariaAPI.chats
      .get(current.chat.id)
      .then((saved) =>
        setState((prev) =>
          prev.kind === "ready" && prev.chat.messages === shown
            ? { kind: "ready", chat: { ...prev.chat, messages: saved.messages ?? [] } }
            : prev,
        ),
      )
      .catch(() => {})
  }, [open, docked])

  useEffect(() => {
    // Se pide al abrirlo por primera vez; el estado se actualiza tras la respuesta
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && state.kind === "idle") load()
  }, [open, state.kind, load])

  // La hoja: Esc la cierra, el foco entra en ella y vuelve al botón al cerrarla
  const sheet = open && !docked
  useEffect(() => {
    if (!sheet) return
    const trigger = triggerRef.current
    sheetRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      trigger?.focus()
    }
  }, [sheet, onOpenChange])

  if (disabled) return null

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id="pregunta-a-laria" className="text-sm font-semibold">
            Pregúntale a LARIA
          </h2>
          {conceptTitle && <p className="truncate text-xs text-muted-foreground">Sobre {conceptTitle}</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Cerrar las preguntas" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {state.kind === "ready" ? (
          <FixedChatProvider chat={state.chat} onMessagesChange={keepMessages}>
            <SearchBar inClass={{ concept, speech, onBackToClass: () => onOpenChange(false) }} />
          </FixedChatProvider>
        ) : state.kind === "error" ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">No se pudo abrir el chat de la clase.</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reintentar
            </Button>
          </div>
        ) : (
          <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Abriendo el chat…
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Siempre montado (oculto con el panel abierto): al cerrar la hoja, el foco vuelve aquí */}
      <Button
        ref={triggerRef}
        onClick={() => onOpenChange(true)}
        className={`fixed bottom-4 right-4 z-30 gap-2 rounded-full shadow-lg ${open ? "hidden" : ""}`}
        aria-haspopup={docked ? undefined : "dialog"}
      >
        <MessageCircleQuestion className="h-4 w-4" aria-hidden />
        Pregúntale a LARIA
      </Button>
      {open && docked && (
        <aside aria-labelledby="pregunta-a-laria" className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background">
          {body}
        </aside>
      )}
      {sheet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" aria-hidden onClick={() => onOpenChange(false)} />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pregunta-a-laria"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 h-[85dvh] overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-200 focus:outline-none motion-reduce:animate-none"
          >
            {body}
          </div>
        </>
      )}
    </>
  )
}
