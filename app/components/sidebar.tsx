"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Plus,
  Pin,
  Brain,
  ClipboardList,
  Trash2,
  FileText,
  Pencil,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import { AccountMenu } from "./account-menu"
import { ChatListSkeleton, DocumentListSkeleton } from "./skeletons"
import { useChat } from "@/app/contexts/chat-context"
import { useAuth } from "@/app/contexts/auth-context"
import { NEW_CHAT_HREF, chatHref, quizHref } from "@/lib/routes"
import { useDocuments, documentState, type DocumentState } from "@/hooks/use-documents"

const DOCUMENT_STATE_LABEL: Record<DocumentState, string> = {
  ready: "Analizado",
  failed: "Error de análisis",
  processing: "Procesando...",
}

// onNavigate avisa de que el usuario eligió un destino (el cajón móvil se cierra)
export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter()
  const { chats, chatsLoaded, activeChatId, deleteChat, renameChat } = useChat()
  const { isAuthenticated, user } = useAuth()
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [pinnedPanel, setPinnedPanel] = useState<string | null>(null)
  // Solo una fila del historial puede estar renombrándose o pidiendo confirmación
  const [editing, setEditing] = useState<{ chatId: string; mode: RowMode } | null>(null)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const { documents, loadFailed: documentsLoadFailed, loaded: documentsLoaded } = useDocuments(openPanel === "documents" && isAuthenticated)

  // El chat nuevo se crea al enviar el primer mensaje
  const navigate = (path: string) => {
    router.push(path)
    onNavigate?.()
  }

  const handleNewChat = () => navigate(NEW_CHAT_HREF)

  const handleSelectChat = (chatId: string) => navigate(chatHref(chatId))

  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId)
      if (chatId === activeChatId) router.push(NEW_CHAT_HREF)
    } catch {
      toast.error("No se pudo borrar el chat")
    }
  }

  const handleRenameChat = async (chatId: string, title: string) => {
    try {
      await renameChat(chatId, title)
    } catch {
      toast.error("No se pudo renombrar el chat")
    }
  }

  const handlePanelChange = (panel: string) => {
    if (openPanel === panel) {
      setOpenPanel(null)
    } else {
      setOpenPanel(panel)
    }
  }

  const handlePinToggle = (panel: string) => {
    if (pinnedPanel === panel) {
      setPinnedPanel(null)
      setOpenPanel(null)
    } else {
      setPinnedPanel(panel)
      setOpenPanel(panel)
    }
  }

  const sidebarContent = (
    <div
      className={`relative flex border-r border-border bg-background py-4 transition-all duration-300 ease-in-out z-50 h-full ${
        openPanel ? "w-[280px]" : "w-[72px]"
      }`}
    >
      <div className="flex flex-col h-full w-[72px] shrink-0 items-center">
        {/* Logo */}
        <div className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center">
          <Image src="/images/robot.png" alt="LARIA" width={32} height={32} className="rounded-lg object-contain" />
        </div>

        <Button
          variant="ghost"
          className="mb-8 h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full bg-muted/50"
          onClick={handleNewChat}
          aria-label="Nuevo chat"
        >
          <Plus className="h-5 w-5 shrink-0" />
        </Button>

        <nav className="flex flex-1 flex-col gap-1">
          <div className="relative mb-2 flex flex-col items-center">
            <Button
              variant="ghost"
              onClick={() => handlePanelChange("history")}
              aria-expanded={openPanel === "history"}
              aria-label="Historial"
              className={`h-10 w-10 shrink-0 mx-auto transition-colors ${
                openPanel === "history"
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Clock className="h-5 w-5" />
            </Button>
            <div aria-hidden className="text-[11px] leading-tight text-muted-foreground text-center mt-1 font-medium">Historial</div>
          </div>

          <div className="relative mb-2 flex flex-col items-center">
            <Button
              variant="ghost"
              onClick={() => navigate(quizHref(activeChatId))}
              aria-label="Quiz"
              className="h-10 w-10 shrink-0 mx-auto text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <ClipboardList className="h-5 w-5" />
            </Button>
            <div aria-hidden className="text-[11px] leading-tight text-muted-foreground text-center mt-1 font-medium">Quiz</div>
          </div>

          <div className="relative mb-2 flex flex-col items-center">
            <Button
              variant="ghost"
              onClick={() => navigate("/perfil")}
              aria-label="Perfil"
              className="h-10 w-10 shrink-0 mx-auto text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Brain className="h-5 w-5" />
            </Button>
            <div aria-hidden className="text-[11px] leading-tight text-muted-foreground text-center mt-1 font-medium">Perfil</div>
          </div>

          <div className="relative mb-2 flex flex-col items-center">
            <Button
              variant="ghost"
              onClick={() => handlePanelChange("documents")}
              aria-expanded={openPanel === "documents"}
              aria-label="Documentos"
              className={`h-10 w-10 shrink-0 mx-auto transition-colors ${
                openPanel === "documents"
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <FileText className="h-5 w-5" />
            </Button>
            <div aria-hidden className="text-[11px] leading-tight text-muted-foreground text-center mt-1 font-medium">Documentos</div>
          </div>

          {/* El menú de cuenta se despliega al lado de este botón */}
          <div className="relative mb-2 flex flex-col items-center">
            <Button
              variant="ghost"
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              aria-haspopup="dialog"
              aria-expanded={showAccountMenu}
              aria-label="Cuenta"
              className="h-10 w-10 shrink-0 mx-auto text-muted-foreground hover:text-foreground hover:bg-accent p-0"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {user?.username?.charAt(0).toUpperCase() ?? "?"}
              </span>
            </Button>
            <div aria-hidden className="text-[11px] leading-tight text-muted-foreground text-center mt-1 font-medium">Cuenta</div>
            <AccountMenu isOpen={showAccountMenu} onClose={() => setShowAccountMenu(false)} onNavigate={onNavigate} />
          </div>
        </nav>
      </div>

      {openPanel && (
        <div key={openPanel} className="w-[208px] bg-background border-r border-border">
          {openPanel === "history" && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold">Historial</h2>
                <Button
                  aria-label="Fijar panel"
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 transition-colors ${pinnedPanel === "history" ? "text-primary" : ""}`}
                  onClick={() => handlePinToggle("history")}
                >
                  <Pin
                    className={`h-3.5 w-3.5 transition-transform ${pinnedPanel === "history" ? "rotate-45" : ""}`}
                  />
                </Button>
              </div>
              <div className="px-3 py-1.5">
                <h3 className="text-[11px] font-medium text-muted-foreground">Recientes</h3>
              </div>
              <ScrollArea className="flex-1 px-1.5">
                <div className="space-y-0 pb-2">
                  {!chatsLoaded ? (
                    <ChatListSkeleton />
                  ) : chats.length > 0 ? (
                    chats.map((chat) => (
                      <ChatHistoryItem
                        key={chat.id}
                        title={chat.title}
                        isActive={activeChatId === chat.id}
                        mode={editing?.chatId === chat.id ? editing.mode : "view"}
                        onModeChange={(mode) => setEditing(mode === "view" ? null : { chatId: chat.id, mode })}
                        onSelect={() => handleSelectChat(chat.id)}
                        onRename={(title) => handleRenameChat(chat.id, title)}
                        onDelete={() => handleDeleteChat(chat.id)}
                      />
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground px-2 py-4 text-center">
                      No hay chats aún
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {openPanel === "documents" && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold">Mis Documentos</h2>
                <Button
                  aria-label="Fijar panel"
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 transition-colors ${pinnedPanel === "documents" ? "text-primary" : ""}`}
                  onClick={() => handlePinToggle("documents")}
                >
                  <Pin
                    className={`h-3.5 w-3.5 transition-transform ${pinnedPanel === "documents" ? "rotate-45" : ""}`}
                  />
                </Button>
              </div>
              <ScrollArea className="flex-1 px-1.5">
                <div className="space-y-0 pb-2">
                  {!documentsLoaded ? (
                    <DocumentListSkeleton />
                  ) : documents.length > 0 ? (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="group w-full text-left px-2 py-2 text-[13px] rounded transition-all flex items-center gap-2.5 cursor-default"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{doc.filename}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {DOCUMENT_STATE_LABEL[documentState(doc)]}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground px-2 py-4 text-center">
                      {documentsLoadFailed ? "No se pudieron cargar tus documentos." : "No hay documentos aún."}
                      <br />
                      Sube archivos desde el chat.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return sidebarContent
}

type RowMode = "view" | "rename" | "confirm-delete"

interface ChatHistoryItemProps {
  title: string
  isActive: boolean
  mode: RowMode
  onModeChange: (mode: RowMode) => void
  onSelect: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}

// Una fila del historial: abrir, renombrar en el sitio o borrar tras confirmar
function ChatHistoryItem({ title, isActive, mode, onModeChange, onSelect, onRename, onDelete }: ChatHistoryItemProps) {
  const [draft, setDraft] = useState(title)
  // Enter, Escape y el blur que llega al desmontar el input no deben actuar dos veces
  const finishedRef = useRef(false)

  const startRename = () => {
    finishedRef.current = false
    setDraft(title)
    onModeChange("rename")
  }

  const finishRename = async (save: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onModeChange("view")
    const next = draft.trim()
    if (save && next && next !== title) await onRename(next)
  }

  if (mode === "rename") {
    return (
      <div className="px-1 py-1">
        <input
          autoFocus
          aria-label="Nuevo título"
          maxLength={200}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finishRename(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishRename(true)
            if (e.key === "Escape") finishRename(false)
          }}
          className="w-full rounded border border-border bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    )
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex items-center justify-between gap-1 rounded bg-destructive/10 px-2 py-1.5 text-[12px]">
        <span className="min-w-0 truncate">¿Borrar?</span>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onModeChange("view")}
            className="rounded px-1.5 py-0.5 hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onModeChange("view")
              onDelete()
            }}
            className="rounded bg-destructive px-1.5 py-0.5 text-destructive-foreground hover:bg-destructive/90"
          >
            Borrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative flex w-full items-center justify-between rounded text-[13px] leading-tight text-foreground transition-all duration-200 ${
        isActive ? "bg-accent" : "hover:bg-accent"
      }`}
    >
      {/* Un botón de verdad: se abre también con el teclado */}
      <button
        onClick={onSelect}
        aria-current={isActive ? "page" : undefined}
        className="min-w-0 flex-1 truncate rounded px-2 py-1.5 pr-2 text-left"
      >
        {title}
      </button>
      <div className="flex shrink-0 pr-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          aria-label={`Renombrar chat «${title}»`}
          onClick={startRename}
          className="p-1 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          aria-label={`Borrar chat «${title}»`}
          onClick={() => onModeChange("confirm-delete")}
          className="p-1 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
