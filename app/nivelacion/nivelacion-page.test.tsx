import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import PlacementPage from "./page"
import { setAuthToken, type PlacementResult } from "@/lib/laria-api"

const nav = vi.hoisted(() => ({ search: "", push: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: vi.fn(), push: nav.push }),
  usePathname: () => "/nivelacion",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// Una ronda como las del backend: índices desde 0, tema canónico y la
// respuesta correcta repartida entre letras (nunca siempre "A")
function round(id: string, count: number) {
  return {
    id,
    document_id: null,
    topic: "ecuaciones lineales",
    total_points: count * 10,
    created_at: "",
    questions: Array.from({ length: count }, (_, i) => ({
      index: i,
      text: `Pregunta ${id}-${i}`,
      options: { A: "uno", B: "dos", C: "tres", D: "cuatro" },
      difficulty: i < 4 ? "easy" : "medium",
    })),
  }
}

// Servidor de nivelación: sirve las rondas en orden y responde con el veredicto de cada una
function stubServer(verdicts: PlacementResult[]) {
  const diagnostics: string[] = []
  const attempts: Record<string, string>[] = []
  const createdChats: string[] = []
  let served = 0
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/") && method === "POST") {
      createdChats.push(JSON.parse(String(init?.body)).title)
      return json({ id: "c9", title: "Clase" }, 201)
    }
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/quizzes/diagnostic") && method === "POST") {
      diagnostics.push(JSON.parse(String(init?.body)).topic)
      served++
      return json(served === 1 ? round("base", 6) : round("avanzada", 8), 201)
    }
    const attempt = url.match(/\/quizzes\/(\w+)\/attempts$/)
    if (attempt && method === "POST") {
      const { answers } = JSON.parse(String(init?.body))
      attempts.push(answers)
      const total = Object.keys(answers).length
      return json({
        attempt_id: `a${attempts.length}`, quiz_id: attempt[1], document_id: null, score: 30, total_points: total * 10, completed_at: "",
        questions: Object.entries(answers).map(([index, selected]) => ({
          index: Number(index), text: `Pregunta ${attempt[1]}-${index}`, selected, correct_answer: "C", is_correct: selected === "C",
        })),
        placement: verdicts[attempts.length - 1],
      })
    }
    throw new Error(`Petición inesperada: ${method} ${url}`)
  })
  return { diagnostics, attempts, createdChats }
}

// Responde todas las preguntas de la ronda con la misma opción y la envía.
// Por texto y no por rol: getByRole recorre el árbol de accesibilidad de toda la
// página en cada búsqueda y, con 14 preguntas, el test se pasaba de tiempo
const OPTION_TEXT: Record<string, string> = { A: "uno", B: "dos", C: "tres", D: "cuatro" }
async function answerRound(letter: string) {
  await screen.findByText(/^Pregunta 1 de/)
  for (;;) {
    fireEvent.click(screen.getByText(OPTION_TEXT[letter]))
    const finish = screen.queryByText("Finalizar")
    if (finish) {
      fireEvent.click(finish)
      return
    }
    fireEvent.click(screen.getByText("Siguiente"))
  }
}

function renderPage(search: string) {
  nav.search = search
  return render(
    <AuthProvider>
      <ChatProvider>
        <PlacementPage />
      </ChatProvider>
    </AuthProvider>,
  )
}

const base = (passed: boolean, level: PlacementResult["level"]): PlacementResult => ({
  topic: "ecuaciones lineales", round: "base", level, passed, has_next_round: passed,
})

beforeEach(() => {
  setAuthToken("token")
  nav.push.mockReset()
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("Nivelación", () => {
  it("si supera la base, ofrece la avanzada con el mismo tema y termina con el nivel", async () => {
    const server = stubServer([
      base(true, "intermedio"),
      { topic: "ecuaciones lineales", round: "avanzada", level: "avanzado", passed: true, has_next_round: false },
    ])
    renderPage("tema=ecuaciones&chat=c1")

    fireEvent.click(await screen.findByRole("button", { name: "Empezar" }))
    // Se muestra el nombre canónico del tema, no lo que se escribió
    expect(await screen.findByText("ecuaciones lineales")).toBeTruthy()
    await answerRound("C")

    expect(await screen.findByText("La base de ecuaciones lineales, superada")).toBeTruthy()
    expect(screen.getByText("Acertaste 6 de 6")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }))
    await answerRound("C")

    // Después de la última ronda: pasos reales y la clase en un chat nuevo
    expect(await screen.findByText("Preparando tu clase de ecuaciones lineales")).toBeTruthy()
    expect(await screen.findByText("Ajustando la clase a tu nivel (avanzado)")).toBeTruthy()
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/chat/c9"))
    expect(server.createdChats).toEqual(["Clase: ecuaciones lineales"])
    // La segunda ronda se pide con el mismo tema (el canónico) y sin decir cuál toca
    expect(server.diagnostics).toEqual(["ecuaciones", "ecuaciones lineales"])
    // Respuestas por índice, empezando en 0
    expect(Object.keys(server.attempts[0])).toEqual(["0", "1", "2", "3", "4", "5"])
    expect(Object.keys(server.attempts[1])).toHaveLength(8)
  })

  it("si no supera la base, empieza la clase en básico, sin tono de suspenso ni otra ronda", async () => {
    const server = stubServer([base(false, "basico")])
    renderPage("tema=ecuaciones")

    fireEvent.click(await screen.findByRole("button", { name: "Empezar" }))
    await answerRound("A")

    expect(await screen.findByText("Empezamos por lo básico")).toBeTruthy()
    expect(screen.getByText("Ajustando la clase a tu nivel (básico)")).toBeTruthy()
    expect(screen.queryByText(/suspend|reprob/i)).toBeNull()
    expect(screen.queryByRole("button", { name: "Seguir" })).toBeNull()
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/chat/c9"))
    expect(server.diagnostics).toHaveLength(1)
  })

  it("«Lo dejo aquí» tras la base empieza la clase con el nivel que ya dio el backend", async () => {
    const server = stubServer([base(true, "intermedio")])
    renderPage("tema=ecuaciones")

    fireEvent.click(await screen.findByRole("button", { name: "Empezar" }))
    await answerRound("C")
    fireEvent.click(await screen.findByRole("button", { name: "Lo dejo aquí y empiezo la clase" }))

    expect(await screen.findByText("Tienes la base")).toBeTruthy()
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/chat/c9"))
    expect(server.diagnostics).toHaveLength(1)
  })

  it("sin tema en la URL pide escribirlo antes de empezar", async () => {
    stubServer([])
    renderPage("")

    const start = await screen.findByRole("button", { name: "Empezar" })
    expect((start as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Tema"), { target: { value: "derivadas" } })
    expect((start as HTMLButtonElement).disabled).toBe(false)
  })

  it("si el backend no puede preparar la ronda, lo dice y deja reintentar", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/quizzes/diagnostic")) return json({ detail: "Demasiadas solicitudes. Intenta de nuevo más tarde." }, 429)
      throw new Error(`Petición inesperada: ${url}`)
    })
    renderPage("tema=ecuaciones")

    fireEvent.click(await screen.findByRole("button", { name: "Empezar" }))

    expect((await screen.findByRole("alert")).textContent).toBe("Demasiadas solicitudes. Intenta de nuevo más tarde.")
    expect(screen.getByRole("button", { name: "Empezar" })).toBeTruthy()
  })
})
