import { useState } from "react"
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider, useChat } from "@/app/contexts/chat-context"
import { ChatScreen } from "./chat-screen"
import { setAuthToken } from "@/lib/laria-api"
import { controllableSSE, doneEvent, tokenEvent } from "@/test/sse"
import { FakeSpeechRecognition } from "@/test/speech"
import { preferReducedMotion } from "@/test/media"
import { toast } from "sonner"

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

  describe("quiz en la conversación", () => {
    type Payload = Record<string, unknown>
    // Servidor como Render: el tutor responde a "quiero aprender…" o "ponme un quiz" con
    // el envelope que se le pase; los quizzes se generan y se califican en el servidor
    function quizServer({ type = "answer", payload, documentId = null, preferences = true, practiceFailures = 0 }: { type?: string; payload: Payload; documentId?: string | null; preferences?: boolean; practiceFailures?: number }) {
      const calls = { diagnostics: [] as string[], practice: [] as string[], topicPractice: [] as unknown[], attempts: 0, streamed: [] as string[], styles: [] as unknown[] }
      const quiz = (id: string, count: number, extra: Payload = {}) => ({
        id, document_id: documentId, total_points: count * 10, created_at: "", ...extra,
        questions: Array.from({ length: count }, (_, i) => ({
          index: i, text: `Pregunta ${i + 1}`, options: { A: "uno", B: "dos", C: "tres", D: "cuatro" }, difficulty: "easy",
        })),
      })
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET"
        if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
        if (url.endsWith("/chats/")) return json({ chats: [{ id: "c1", title: "Chat" }] })
        if (url.endsWith("/documents/")) return json([])
        if (url.endsWith("/chats/c1"))
          return json({
            id: "c1", title: "Chat", document_id: documentId,
            messages: [
              { role: "user", content: "Quiero aprender astronomía" },
              { role: "assistant", content: "La astronomía estudia los cuerpos celestes.", metadata: { type, emotion: "encouraging", payload: { content: "…", grounded: !!documentId, ...payload } } },
            ],
          })
        if (url.endsWith("/quizzes/diagnostic") && method === "POST") {
          calls.diagnostics.push(JSON.parse(String(init?.body)).topic)
          return json(quiz("diag", 6, { topic: "astronomia", topic_label: "Astronomía" }), 201)
        }
        if (url.endsWith("/learning/me/preferences")) {
          // Sin el endpoint (backend aún sin desplegar) responde 404
          if (!preferences) return json({ detail: "Not Found" }, 404)
          if (method === "PUT") {
            calls.styles.push(JSON.parse(String(init?.body)))
            return json(JSON.parse(String(init?.body)))
          }
          return json({ explanation_style: null })
        }
        if (url.endsWith("/quizzes/practice") && method === "POST") {
          if (practiceFailures-- > 0) return json({ detail: "El servicio de IA está recibiendo muchas peticiones ahora mismo." }, 503)
          calls.topicPractice.push(JSON.parse(String(init?.body)))
          return json(quiz("prac", 5, { topic: "fracciones", topic_label: "Fracciones" }), 201)
        }
        if (url.includes("/chats/c1/quiz?") && method === "POST") {
          calls.practice.push(url)
          return json(quiz("prac", 5))
        }
        const attempt = url.match(/\/quizzes\/(\w+)\/attempts$/)
        if (attempt && method === "POST") {
          calls.attempts++
          const { answers } = JSON.parse(String(init?.body))
          return json({
            attempt_id: "a1", quiz_id: attempt[1], score: 0, total_points: 0, completed_at: "",
            questions: Object.entries(answers).map(([index, selected]) => ({ index: Number(index), text: `Pregunta ${Number(index) + 1}`, selected, correct_answer: "C", is_correct: selected === "C" })),
            placement: attempt[1] === "diag" ? { topic: "astronomia", topic_label: "Astronomía", round: "base", level: "basico", passed: false, has_next_round: false } : null,
          })
        }
        if (url.endsWith("/chats/c1/stream") && method === "POST") {
          calls.streamed.push(JSON.parse(String(init?.body)).content)
          return new Response(tokenEvent("Empecemos por el sistema solar.") + doneEvent(), { status: 200 })
        }
        throw new Error(`Petición inesperada: ${method} ${url}`)
      })
      return calls
    }

    // Responde la tarjeta entera con la misma opción, por texto (más rápido que por rol)
    async function answerAll(optionText: string) {
      for (;;) {
        fireEvent.click(await screen.findByText(optionText))
        const finish = screen.queryByText("Finalizar")
        if (finish) return fireEvent.click(finish)
        fireEvent.click(screen.getByText("Siguiente"))
      }
    }

    beforeEach(() => localStorage.clear())

    it("«quiero aprender X» (suggest_placement): nivelación aquí mismo y la clase empieza en este chat", async () => {
      const calls = quizServer({ payload: { intent: "learn", suggest_placement: true, topic_hint: "astronomía" } })
      renderAt("c1")

      // El tema viene del backend (topic_hint), con sus tildes
      const topic = (await screen.findByLabelText("Tema de la nivelación")) as HTMLInputElement
      expect(topic.value).toBe("astronomía")
      fireEvent.click(screen.getByRole("button", { name: "Empezar" }))

      expect(await screen.findByText("1 de 6")).toBeTruthy()
      // Se muestra el nombre para mostrar (topic_label), no la clave interna
      expect(screen.getByText("Nivelación · Astronomía")).toBeTruthy()
      await answerAll("dos")

      // Tras evaluarte, cómo prefieres que te explique
      expect(await screen.findByText("¿Cómo prefieres que te explique?")).toBeTruthy()
      fireEvent.click(screen.getByText("Con ejemplos y analogías"))
      await waitFor(() => expect(calls.styles).toEqual([{ explanation_style: "analogy" }]))

      expect(await screen.findByText("Preparando tu clase de Astronomía")).toBeTruthy()
      await waitFor(() => expect(calls.streamed).toEqual(["Empecemos la clase de Astronomía. En la nivelación quedé en nivel básico."]))
      expect(await screen.findByText(/Nivelación de/)).toBeTruthy()
      expect(calls.diagnostics).toEqual(["astronomía"])
      // Sin salir del chat
      expect(nav.push).not.toHaveBeenCalled()
    })

    it("si el backend aún no guarda el estilo, la clase empieza igual", async () => {
      const calls = quizServer({ payload: { intent: "learn", suggest_placement: true, topic_hint: "astronomía" }, preferences: false })
      renderAt("c1")

      fireEvent.click(await screen.findByRole("button", { name: "Empezar" }))
      await answerAll("dos")
      fireEvent.click(await screen.findByText("Que lo decida LARIA"))

      await waitFor(() => expect(calls.streamed).toHaveLength(1))
    })

    it("si el tutor ya parte de tu nivel en el tema (placement_level), lo indica y no ofrece nivelarse", async () => {
      quizServer({ type: "explanation", payload: { intent: "learn", placement_level: "intermedio", topic_hint: "astronomía" } })
      renderAt("c1")

      expect(await screen.findByText("Tu nivel: intermedio")).toBeTruthy()
      expect(screen.queryByLabelText("Tema de la nivelación")).toBeNull()
    })

    it("si el tutor pregunta cómo prefieres aprender, se puede elegir pulsando", async () => {
      const calls = quizServer({ payload: { intent: "learning_style", ask_learning_style: true } })
      renderAt("c1")

      expect(await screen.findByText("¿Cómo prefieres que te explique?")).toBeTruthy()
      fireEvent.click(screen.getByText("Paso a paso"))

      await waitFor(() => expect(calls.styles).toEqual([{ explanation_style: "step_by_step" }]))
      expect(await screen.findByText(/Te explicaré:/)).toBeTruthy()
      // Solo la elección: ni quiz ni clase
      expect(calls.diagnostics).toEqual([])
      expect(calls.streamed).toEqual([])
    })

    it("si contestó en el chat, muestra el estilo que guardó el backend sin volver a guardarlo", async () => {
      const calls = quizServer({ payload: { intent: "learning_style", explanation_style_chosen: "visual" } })
      renderAt("c1")

      expect(await screen.findByText(/Estilo guardado:/)).toBeTruthy()
      expect(screen.getByText(/Con esquemas y dibujos/)).toBeTruthy()
      expect(screen.queryByText("¿Cómo prefieres que te explique?")).toBeNull()
      expect(calls.styles).toEqual([])
    })

    it("con «learn» a secas (una pregunta conceptual) no ofrece nivelación", async () => {
      quizServer({ payload: { intent: "learn" } })
      renderAt("c1")

      await screen.findByText("La astronomía estudia los cuerpos celestes.")
      expect(screen.queryByLabelText("Tema de la nivelación")).toBeNull()
    })

    it("«Ahora no» la cierra y ese chat no la vuelve a ofrecer", async () => {
      quizServer({ payload: { intent: "learn", suggest_placement: true, topic_hint: "astronomía" } })
      const { unmount } = renderAt("c1")

      fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }))
      expect(screen.queryByLabelText("Tema de la nivelación")).toBeNull()

      unmount()
      renderAt("c1")
      await screen.findByText("La astronomía estudia los cuerpos celestes.")
      expect(screen.queryByLabelText("Tema de la nivelación")).toBeNull()
    })

    it("«ponme un quiz» (offer_quiz) en un chat con documento: práctica sobre el documento", async () => {
      const calls = quizServer({ payload: { intent: "quiz", offer_quiz: true }, documentId: "d1" })
      renderAt("c1")

      expect(await screen.findByText(/Cuestionario sobre tu documento/)).toBeTruthy()
      fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
      await answerAll("tres")

      expect(await screen.findByText("5 de 5")).toBeTruthy()
      expect(calls.practice[0]).toMatch(/\/chats\/c1\/quiz\?num_questions=5$/)
      expect(calls.attempts).toBe(1)
      expect(calls.streamed).toEqual([])
    })

    it("«ponme un quiz de fracciones» sin documento: práctica sobre el tema, sin tocar el nivel", async () => {
      const calls = quizServer({ payload: { intent: "quiz", offer_quiz: true, topic_hint: "fracciones" } })
      renderAt("c1")

      expect(await screen.findByText(/Cuestionario sobre/)).toBeTruthy()
      fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
      expect(await screen.findByText("Práctica · Fracciones")).toBeTruthy()
      await answerAll("tres")

      expect(await screen.findByText("5 de 5")).toBeTruthy()
      expect(calls.topicPractice).toEqual([{ topic: "fracciones", num_questions: 5 }])
      expect(calls.diagnostics).toEqual([])
    })

    it("si la IA falla al preparar el quiz, muestra el motivo y deja reintentar", async () => {
      const calls = quizServer({ payload: { intent: "quiz", offer_quiz: true, topic_hint: "fracciones" }, practiceFailures: 1 })
      renderAt("c1")

      fireEvent.click(await screen.findByRole("button", { name: "Empezar" }))
      expect(await screen.findByText("El servicio de IA está recibiendo muchas peticiones ahora mismo.")).toBeTruthy()

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
      expect(await screen.findByText("Práctica · Fracciones")).toBeTruthy()
      expect(calls.topicPractice).toEqual([{ topic: "fracciones", num_questions: 5 }])
    })

    it("sin offer_quiz no se abre nada, aunque la intención sea quiz", async () => {
      quizServer({ payload: { intent: "quiz" }, documentId: "d1" })
      renderAt("c1")

      await screen.findByText("La astronomía estudia los cuerpos celestes.")
      expect(screen.queryByText(/Cuestionario sobre/)).toBeNull()
    })

    it("«ponme un quiz» sin tema ni documento: no se abre nada (el tutor pregunta el tema)", async () => {
      quizServer({ payload: { intent: "quiz", offer_quiz: true } })
      renderAt("c1")

      await screen.findByText("La astronomía estudia los cuerpos celestes.")
      expect(screen.queryByText(/Cuestionario sobre/)).toBeNull()
    })
  })

  it("un chat con un primer mensaje en cola (la clase tras nivelarse) lo envía solo, tras cargar el chat", async () => {
    const sse = controllableSSE()
    const order: string[] = []
    let sent: { role: string; content: string } | null = null
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [{ id: "c9", title: "Clase: ecuaciones lineales" }] })
      if (url.endsWith("/chats/c9")) {
        order.push("cargar chat")
        return json({ id: "c9", title: "Clase: ecuaciones lineales", messages: [] })
      }
      if (url.endsWith("/chats/c9/stream")) {
        order.push("enviar")
        sent = JSON.parse(String(init?.body))
        return sse.fetchMock(url, init)
      }
      throw new Error(`Petición inesperada: ${url}`)
    })
    // Lo que hace la nivelación antes de abrir el chat
    function Queue() {
      const { queueFirstMessage } = useChat()
      const [queued, setQueued] = useState(false)
      if (!queued) {
        queueFirstMessage("c9", "Empecemos la clase de ecuaciones lineales.")
        setQueued(true)
      }
      return queued ? <ChatScreen /> : null
    }
    nav.params = { id: "c9" }
    render(
      <AuthProvider>
        <ChatProvider>
          <Queue />
        </ChatProvider>
      </AuthProvider>,
    )

    expect(await screen.findByText("Empecemos la clase de ecuaciones lineales.")).toBeTruthy()
    sse.push(tokenEvent("Una ecuación lineal"))
    expect(await screen.findByText("Una ecuación lineal")).toBeTruthy()
    expect(sent).toEqual({ role: "user", content: "Empecemos la clase de ecuaciones lineales." })
    // Primero se carga el chat y después se envía: si no, la carga pisaría la respuesta
    expect(order).toEqual(["cargar chat", "enviar"])
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

    const note = await screen.findByText("Subí el archivo: tema1.txt")
    expect(sent).toEqual([{ role: "system", content: "📎 Subí el archivo: tema1.txt" }])
    // Una línea de aviso, no una burbuja del tutor
    expect(note.tagName).toBe("P")
  })

  it("un archivo de más de 25 MB se rechaza antes de subirlo", async () => {
    const requests: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      requests.push(url)
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/chats/c1")) return json({ id: "c1", title: "t", messages: [{ role: "user", content: "Hola" }] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    const toastError = vi.spyOn(toast, "error")
    const { container } = renderAt("c1")
    await screen.findByText("Hola")

    const big = new File(["x"], "libro.pdf", { type: "application/pdf" })
    Object.defineProperty(big, "size", { value: 25 * 1024 * 1024 + 1 })
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [big] } })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("El archivo es demasiado grande", { description: "El máximo es 25 MB." }))
    expect(requests.some((u) => u.includes("/documents"))).toBe(false)
    toastError.mockRestore()
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

  describe("voz del tutor", () => {
    const envelopeEvent = (data: unknown) => `event: envelope\ndata: ${JSON.stringify(data)}\n\n`
    const answer = "La derivada mide cómo cambia una función en cada punto. Se escribe f prima de x. ¿Seguimos?"

    beforeEach(() => {
      localStorage.clear()
      // Audio de mentira: «suena» y termina enseguida
      vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
        setTimeout(() => this.onended?.(new Event("ended")), 0)
        return Promise.resolve()
      })
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
      URL.createObjectURL = vi.fn(() => "blob:audio")
      URL.revokeObjectURL = vi.fn()
    })
    afterEach(() => vi.restoreAllMocks())

    function voiceServer({ enabled = true, sse }: { enabled?: boolean; sse?: ReturnType<typeof controllableSSE> } = {}) {
      const spoken: { text: string; emotion: string }[] = []
      let answered = false
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET"
        if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
        if (url.endsWith("/chats/")) return json({ chats: [{ id: "c1", title: "Derivadas" }] })
        if (url.endsWith("/documents/")) return json([])
        if (url.endsWith("/speech/config")) return enabled ? json({ enabled: true, max_chars: 1200 }) : json({ detail: "Not Found" }, 404)
        if (url.endsWith("/speech") && method === "POST") {
          spoken.push(JSON.parse(String(init?.body)))
          return new Response(new Blob(["mp3"], { type: "audio/mpeg" }), { status: 200 })
        }
        if (url.endsWith("/chats/c1/stream") && sse) {
          answered = true
          return sse.fetchMock(url, init)
        }
        if (url.endsWith("/chats/c1"))
          return json({
            id: "c1", title: "Derivadas",
            messages: sse && !answered
              ? [{ role: "user", content: "Hola" }, { role: "assistant", content: "Hola, ¿qué quieres aprender hoy?" }]
              : [{ role: "user", content: "Explícame la derivada" }, { role: "assistant", content: answer, metadata: { type: "answer", emotion: "patient", payload: { content: answer } } }],
          })
        throw new Error(`Petición inesperada: ${method} ${url}`)
      })
      return spoken
    }

    it("con «Leer en voz», lee cada frase según llega, en orden, y la última con la emoción del tutor", async () => {
      localStorage.setItem("laria_voz", "voice")
      const sse = controllableSSE()
      const spoken = voiceServer({ sse })
      renderAt("c1")
      await screen.findByText("Hola, ¿qué quieres aprender hoy?")
      expect(await screen.findByRole("button", { name: "Leer en voz: activado" })).toBeTruthy()

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "Explícame la derivada" } })
      fireEvent.keyDown(input, { key: "Enter" })

      sse.push(tokenEvent("La derivada mide cómo cambia una función en cada punto. Se escr"))
      // La primera frase suena mientras el tutor sigue escribiendo
      await waitFor(() => expect(spoken).toEqual([{ text: "La derivada mide cómo cambia una función en cada punto.", emotion: "encouraging" }]))

      sse.push(tokenEvent("ibe f prima de x. ¿Seguimos?"))
      sse.push(envelopeEvent({ type: "answer", emotion: "calm", payload: { content: answer } }))
      sse.push(doneEvent())
      sse.close()

      // La frase corta espera a la siguiente y sale con la emoción del envelope
      await waitFor(() => expect(spoken[1]).toEqual({ text: "Se escribe f prima de x. ¿Seguimos?", emotion: "calm" }))
      expect(spoken).toHaveLength(2)
    })

    it("por defecto solo texto: no pide audio; «Escuchar» lo lee y la segunda vez sale de memoria", async () => {
      const spoken = voiceServer()
      renderAt("c1")
      await screen.findByText(answer)
      const toggle = await screen.findByRole("button", { name: "Leer en voz: desactivado (solo texto)" })
      expect(toggle.textContent).toContain("Solo texto")
      expect(spoken).toEqual([])

      fireEvent.click(screen.getByRole("button", { name: "Escuchar respuesta" }))
      await waitFor(() =>
        expect(spoken).toEqual([
          { text: "La derivada mide cómo cambia una función en cada punto.", emotion: "patient" },
          { text: "Se escribe f prima de x. ¿Seguimos?", emotion: "patient" },
        ]),
      )
      // Al terminar, el botón vuelve a «Escuchar»
      const listen = await screen.findByRole("button", { name: "Escuchar respuesta" })

      fireEvent.click(listen)
      await screen.findByRole("button", { name: "Escuchar respuesta" })
      expect(spoken).toHaveLength(2)
    })

    it("elegir «Leer en voz» se recuerda", async () => {
      voiceServer()
      renderAt("c1")
      fireEvent.click(await screen.findByRole("button", { name: "Leer en voz: desactivado (solo texto)" }))
      expect(await screen.findByRole("button", { name: "Leer en voz: activado" })).toBeTruthy()
      expect(localStorage.getItem("laria_voz")).toBe("voice")
    })

    it("sin voz en el backend no hay conmutador ni «Escuchar»", async () => {
      voiceServer({ enabled: false })
      renderAt("c1")
      await screen.findByText(answer)
      expect(screen.queryByRole("button", { name: /Leer en voz/ })).toBeNull()
      expect(screen.queryByRole("button", { name: "Escuchar respuesta" })).toBeNull()
    })
  })
})
