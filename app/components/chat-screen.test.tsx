import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import { ChatScreen } from "./chat-screen"
import { setAuthToken } from "@/lib/laria-api"
import { controllableSSE, doneEvent, tokenEvent } from "@/test/sse"
import { FakeSpeechRecognition } from "@/test/speech"
import { preferReducedMotion } from "@/test/media"

// El router de Next: la URL actual y las navegaciones que pide la pantalla
const nav = vi.hoisted(() => ({
  params: {} as { id?: string },
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => (nav.params.id ? `/chat/${nav.params.id}` : "/chat"),
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
  // Estos tests van de rutas y anuncios, no del efecto de escritura: sin él, no dependen del reloj
  preferReducedMotion()
  setAuthToken("token")
  nav.replace.mockReset()
  nav.push.mockReset()
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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
    // Salir vive en el menú de Cuenta, no en la cabecera
    expect(screen.queryByRole("button", { name: /Salir/ })).toBeNull()
    // La cabecera no lleva el nombre de la app (sale en la barra lateral desplegada)
    expect(screen.queryByText("IA")).toBeNull()
    expect(screen.queryByText("LARIA")).toBeNull()
  })

  it("mientras llega un chat existente no se presenta como un chat nuevo", async () => {
    let answer: (response: Response) => void = () => {}
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [{ id: "c1", title: "Átomos" }] })
      if (url.endsWith("/chats/c1")) return new Promise<Response>((resolve) => (answer = resolve))
      throw new Error(`Petición inesperada: ${url}`)
    })

    renderAt("c1")

    expect(await screen.findByRole("status", { name: "Cargando la conversación" })).toBeTruthy()
    expect(screen.queryByText("¿Qué quieres aprender hoy?")).toBeNull()

    act(() => answer(json({ id: "c1", title: "Átomos", messages: [{ role: "user", content: "¿Qué es un átomo?" }] })))
    expect(await screen.findByText("¿Qué es un átomo?")).toBeTruthy()
    expect(screen.queryByRole("status", { name: "Cargando la conversación" })).toBeNull()
  })

  it("en /chat el primer mensaje crea el chat, lleva a /chat/<id> y la respuesta no se corta", async () => {
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

  it("a los lectores de pantalla les anuncia el principio y el final de la respuesta, no cada fragmento", async () => {
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
    renderAt()
    const live = () => document.querySelector("[aria-live=polite]")?.textContent

    const input = await screen.findByRole("textbox")
    fireEvent.change(input, { target: { value: "¿Qué es la fotosíntesis?" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => expect(live()).toBe("LARIA está respondiendo…"))
    sse.push(tokenEvent("Es un proceso"))
    expect(await screen.findByText("Es un proceso")).toBeTruthy()
    expect(live()).toBe("LARIA está respondiendo…")

    sse.push(doneEvent())
    await waitFor(() => expect(live()).toBe("Respuesta de LARIA lista."))
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
    expect(nav.push).toHaveBeenCalledWith("/chat")
  })

  it("al volver a un chat desde otra página, lo recarga del servidor", async () => {
    let saved = "Respuesta a medias"
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [{ id: "c1", title: "Átomos" }] })
      if (url.endsWith("/chats/c1"))
        return json({ id: "c1", title: "Átomos", messages: [{ role: "assistant", content: saved }] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    const page = (showChat: boolean) => (
      <AuthProvider>
        <ChatProvider>{showChat ? <ChatScreen /> : <p>Quiz</p>}</ChatProvider>
      </AuthProvider>
    )
    nav.params = { id: "c1" }
    const { rerender } = render(page(true))
    expect(await screen.findByText("Respuesta a medias")).toBeTruthy()

    rerender(page(false)) // se va a /quiz: la pantalla de chat se desmonta
    saved = "Respuesta completa"
    rerender(page(true)) // vuelve a /chat/c1

    expect(await screen.findByText("Respuesta completa")).toBeTruthy()
  })

  it("si el chat no se pudo cargar, se puede reintentar", async () => {
    let online = false
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/chats/c1")) {
        if (!online) return json({ detail: "Error interno" }, 500)
        return json({ id: "c1", title: "Átomos", messages: [{ role: "assistant", content: "Hola de nuevo" }] })
      }
      throw new Error(`Petición inesperada: ${url}`)
    })
    renderAt("c1")

    expect(await screen.findByText("No se pudo cargar el chat")).toBeTruthy()
    online = true
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Hola de nuevo")).toBeTruthy()
  })

  it("los archivos adjuntos se quedan en su chat", async () => {
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/upload"))
        return json({ id: "d1", owner_id: "u1", filename: "tema1.txt", subject: "", status: "processing", uploaded_at: "", has_analysis: false, error_message: null })
      if (url.endsWith("/messages") || method === "PUT") return json({ id: "c1", title: "t", messages: [] })
      const id = url.match(/\/chats\/(c\d)$/)?.[1]
      if (id) return json({ id, title: id, messages: [{ role: "user", content: `Hola desde ${id}` }] })
      throw new Error(`Petición inesperada: ${method} ${url}`)
    })
    const { container, rerender } = renderAt("c1")
    await screen.findByText("Hola desde c1")

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(fileInput, { target: { files: [new File(["apuntes"], "tema1.txt", { type: "text/plain" })] } })
    expect(await screen.findByText("tema1.txt")).toBeTruthy()

    nav.params = { id: "c2" }
    rerender(<AuthProvider><ChatProvider><ChatScreen /></ChatProvider></AuthProvider>)
    await screen.findByText("Hola desde c2")
    expect(screen.queryByText("tema1.txt")).toBeNull()

    nav.params = { id: "c1" }
    rerender(<AuthProvider><ChatProvider><ChatScreen /></ChatProvider></AuthProvider>)
    await screen.findByText("Hola desde c1")
    expect(screen.getByText("tema1.txt")).toBeTruthy()
  })

  it("la nota de archivo subido va como mensaje de sistema: no dispara un turno del tutor", async () => {
    const sent: { role: string; content: string }[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/upload"))
        return json({ id: "d1", owner_id: "u1", filename: "tema1.txt", subject: "", status: "processing", uploaded_at: "", has_analysis: false, error_message: null })
      if (method === "PUT") return json({ id: "c1", title: "t", messages: [] })
      if (url.endsWith("/messages")) {
        const body = JSON.parse(String(init?.body))
        sent.push(body)
        return json({ id: "c1", title: "t", messages: [{ role: "user", content: "Hola" }, body] })
      }
      if (url.endsWith("/chats/c1")) return json({ id: "c1", title: "t", messages: [{ role: "user", content: "Hola" }] })
      throw new Error(`Petición inesperada: ${method} ${url}`)
    })
    const { container } = renderAt("c1")
    await screen.findByText("Hola")

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(fileInput, { target: { files: [new File(["apuntes"], "tema1.txt", { type: "text/plain" })] } })

    const note = await screen.findByText("📎 Subí el archivo: tema1.txt")
    expect(sent).toEqual([{ role: "system", content: "📎 Subí el archivo: tema1.txt" }])
    // Una línea de aviso, no una burbuja del tutor
    expect(note.tagName).toBe("P")
  })

  it("al abrir un chat con documento vinculado (p. ej. tras recargar), muestra su archivo", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/"))
        return json([{ id: "d1", owner_id: "u1", filename: "tema1.pdf", subject: "", status: "analyzed", uploaded_at: "", has_analysis: true, error_message: null }])
      if (url.endsWith("/chats/c1"))
        return json({ id: "c1", title: "Tema 1", document_id: "d1", messages: [{ role: "user", content: "📎 Subí el archivo: tema1.pdf" }] })
      throw new Error(`Petición inesperada: ${url}`)
    })

    renderAt("c1")

    expect(await screen.findByText("tema1.pdf")).toBeTruthy()
  })

  describe("dictado por voz", () => {
    const serverWithEmptyChat = () =>
      vi.stubGlobal("fetch", async (url: string) => {
        if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
        if (url.endsWith("/chats/")) return json({ chats: [] })
        throw new Error(`Petición inesperada: ${url}`)
      })

    afterEach(() => {
      delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
      FakeSpeechRecognition.instances = []
    })

    it("lo dictado se añade al mensaje y se puede parar", async () => {
      ;(window as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition
      serverWithEmptyChat()
      renderAt()

      const input = (await screen.findByRole("textbox")) as HTMLInputElement
      fireEvent.change(input, { target: { value: "Explícame" } })
      fireEvent.click(screen.getByRole("button", { name: "Dictar" }))
      const recognition = FakeSpeechRecognition.instances[0]
      expect(recognition.listening).toBe(true)
      expect(recognition.lang).toBe("es-ES")

      act(() => recognition.say("la fotosíntesis"))
      expect(input.value).toBe("Explícame la fotosíntesis")

      fireEvent.click(screen.getByRole("button", { name: "Parar dictado" }))
      expect(recognition.listening).toBe(false)
      act(() => recognition.end())
      expect(screen.getByRole("button", { name: "Dictar" })).toBeTruthy()
    })

    it("el texto va apareciendo mientras se dicta y se fija al terminar la frase", async () => {
      ;(window as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition
      serverWithEmptyChat()
      renderAt()

      const input = (await screen.findByRole("textbox")) as HTMLInputElement
      fireEvent.change(input, { target: { value: "Explícame" } })
      fireEvent.click(screen.getByRole("button", { name: "Dictar" }))
      const recognition = FakeSpeechRecognition.instances[0]
      expect(recognition.interimResults).toBe(true)

      act(() => recognition.sayInterim("la foto"))
      expect(input.value).toBe("Explícame la foto")
      act(() => recognition.sayInterim("la fotosín"))
      expect(input.value).toBe("Explícame la fotosín")

      act(() => recognition.say("la fotosíntesis"))
      expect(input.value).toBe("Explícame la fotosíntesis")

      act(() => recognition.sayInterim("y la"))
      fireEvent.click(screen.getByRole("button", { name: "Parar dictado" }))
      act(() => recognition.end())
      expect(input.value).toBe("Explícame la fotosíntesis")
    })

    it("enviar mientras se dicta envía también lo que aún se estaba reconociendo", async () => {
      ;(window as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition
      const sent: string[] = []
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET"
        if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
        if (url.endsWith("/chats/") && method === "GET") return json({ chats: [] })
        if (url.endsWith("/chats/") && method === "POST") return json({ id: "c2", title: "Nuevo" })
        if (url.endsWith("/stream")) {
          sent.push(JSON.parse(String(init?.body)).content)
          return new Response(doneEvent(), { status: 200 })
        }
        return json({ id: "c2", title: "t", messages: [] })
      })
      renderAt()

      const input = (await screen.findByRole("textbox")) as HTMLInputElement
      fireEvent.click(screen.getByRole("button", { name: "Dictar" }))
      act(() => FakeSpeechRecognition.instances[0].sayInterim("qué es un átomo"))
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => expect(sent).toEqual(["qué es un átomo"]))
      expect(input.value).toBe("")
    })

    it("si el navegador no reconoce voz, no muestra el micrófono", async () => {
      serverWithEmptyChat()
      renderAt()

      await screen.findByRole("textbox")
      expect(screen.queryByRole("button", { name: "Dictar" })).toBeNull()
    })

    it("al enviar, una frase que llegue tarde no reaparece en el campo vacío", async () => {
      ;(window as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET"
        if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
        if (url.endsWith("/chats/") && method === "GET") return json({ chats: [] })
        if (url.endsWith("/chats/") && method === "POST") return json({ id: "c2", title: "Nuevo" })
        if (url.endsWith("/stream")) return new Response(doneEvent(), { status: 200 })
        return json({ id: "c2", title: "t", messages: [] })
      })
      renderAt()

      const input = (await screen.findByRole("textbox")) as HTMLInputElement
      fireEvent.click(screen.getByRole("button", { name: "Dictar" }))
      const recognition = FakeSpeechRecognition.instances[0]
      act(() => recognition.say("hola"))
      fireEvent.keyDown(input, { key: "Enter" })
      act(() => recognition.say("frase tardía"))

      expect(input.value).toBe("")
    })
  })
})
