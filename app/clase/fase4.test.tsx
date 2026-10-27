import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import ClasePage from "./[pathId]/page"
import { WorkedExample } from "./worked-example"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clase/p1",
  useParams: () => ({ pathId: "p1" }),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const path = {
  id: "p1", topic: "fracciones", title: "Fracciones", study_method: "active_recall", study_pace: "free",
  modules: [{ title: "Fracciones equivalentes", concept: "equivalentes", kind: "content", status: "in_progress", mastery: 0, position: 1 }],
  teaching: {
    phase: "check", concept: "equivalentes", concept_title: "Fracciones equivalentes", return_to: null, return_to_title: null,
    variant: null, pending_check_quiz_id: "q1", last_outcome: null, passed_concepts: ["fraccion"], reason: "", study_method: "active_recall",
  },
}
// Forma de la captura real de la fase 4 (recuerdo activo): la previa es de un concepto ya superado
const check = {
  id: "q1", document_id: null,
  questions: [
    { index: 0, text: "¿Qué es una fracción?", options: { A: "Una parte de un todo", B: "Un número negativo" }, difficulty: "easy", position: "before", concept_title: "Qué es una fracción" },
    { index: 1, text: "¿Son equivalentes 1/2 y 2/4?", options: { A: "Sí", B: "No" }, difficulty: "easy", position: "after", concept_title: null },
  ],
}

function stub() {
  const checks: unknown[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/learning/paths/p1/lesson") && method === "POST")
      return json({ path, markdown: "Dos fracciones son **equivalentes** si valen lo mismo.", check, worked_example: null })
    if (url.endsWith("/learning/paths/p1/check") && method === "POST") {
      checks.push(JSON.parse(String(init?.body)))
      return json({
        outcome: "understood", score: 2, total_points: 2,
        questions: [
          { index: 0, text: check.questions[0].text, selected: "A", correct_answer: "A", is_correct: true, concept_title: "Qué es una fracción" },
          { index: 1, text: check.questions[1].text, selected: "A", correct_answer: "A", is_correct: true, concept_title: null },
        ],
        next: { phase: "advance", concept: null, concept_title: null, variant: null, reason: null },
        path,
      })
    }
    return json({ detail: "Not Found" }, 404)
  })
  return checks
}

const page = () =>
  render(
    <AuthProvider>
      <ChatProvider>
        <ClasePage />
      </ChatProvider>
    </AuthProvider>,
  )

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("Fase 4: el método cambia la clase", () => {
  it("recuerdo activo: la previa va antes de la explicación, como repaso, y se envía con el resto en un solo intento", async () => {
    const checks = stub()
    page()
    const warmup = await screen.findByRole("region", { name: /recuerda sin mirar/ })
    expect(within(warmup).getByText("Repaso: Qué es una fracción")).toBeTruthy()
    // La explicación aún no se ve
    expect(screen.queryByText(/valen lo mismo/)).toBeNull()
    fireEvent.click(within(warmup).getByText("Una parte de un todo"))
    fireEvent.click(within(warmup).getByRole("button", { name: /Ver la explicación/ }))

    expect(await screen.findByText(/valen lo mismo/)).toBeTruthy()
    const checkSection = await screen.findByRole("region", { name: "Comprueba lo que has aprendido" }, { timeout: 8000 })
    expect(within(checkSection).getByText("Pregunta 1 de 1")).toBeTruthy()
    fireEvent.click(within(checkSection).getByText("Sí"))
    fireEvent.click(within(checkSection).getByRole("button", { name: /Finalizar/ }))

    await screen.findByText("¡Entendido!")
    expect(checks).toHaveLength(1)
    expect((checks[0] as { answers: Record<string, string> }).answers).toEqual({ "0": "A", "1": "A" })
    // En la corrección, la de repaso lo dice
    expect(screen.getByText("Repaso: Qué es una fracción")).toBeTruthy()
  }, 20000)
})

describe("WorkedExample", () => {
  const example = {
    steps: [
      { text: "Identificar cuántas porciones hay en total.", hidden: false },
      { text: "Contar cuántas porciones se han tomado.", hidden: false },
      { text: "Escribir la fracción: tomadas sobre el total.", hidden: true },
    ],
  }

  it("los pasos ocultos se intentan y se destapan, sin nota", () => {
    render(<WorkedExample example={example} />)
    expect(screen.getByText(/Falta el último paso/)).toBeTruthy()
    expect(screen.queryByText(/tomadas sobre el total/)).toBeNull()
    fireEvent.change(screen.getByLabelText("Tu paso 3"), { target: { value: "Pongo arriba las que tomé" } })
    fireEvent.click(screen.getByRole("button", { name: "Ver el paso 3" }))
    expect(screen.getByText(/tomadas sobre el total/)).toBeTruthy()
    expect(screen.getByText("Pongo arriba las que tomé")).toBeTruthy()
  })

  it("la primera vez en un concepto se ve entero", () => {
    render(<WorkedExample example={{ steps: example.steps.map((s) => ({ ...s, hidden: false })) }} />)
    expect(screen.getByText("Sigue el ejemplo paso a paso.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Ver el paso/ })).toBeNull()
  })
})
