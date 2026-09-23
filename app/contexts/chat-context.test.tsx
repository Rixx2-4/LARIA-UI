import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import type { ReactNode } from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { AuthProvider } from "./auth-context"
import { ChatProvider, useChat } from "./chat-context"
import { setAuthToken, type ChatMessage } from "@/lib/laria-api"

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <ChatProvider>{children}</ChatProvider>
  </AuthProvider>
)

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

beforeEach(() => setAuthToken("token-de-prueba"))
afterEach(() => {
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("ChatProvider", () => {
  it("crear un chat nuevo no borra el primer mensaje que el usuario acaba de enviar", async () => {
    // El servidor tarda en devolver el chat recién creado, todavía vacío
    let releaseNewChat!: () => void
    const newChatLoaded = new Promise<void>((r) => (releaseNewChat = r))

    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/") && method === "GET") return json({ chats: [] })
      if (url.endsWith("/chats/") && method === "POST") return json({ id: "c2", title: "Nuevo chat" })
      if (url.endsWith("/chats/c2")) {
        await newChatLoaded
        return json({ id: "c2", title: "Nuevo chat", messages: [] })
      }
      throw new Error(`Petición inesperada: ${method} ${url}`)
    })

    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.chats).toEqual([]))

    const firstMessage: ChatMessage = { role: "user", content: "¿Qué es un átomo?" }
    await act(async () => {
      await result.current.createChat()
      result.current.setMessages([firstMessage])
    })
    await act(async () => {
      releaseNewChat()
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.activeChatId).toBe("c2")
    expect(result.current.messages).toEqual([firstMessage])
  })
})
