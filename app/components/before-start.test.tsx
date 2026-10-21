import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import ClasePage from "@/app/clase/[pathId]/page"
import PruebaDePasoPage from "@/app/clase/[pathId]/prueba-de-paso/page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clase/p1",
  useParams: () => ({ pathId: "p1" }),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const teaching = (pending: string | null) => ({
  phase: "check", concept: "ecuacion", concept_title: "Qué es una ecuación", return_to: null, return_to_title: null,
  variant: null, pending_check_quiz_id: pending, last_outcome: null, passed_concepts: [], reason: null,
})
const path = (pending: string | null = null) => ({
  id: "p1", topic: "ecuaciones", title: "Ecuaciones", next_tier: "intermedio",
  modules: [{ title: "Qué es una ecuación", concept: "ecuacion", kind: "content", status: "in_progress", mastery: 0, position: 0 }],
  teaching: teaching(pending),
})
const quiz = {
  id: "q1", document_id: null, total_points: 10, created_at: "",
  questions: [{ index: 0, text: "¿Qué es una ecuación?", options: { A: "Una igualdad", B: "Un número" }, difficulty: "easy" }],
}

// Lo que pide la página; las preferencias dicen si hay abiertas y la mezcla de siempre
function stub({ openEnabled = true, pending = null as string | null } = {}) {
  const bodies: Record<string, unknown[]> = { lesson: [], passage: [] }
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/learning/me/preferences"))
      return json({ explanation_style: null, open_questions_enabled: openEnabled, assessment: { open_questions: 1, choice_questions: 4 } })
    if (url.endsWith("/learning/paths/p1")) return json(path(pending))
    if (url.endsWith("/learning/paths/p1/lesson") && method === "POST") {
      bodies.lesson.push(JSON.parse(String(init?.body)))
      return json({ path: path("q1"), markdown: "Una **ecuación** es una igualdad.", check: quiz })
    }
    if (url.endsWith("/learning/paths/p1/passage-test") && method === "POST") {
      bodies.passage.push(JSON.parse(String(init?.body)))
      return json(quiz)
    }
    return json({ detail: "Not Found" }, 404)
  })
  return bodies
}

const page = (Page: () => React.ReactNode) =>
  render(
    <AuthProvider>
      <ChatProvider>
        <Page />
      </ChatProvider>
    </AuthProvider>,
  )

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("Antes de empezar", () => {
  it("en la clase, parte de la mezcla de siempre y la elegida va en la lección", async () => {
    const bodies = stub()
    page(ClasePage)
    await screen.findByRole("heading", { name: "Antes de empezar" })
    expect(bodies.lesson).toHaveLength(0)
    const written = screen.getByRole("group", { name: "Para escribir" })
    expect(written.querySelector("output")?.textContent).toBe("1")
    fireEvent.click(screen.getByRole("button", { name: "Una más para escribir" }))
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    await screen.findByText("Comprueba lo que has aprendido")
    expect(bodies.lesson).toEqual([{ assessment: { open_questions: 2, choice_questions: 4 } }])
  })

  it("con una comprobación pendiente no pregunta: no cambiaría nada", async () => {
    const bodies = stub({ pending: "q1" })
    page(ClasePage)
    await screen.findByText("Comprueba lo que has aprendido")
    expect(screen.queryByRole("heading", { name: "Antes de empezar" })).toBeNull()
    expect(bodies.lesson).toEqual([{}])
  })

  it("sin las abiertas activas se empieza directamente, como siempre", async () => {
    const bodies = stub({ openEnabled: false })
    page(ClasePage)
    await screen.findByText("Comprueba lo que has aprendido")
    expect(screen.queryByRole("heading", { name: "Antes de empezar" })).toBeNull()
    expect(bodies.lesson).toEqual([{}])
  })

  it("en la prueba de paso, la mezcla elegida va al pedirla", async () => {
    const bodies = stub()
    page(PruebaDePasoPage)
    await screen.findByRole("heading", { name: "Antes de empezar" })
    fireEvent.click(screen.getByRole("button", { name: "Una menos de opción múltiple" }))
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    await screen.findByText("¿Qué es una ecuación?")
    expect(bodies.passage).toEqual([{ assessment: { open_questions: 1, choice_questions: 3 } }])
  })
})
