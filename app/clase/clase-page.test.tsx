import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import ClasePage from "./[pathId]/page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clase/p1",
  useParams: () => ({ pathId: "p1" }),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

const modules = (status: Record<string, string>) => [
  { title: "Fracciones", concept: "fracciones", kind: "prerequisite", status: status.fracciones ?? "assumed", mastery: 0, position: 0 },
  { title: "Qué es una ecuación", concept: "ecuacion", kind: "content", status: status.ecuacion ?? "in_progress", mastery: 0, position: 1 },
  { title: "Despejar la x", concept: "despejar", kind: "content", status: status.despejar ?? "locked", mastery: 0, position: 2 },
]

const path = (phase: string, concept: string | null, status: Record<string, string> = {}, reason: string | null = null) => ({
  id: "p1",
  topic: "ecuaciones lineales",
  title: "Ecuaciones lineales",
  modules: modules(status),
  teaching: {
    phase, concept, concept_title: concept === "ecuacion" ? "Qué es una ecuación" : concept === "despejar" ? "Despejar la x" : null,
    return_to: null, return_to_title: null, variant: null, pending_check_quiz_id: null, last_outcome: null, passed_concepts: [], reason,
  },
})

const check = (id: string) => ({
  id, document_id: null, total_points: 20, created_at: "",
  questions: [
    { index: 0, text: `${id}: ¿Qué es una ecuación?`, options: { A: "Una igualdad con incógnita", B: "Un número" }, difficulty: "easy" },
    { index: 1, text: `${id}: ¿Cuánto vale x en x + 1 = 3?`, options: { A: "2", B: "4" }, difficulty: "easy" },
  ],
})

// La ruta del backend: explica «ecuación»; si no se entiende, la explica de otra
// manera; luego «despejar»; y termina. Una comprobación pendiente se devuelve igual
function stubServer({ lessonError }: { lessonError?: Response } = {}) {
  const steps = [
    { path: path("check", "ecuacion"), markdown: "Una **ecuación** es una igualdad con una incógnita.\n\n**Ejemplo.** $x + 1 = 3$", check: check("q1") },
    { path: path("check", "ecuacion", {}, "Lo explico de otra manera, con una balanza."), markdown: "Piensa en una **balanza** en equilibrio.", check: check("q2") },
    { path: path("check", "despejar", { ecuacion: "completed", despejar: "in_progress" }), markdown: "Para **despejar**, haz lo mismo a los dos lados.", check: check("q3") },
  ]
  const outcomes = [
    { outcome: "not_understood", next: { phase: "remediation", concept: "ecuacion", concept_title: "Qué es una ecuación", variant: "analogy", reason: "Lo explico de otra manera…" } },
    { outcome: "understood", next: { phase: "advance", concept: "despejar", concept_title: "Despejar la x", variant: null, reason: "¡Bien! Pasamos a despejar la x." } },
    { outcome: "understood", next: { phase: "completed", concept: null, concept_title: null, variant: null, reason: "¡Ruta terminada!" } },
  ]
  const server = { step: 0, lessons: 0, checks: [] as unknown[] }
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/documents/")) return json([])
    if (url.endsWith("/speech/config")) return json({ detail: "Not Found" }, 404)
    if (url.endsWith("/learning/paths/p1")) return json(path("assessment", null))
    if (url.endsWith("/learning/paths/p1/lesson") && method === "POST") {
      server.lessons++
      if (lessonError) return lessonError.clone()
      if (server.step >= steps.length) return json({ path: path("completed", null, { ecuacion: "completed", despejar: "completed" }), markdown: null, check: null })
      return json(steps[server.step])
    }
    if (url.endsWith("/learning/paths/p1/check") && method === "POST") {
      const body = JSON.parse(String(init?.body))
      server.checks.push(body)
      const graded = outcomes[server.step]
      const correct = graded.outcome === "understood"
      server.step++
      return json({
        ...graded, score: correct ? 20 : 0, total_points: 20,
        questions: [
          { index: 0, text: "…", selected: body.answers["0"], correct_answer: "A", is_correct: body.answers["0"] === "A" },
          { index: 1, text: "…", selected: body.answers["1"], correct_answer: "A", is_correct: body.answers["1"] === "A" },
        ],
        path: path("teaching", graded.next.concept),
      })
    }
    throw new Error(`Petición inesperada: ${method} ${url}`)
  })
  return server
}

function renderPage() {
  return render(
    <AuthProvider>
      <ChatProvider>
        <ClasePage />
      </ChatProvider>
    </AuthProvider>,
  )
}

// Responde las dos preguntas de la comprobación con la misma letra
async function answerCheck(letter: "A" | "B", id: string) {
  await screen.findByText(`${id}: ¿Qué es una ecuación?`)
  fireEvent.click(screen.getByText(letter === "A" ? "Una igualdad con incógnita" : "Un número"))
  fireEvent.click(screen.getByText("Siguiente"))
  fireEvent.click(await screen.findByText(letter === "A" ? "2" : "4"))
  fireEvent.click(screen.getByText("Finalizar"))
}

