"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Grid3x3,
  Plus,
  Pin,
  LayoutGrid,
  FolderClosed,
  HandCoins,
  Brain,
  ClipboardList,
  Trash2,
  FileText,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import { UpgradeModal } from "./upgrade-modal"
import { AccountMenu } from "./account-menu"
import { useChat } from "@/app/contexts/chat-context"
import { useAuth } from "@/app/contexts/auth-context"
import { lariaAPI, Document } from "@/lib/laria-api"
import { useEffect } from "react"

interface SidebarProps {
  onRequireAuth?: () => void
}

export function Sidebar({ onRequireAuth }: SidebarProps) {
  const router = useRouter()
  const { chats, activeChatId, createChat, selectChat, deleteChat } = useChat()
  const { isAuthenticated } = useAuth()
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [pinnedPanel, setPinnedPanel] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])

  useEffect(() => {
    if (openPanel === "documents" && isAuthenticated) {
      lariaAPI.documents.list()
        .then(setDocuments)
        .catch(() => setDocuments([]))
    }
  }, [openPanel, isAuthenticated])

  const handleNewChat = async () => {
    if (!isAuthenticated) {
      onRequireAuth?.()
      return
    }
    await createChat()
    router.push("/")
  }

  const handleSelectChat = async (chatId: string) => {
    await selectChat(chatId)
    router.push("/")
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteChat(chatId)
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
        <Button variant="ghost" size="icon" className="mb-6 h-10 w-10 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center">
            <Image src="/images/robot.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>
        </Button>

        <Button
          variant="ghost"
          className="mb-8 h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full bg-muted/50"
          onClick={handleNewChat}
        >
          <Plus className="h-5 w-5 shrink-0" />
        </Button>

        <nav className="flex flex-1 flex-col gap-1">
          <div className="relative mb-2">
            <Button
              variant="ghost"
              onClick={() => handlePanelChange("history")}
              className={`h-10 w-10 shrink-0 mx-auto transition-colors ${
                openPanel === "history"
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Clock className="h-5 w-5" />
            </Button>
            <div className="text-[9px] text-muted-foreground text-center mt-1 font-medium">History</div>
          </div>

          <div className="relative mb-2">
            <Button
              variant="ghost"
              onClick={() => handlePanelChange("spaces")}
              className={`h-10 w-10 shrink-0 mx-auto transition-colors ${
                openPanel === "spaces"
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Grid3x3 className="h-5 w-5" />
            </Button>
            <div className="text-[9px] text-muted-foreground text-center mt-1 font-medium">Spaces</div>
          </div>

          <div className="relative mb-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/quiz")}
              className="h-10 w-10 shrink-0 mx-auto text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <ClipboardList className="h-5 w-5" />
            </Button>
            <div className="text-[9px] text-muted-foreground text-center mt-1 font-medium">Quiz</div>
          </div>

          <div className="relative mb-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/perfil")}
              className="h-10 w-10 shrink-0 mx-auto text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Brain className="h-5 w-5" />
            </Button>
            <div className="text-[9px] text-muted-foreground text-center mt-1 font-medium">Perfil</div>
          </div>

          <div className="relative mb-2">
            <Button
              variant="ghost"
              onClick={() => handlePanelChange("documents")}
              className={`h-10 w-10 shrink-0 mx-auto transition-colors ${
                openPanel === "documents"
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <FileText className="h-5 w-5" />
            </Button>
            <div className="text-[9px] text-muted-foreground text-center mt-1 font-medium">Docs</div>
          </div>
        </nav>

        <div className="flex flex-col gap-1 pt-4 items-center">
          <Button
            variant="ghost"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent p-0"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-visible ring-2 ring-primary/60">
              <div className="h-9 w-9 rounded-full overflow-hidden">
                <Image
                  src="/images/robot.png"
                  alt="Profile"
                  width={36}
                  height={36}
                  className="object-cover"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 text-[7px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded">
                pro
              </span>
            </div>
          </Button>
          <div className="text-[9px] text-muted-foreground text-center font-medium">Cuenta</div>

          <Button
            variant="ghost"
            onClick={() => setShowUpgradeModal(true)}
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <HandCoins className="h-5 w-5 shrink-0" />
          </Button>
          <div className="text-[9px] text-muted-foreground text-center font-medium">Contribuye</div>
        </div>
      </div>

      {openPanel && (
        <div key={openPanel} className="w-[208px] bg-background border-r border-border">
          {openPanel === "history" && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold">History</h2>
                <Button
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
                  {chats.length > 0 ? (
                    chats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat.id)}
                        className={`group w-full text-left px-2 py-1.5 text-[13px] leading-tight rounded transition-all duration-200 relative flex items-center justify-between cursor-pointer ${
                          activeChatId === chat.id
                            ? "text-foreground bg-accent"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        <span className="block truncate pr-4 flex-1">{chat.title}</span>
                        <span
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground px-2 py-4 text-center">
                      No hay chats aún
                    </p>
                  )}
                </div>
              </ScrollArea>
              <div className="px-3 py-2">
                <button className="text-xs text-primary hover:underline">Ver todos</button>
              </div>
            </div>
          )}

          {openPanel === "spaces" && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold">Spaces</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 transition-colors ${pinnedPanel === "spaces" ? "text-primary" : ""}`}
                  onClick={() => handlePinToggle("spaces")}
                >
                  <Pin
                    className={`h-3.5 w-3.5 transition-transform ${pinnedPanel === "spaces" ? "rotate-45" : ""}`}
                  />
                </Button>
              </div>
              <div className="p-1.5">
                <button className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] hover:bg-accent rounded transition-colors">
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="font-normal">Templates</span>
                </button>
                <button className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] hover:bg-accent rounded transition-colors">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="font-normal">Create new Space</span>
                </button>
              </div>
              <div className="px-1.5 pb-1.5">
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <h3 className="text-[11px] font-medium text-muted-foreground">Private</h3>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <button className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] hover:bg-accent rounded transition-colors">
                  <FolderClosed className="h-4 w-4 shrink-0" />
                  <span className="font-normal">My Space</span>
                </button>
              </div>
            </div>
          )}

          {openPanel === "documents" && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold">Mis Documentos</h2>
                <Button
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
                  {documents.length > 0 ? (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="group w-full text-left px-2 py-2 text-[13px] rounded transition-all flex items-center gap-2.5 cursor-default"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{doc.filename}</div>
                          <div className="text-[10.5px] text-muted-foreground truncate">
                            {doc.status === "analyzed"
                              ? "Analizado"
                              : doc.status === "analysis_failed"
                                ? "Error de análisis"
                                : doc.has_analysis
                                  ? "Analizado"
                                  : "Procesando..."}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground px-2 py-4 text-center">
                      No hay documentos aún.
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

  return (
    <>
      {sidebarContent}
      <AccountMenu isOpen={showAccountMenu} onClose={() => setShowAccountMenu(false)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  )
}
