import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import PruebaDePasoPage from "./[pathId]/prueba-de-paso/page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clase/p1/prueba-de-paso",
  useParams: () => ({ pathId: "p1" }),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

const quiz = {
  id: "pp1", document_id: null, topic: "ecuaciones", total_points: 20, created_at: "",
  questions: [
    { index: 0, text: "¿Qué es despejar?", options: { A: "Aislar la incógnita", B: "Sumar" }, difficulty: "medium" },
    { index: 1, text: "¿Cuánto vale x en 2x = 6?", options: { A: "3", B: "12" }, difficulty: "medium" },
  ],
}

function stubServer({ level, passageStatus = 201 }: { level?: string; passageStatus?: number } = {}) {
  const calls: string[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    calls.push(`${method} ${url.replace(/^.*\/api\/v1|^https?:\/\/[^/]+/, "")}`)
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/learning/paths/p1")) return json({ id: "p1", title: "Ecuaciones", topic: "ecuaciones", modules: [], tiers: ["basico"], next_tier: "intermedio", teaching: { phase: "completed" } })
    if (url.endsWith("/learning/paths/p1/passage-test") && method === "POST") {
      return passageStatus === 201 ? json(quiz, 201) : json({ detail: "Sin prueba pendiente" }, passageStatus)
    }
    if (url.endsWith("/quizzes/pp1/attempts") && method === "POST") {
      return json({
        attempt_id: "a1", quiz_id: "pp1", score: 20, total_points: 20, completed_at: "",
        questions: [
          { index: 0, text: "…", selected: "A", correct_answer: "A", is_correct: true },
          { index: 1, text: "…", selected: "A", correct_answer: "A", is_correct: true },
        ],
        placement: { topic: "ecuaciones", round: "base", level, passed: level === "intermedio", has_next_round: false },
      })
    }
    throw new Error(`Petición inesperada: ${method} ${url}`)
  })
  return calls
}

function renderPage() {
  return render(
    <AuthProvider>
      <ChatProvider>
        <PruebaDePasoPage />
      </ChatProvider>
    </AuthProvider>,
  )
}

async function answerAll() {
  fireEvent.click(await screen.findByText("Aislar la incógnita"))
  fireEvent.click(screen.getByText("Siguiente"))
  fireEvent.click(await screen.findByText("3"))
  fireEvent.click(screen.getByText("Finalizar"))
}

describe("Prueba de paso", () => {
  it("pide las preguntas de ESTA ruta (sin tema que escribir) y, si aprueba, vuelve a la misma clase sin crear rutas", async () => {
    const calls = stubServer({ level: "intermedio" })
    renderPage()

    expect(await screen.findByRole("heading", { name: "Para abrir el tramo intermedio" })).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
    await answerAll()

    expect(await screen.findByRole("heading", { name: "¡Tramo intermedio abierto!" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Empezar el tramo nuevo" }).getAttribute("href")).toBe("/clase/p1")
    expect(calls).toContain("POST /learning/paths/p1/passage-test")
    expect(calls.some((c) => c.includes("/from-topic") || c.includes("/quizzes/diagnostic"))).toBe(false)
  })

  it("si no sube de nivel, lo dice sin dramatismo y vuelve a la clase (que puede proponer un repaso)", async () => {
    stubServer({ level: "basico" })
    renderPage()

    await answerAll()

    expect(await screen.findByRole("heading", { name: "Todavía no" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Volver a la clase" }).getAttribute("href")).toBe("/clase/p1")
  })

  it("sin prueba pendiente (409) lo explica y solo deja volver a la clase", async () => {
    stubServer({ passageStatus: 409 })
    renderPage()

    expect(await screen.findByText("Esta ruta no tiene ninguna prueba de paso pendiente.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
    await waitFor(() => expect(screen.getByRole("link", { name: "Volver a la clase" }).getAttribute("href")).toBe("/clase/p1"))
  })

  it("si falla la IA (502), deja reintentar", async () => {
    stubServer({ passageStatus: 502 })
    renderPage()

    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeTruthy()
  })
})
