"use client"
import { useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppShell } from "./app-shell"
import { SearchBar } from "./search-bar"
import { useChat } from "@/app/contexts/chat-context"
import { Button } from "@/components/ui/button"
import { NEW_CHAT_HREF } from "@/lib/routes"

// La URL manda: "/chat" es un chat nuevo y "/chat/[id]" abre ese chat
export function ChatScreen() {
  const router = useRouter()
  const { id: urlChatId } = useParams<{ id?: string }>()
  const { activeChatId, chatError, messagesLoading, selectChat, clearActiveChat } = useChat()
  // Hasta que llegan sus mensajes, un chat existente no debe parecer uno nuevo
  const isOpeningChat = !!urlChatId && (messagesLoading || urlChatId !== activeChatId)
  const hasSyncedRef = useRef(false)

  useEffect(() => {
    // Al montarse siempre se recarga: si se volvió desde otra página, lo que
    // había en memoria puede estar a medias
    const firstSync = !hasSyncedRef.current
    hasSyncedRef.current = true
    if (!urlChatId) clearActiveChat()
    else if (firstSync || urlChatId !== activeChatId) selectChat(urlChatId)
    // Solo reacciona a cambios de URL: al crear un chat, el contexto se adelanta a ella
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlChatId])

  return (
    <AppShell>
      {chatError === "not-found" ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-muted-foreground">Este chat no existe</p>
          <Button variant="outline" onClick={() => router.push(NEW_CHAT_HREF)}>
            Empezar un chat nuevo
          </Button>
        </div>
      ) : chatError === "load-failed" && urlChatId ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-muted-foreground">No se pudo cargar el chat</p>
          <Button variant="outline" onClick={() => selectChat(urlChatId)}>
            Reintentar
          </Button>
        </div>
      ) : (
        <SearchBar isOpeningChat={isOpeningChat} />
      )}
    </AppShell>
  )
}
