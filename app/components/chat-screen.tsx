"use client"
import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppShell } from "./app-shell"
import { SearchBar } from "./search-bar"
import { useChat } from "@/app/contexts/chat-context"
import { Button } from "@/components/ui/button"

// La URL manda: "/" es un chat nuevo y "/chat/[id]" abre ese chat
export function ChatScreen() {
  const router = useRouter()
  const { id: urlChatId } = useParams<{ id?: string }>()
  const { activeChatId, chatError, selectChat, clearActiveChat } = useChat()

  useEffect(() => {
    if (!urlChatId) clearActiveChat()
    else if (urlChatId !== activeChatId) selectChat(urlChatId)
    // Solo reacciona a cambios de URL: al crear un chat, el contexto se adelanta a ella
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlChatId])

  return (
    <AppShell>
      {chatError ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-muted-foreground">{chatError}</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Empezar un chat nuevo
          </Button>
        </div>
      ) : (
        <SearchBar />
      )}
    </AppShell>
  )
}
