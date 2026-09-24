import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import { Sidebar } from "./sidebar"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// Servidor con un chat "Átomos"; registra las peticiones que cambian algo
function stubServer() {
  let chats = [{ id: "c1", title: "Átomos" }]
  const writes: string[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats })
    if (url.endsWith("/chats/c1") && method === "DELETE") {
      writes.push("DELETE c1")
      chats = []
      return new Response(null, { status: 204 })
    }
    if (url.endsWith("/chats/c1") && method === "PUT") {
      const { title } = JSON.parse(String(init?.body))
      writes.push(`PUT c1 ${title}`)
      chats = [{ id: "c1", title }]
      return json(chats[0])
    }
    throw new Error(`Petición inesperada: ${method} ${url}`)
  })
  return writes
}

async function openHistory() {
  render(
    <AuthProvider>
      <ChatProvider>
        <Sidebar />
      </ChatProvider>
    </AuthProvider>,
  )
  fireEvent.click(await screen.findByRole("button", { name: "Historial" }))
  await screen.findByText("Átomos")
}

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("Sidebar", () => {
  it("borrar un chat pide confirmación y cancelar no lo borra", async () => {
    const writes = stubServer()
    await openHistory()

    fireEvent.click(screen.getByRole("button", { name: "Borrar chat «Átomos»" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(writes).toEqual([])
    expect(screen.getByText("Átomos")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Borrar chat «Átomos»" }))
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(screen.queryByText("Átomos")).toBeNull())
    expect(writes).toEqual(["DELETE c1"])
  })

  it("renombrar un chat guarda el título nuevo", async () => {
    const writes = stubServer()
    await openHistory()

    fireEvent.click(screen.getByRole("button", { name: "Renombrar chat «Átomos»" }))
    const input = screen.getByRole("textbox", { name: "Nuevo título" })
    fireEvent.change(input, { target: { value: "Química básica" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(await screen.findByText("Química básica")).toBeTruthy()
    expect(writes).toEqual(["PUT c1 Química básica"])
  })
})
