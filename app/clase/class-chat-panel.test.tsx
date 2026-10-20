import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, renderHook, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { setAuthToken } from "@/lib/laria-api"
import { useSpeech } from "@/hooks/use-speech"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider, useChat } from "@/app/contexts/chat-context"
import { preferReducedMotion } from "@/test/media"
import { doneEvent, tokenEvent } from "@/test/sse"
import { ClassChatPanel } from "./class-chat-panel"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clase/p1",
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// Forma del contrato (ADR-054): el chat de siempre más path_id
const classChat = { id: "cc1", title: "Clase: Fotosíntesis", path_id: "p1", messages: [], created_at: "", updated_at: "" }

function Panel({ open = true, docked = false, onOpenChange = () => {} }: { open?: boolean; docked?: boolean; onOpenChange?: (open: boolean) => void }) {
  const speech = useSpeech()
  return (
    <ClassChatPanel
      pathId="p1"
      concept="luz"
      conceptTitle="La fase luminosa"
      speech={speech}
      docked={docked}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

// Las peticiones que hace el panel, con las respuestas del contrato
function backend(overrides: (url: string, init?: RequestInit) => Response | undefined = () => undefined) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const override = overrides(url, init)
    if (override) return override
    if (url.endsWith("/speech/config")) return json({ detail: "Not Found" }, 404)
    if (url.endsWith("/learning/paths/p1/chat")) return json(classChat)
    throw new Error(`Petición inesperada: ${url}`)
  })
  return calls
}

beforeEach(() => {
  preferReducedMotion()
  setAuthToken("token")
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("ClassChatPanel", () => {
  it("cerrado, solo ofrece el botón; no pide el chat (el backend lo crearía)", () => {
    const calls = backend()
    const onOpenChange = vi.fn()
    render(<Panel open={false} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Pregúntale a LARIA" }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(calls.some((c) => c.url.includes("/chat"))).toBe(false)
  })

  it("en móvil es una hoja modal con el chat de la clase, sin adjuntar; Esc la cierra", async () => {
    backend()
    const onOpenChange = vi.fn()
    render(<Panel onOpenChange={onOpenChange} />)
    const dialog = await screen.findByRole("dialog", { name: "Pregúntale a LARIA" })
    expect(dialog.textContent).toMatch(/Sobre La fase luminosa/)
    expect(await screen.findByPlaceholderText("Pregunta sobre esta clase…")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Adjuntar archivo" })).toBeNull()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("al lado de la explicación no es un diálogo", async () => {
    backend()
    render(<Panel docked />)
    expect(await screen.findByRole("complementary", { name: "Pregúntale a LARIA" })).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("cada pregunta va con el paso que se ve, por el stream de siempre", async () => {
    const calls = backend((url) =>
      url.endsWith("/chats/cc1/stream")
        ? new Response(tokenEvent("La luz excita la clorofila.") + doneEvent(), { status: 200, headers: { "Content-Type": "text/event-stream" } })
        : undefined,
    )
    render(<Panel />)
    const input = await screen.findByPlaceholderText("Pregunta sobre esta clase…")
    fireEvent.change(input, { target: { value: "¿Qué hace la clorofila?" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await screen.findByText("La luz excita la clorofila.")
    const stream = calls.find((c) => c.url.endsWith("/chats/cc1/stream"))
    expect(JSON.parse(String(stream?.init?.body))).toEqual({ role: "user", content: "¿Qué hace la clorofila?", concept: "luz" })
  })

  it("con el interruptor apagado (404 class_questions_disabled) desaparece", async () => {
    backend((url) =>
      url.endsWith("/learning/paths/p1/chat") ? json({ detail: "Las preguntas en clase no están activas", reason: "class_questions_disabled" }, 404) : undefined,
    )
    const onOpenChange = vi.fn()
    const { container } = render(<Panel onOpenChange={onOpenChange} />)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(container.textContent).toBe("")
  })

  it("si falla al abrir, se puede reintentar", async () => {
    let fail = true
    backend((url) => (url.endsWith("/learning/paths/p1/chat") && fail ? json({ detail: "Error" }, 500) : undefined))
    render(<Panel />)
    const retry = await screen.findByRole("button", { name: "Reintentar" })
    fail = false
    fireEvent.click(retry)
    expect(await screen.findByPlaceholderText("Pregunta sobre esta clase…")).toBeTruthy()
  })
})

describe("chats de clase en la lista", () => {
  it("no salen en la barra de chats: se abren desde su clase", async () => {
    backend((url) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/"))
        return json({
          chats: [
            { id: "c1", title: "Átomos", path_id: null },
            { id: "cc1", title: "Clase: Fotosíntesis", path_id: "p1" },
          ],
        })
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>
        <ChatProvider>{children}</ChatProvider>
      </AuthProvider>
    )
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.chatsLoaded).toBe(true))
    expect(result.current.chats.map((c) => c.id)).toEqual(["c1"])
  })
})
