import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import { ChatScreen } from "./chat-screen"
import { setAuthToken } from "@/lib/laria-api"
import { controllableSSE, tokenEvent } from "@/test/sse"

// El router de Next: la URL actual y las navegaciones que pide la pantalla
const nav = vi.hoisted(() => ({
  params: {} as { id?: string },
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => (nav.params.id ? `/chat/${nav.params.id}` : "/"),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const tree = (
  <AuthProvider>
    <ChatProvider>
      <ChatScreen />
    </ChatProvider>
  </AuthProvider>
)

function renderAt(id?: string) {
  nav.params = id ? { id } : {}
  return render(tree)
}

beforeEach(() => {
  setAuthToken("token")
  nav.replace.mockReset()
  nav.push.mockReset()
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("ChatScreen", () => {
  it("abrir /chat/c1 muestra la conversación de ese chat", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [{ id: "c1", title: "Átomos" }] })
      if (url.endsWith("/chats/c1"))
        return json({
          id: "c1",
          title: "Átomos",
          messages: [
            { role: "user", content: "¿Qué es un átomo?" },
            { role: "assistant", content: "La unidad más pequeña de un elemento." },
          ],
        })
      throw new Error(`Petición inesperada: ${url}`)
    })

    renderAt("c1")

    expect(await screen.findByText("La unidad más pequeña de un elemento.")).toBeTruthy()
    expect(screen.getByText("¿Qué es un átomo?")).toBeTruthy()
  })

  it("en / el primer mensaje crea el chat, lleva a /chat/<id> y la respuesta no se corta", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/") && method === "GET") return json({ chats: [] })
      if (url.endsWith("/chats/") && method === "POST") return json({ id: "c2", title: "Nuevo chat" })
      if (url.endsWith("/chats/c2/stream")) return sse.fetchMock(url, init)
      if (url.endsWith("/chats/generate-title")) return json({ title: "Fotosíntesis" })
      if (url.endsWith("/chats/c2")) return json({ id: "c2", title: "Fotosíntesis", messages: [] })
      throw new Error(`Petición inesperada: ${method} ${url}`)
    })
    const { rerender } = renderAt()

    const input = await screen.findByRole("textbox")
    fireEvent.change(input, { target: { value: "¿Qué es la fotosíntesis?" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/chat/c2"))
    nav.params = { id: "c2" } // Next actualiza la URL sin desmontar el layout
    rerender(tree)

    sse.push(tokenEvent("Es un proceso"))
    expect(await screen.findByText("Es un proceso")).toBeTruthy()
    expect(screen.getByText("¿Qué es la fotosíntesis?")).toBeTruthy()
  })

  it("un chat que no existe lo dice y ofrece empezar uno nuevo", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/chats/zzz")) return json({ detail: "Chat no encontrado" }, 404)
      throw new Error(`Petición inesperada: ${url}`)
    })

    renderAt("zzz")

    expect(await screen.findByText("Este chat no existe")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Empezar un chat nuevo" }))
    expect(nav.push).toHaveBeenCalledWith("/")
  })
})