describe("Clase guiada", () => {
  it("lección → comprobación → otra explicación → siguiente concepto → ruta completada", async () => {
    const server = stubServer()
    renderPage()

    // La ruta con el estado de cada módulo, y la lección del concepto actual
    expect(await screen.findByText("Una igualdad con una incógnita.", { exact: false })).toBeTruthy()
    expect(screen.getByRole("heading", { level: 1, name: "Qué es una ecuación" })).toBeTruthy()
    expect(screen.getByText("Se da por sabido · Repaso previo")).toBeTruthy()
    expect(screen.getByText("Tu ruta · 1 de 3")).toBeTruthy()

    // No lo entiende: ve qué falló y por qué se explica de otra manera
    await answerCheck("B", "q1")
    expect(await screen.findByText("Todavía no")).toBeTruthy()
    expect(screen.getByText("Acertaste 0 de 2.")).toBeTruthy()
    expect(screen.getByText("Lo explico de otra manera…")).toBeTruthy()
    expect(server.checks[0]).toEqual({ quiz_id: "q1", answers: { "0": "B", "1": "B" } })

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText("Lo explico de otra manera, con una balanza.")).toBeTruthy()
    await answerCheck("A", "q2")
    expect(await screen.findByText("¡Entendido!")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Despejar la x" })).toBeTruthy()
    await answerCheck("A", "q3")
    expect(await screen.findByText("¡Ruta terminada!")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByRole("heading", { name: "¡Ruta completada!" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Ir al chat" }).getAttribute("href")).toBe("/chat")
  })

  it("al recargar retoma la misma comprobación pendiente, sin perder el sitio", async () => {
    const server = stubServer()
    renderPage()
    await screen.findByText("q1: ¿Qué es una ecuación?")
    cleanup()

    renderPage()
    expect(await screen.findByText("q1: ¿Qué es una ecuación?")).toBeTruthy()
    expect(server.lessons).toBe(2)
    expect(server.checks).toEqual([])
  })

  it("sin nivelación del tema (409) lleva a hacerla", async () => {
    stubServer({ lessonError: json({ detail: "Primero haz la nivelación de «ecuaciones lineales»." }, 409) })
    renderPage()

    expect(await screen.findByText("Primero haz la nivelación de «ecuaciones lineales».")).toBeTruthy()
    const link = await screen.findByRole("link", { name: "Hacer la nivelación" })
    await waitFor(() => expect(link.getAttribute("href")).toBe("/nivelacion?tema=ecuaciones+lineales"))
  })

  it("si la lección no se pudo generar (502), deja reintentar", async () => {
    const server = stubServer({ lessonError: json({ detail: "El servicio de IA no respondió." }, 502) })
    renderPage()

    expect(await screen.findByText("El servicio de IA no respondió.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    await waitFor(() => expect(server.lessons).toBe(2))
  })
})

describe("Clase guiada: pizarra con la voz de LARIA", () => {
  const FIRST = "Una ecuación es una igualdad entre dos expresiones con una incógnita."
  const SECOND = "Resolverla es encontrar el valor de la x que hace cierta la igualdad."
  let playing: HTMLMediaElement | null = null

  beforeEach(() => {
    localStorage.setItem("laria_voz", "voice")
    playing = null
    // Audio de mentira: «suena» hasta que el test diga que terminó
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      if (!this.src.startsWith("data:")) playing = this
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => "blob:audio")
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  function voiceServer({ speechStatus = 200 } = {}) {
    const spoken: string[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json([])
      if (url.endsWith("/speech/config")) return json({ enabled: true, max_chars: 1200 })
      if (url.endsWith("/speech") && method === "POST") {
        spoken.push(JSON.parse(String(init?.body)).text)
        if (speechStatus !== 200) return json({ detail: "La voz no está disponible ahora." }, speechStatus)
        return new Response(new Blob(["mp3"], { type: "audio/mpeg" }))
      }
      if (url.endsWith("/learning/paths/p1/lesson")) return json({ path: path("check", "ecuacion"), markdown: `${FIRST} ${SECOND}`, check: check("q1") })
      throw new Error(`Petición inesperada: ${method} ${url}`)
    })
    return spoken
  }

  const finishAudio = () => act(() => playing?.onended?.(new Event("ended")))

  it("cada frase aparece al decirla LARIA y la comprobación llega al terminar", async () => {
    const spoken = voiceServer()
    renderPage()

    expect(await screen.findByText(FIRST)).toBeTruthy()
    expect(screen.getByRole("img", { name: "LARIA está explicando" })).toBeTruthy()
    expect(screen.queryByText(SECOND, { exact: false })).toBeNull()
    expect(screen.queryByText("q1: ¿Qué es una ecuación?")).toBeNull()

    await finishAudio()
    expect(await screen.findByText(SECOND, { exact: false })).toBeTruthy()
    expect(spoken).toEqual([FIRST, SECOND])
    expect(screen.queryByText("q1: ¿Qué es una ecuación?")).toBeNull()

    await finishAudio()
    expect(await screen.findByText("q1: ¿Qué es una ecuación?")).toBeTruthy()
    expect(screen.getByRole("img", { name: "LARIA" })).toBeTruthy()
  })

  it("«Mostrar todo» enseña la pizarra entera y la comprobación sin esperar a la voz", async () => {
    voiceServer()
    renderPage()

    await screen.findByText(FIRST)
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todo" }))
    expect(screen.getByText(SECOND, { exact: false })).toBeTruthy()
    expect(screen.getByText("q1: ¿Qué es una ecuación?")).toBeTruthy()
  })

  it("si la voz falla, la pizarra se ve entera igualmente", async () => {
    voiceServer({ speechStatus: 503 })
    renderPage()

    expect(await screen.findByText("q1: ¿Qué es una ecuación?")).toBeTruthy()
    expect(screen.getByText(FIRST, { exact: false })).toBeTruthy()
    expect(screen.getByText(SECOND, { exact: false })).toBeTruthy()
  })
})
