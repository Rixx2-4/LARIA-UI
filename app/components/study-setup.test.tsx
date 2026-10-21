import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import ClasePage from "@/app/clase/[pathId]/page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clase/p1",
  useParams: () => ({ pathId: "p1" }),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const path = (study: { study_method?: string | null; study_pace?: string | null } = {}, pending: string | null = null) => ({
  id: "p1", topic: "fracciones", title: "Fracciones", ...study,
  modules: [{ title: "Fracciones equivalentes", concept: "equivalentes", kind: "content", status: "in_progress", mastery: 0, position: 0 }],
  teaching: {
    phase: "check", concept: "equivalentes", concept_title: "Fracciones equivalentes", return_to: null, return_to_title: null,
    variant: null, pending_check_quiz_id: pending, last_outcome: null, passed_concepts: [], reason: null,
  },
})
// Forma del contrato (ADR-055), con los textos que escribe el backend
const catalog = {
  methods: [
    { key: "active_recall", name: "Recuerdo activo", summary: "Recordar sin mirar.", good_for: "Retener.", available: true, unavailable_reason: null, unavailable_text: null, recommended: false, recommended_text: null },
    { key: "worked_examples", name: "Ejemplos resueltos", summary: "Ver un ejemplo y completar pasos.", good_for: "Temas nuevos.", available: true, unavailable_reason: null, unavailable_text: null, recommended: true, recommended_text: "Recomendado en el tramo básico" },
    { key: "interleaving", name: "Intercalado", summary: "Mezclar con lo superado.", good_for: "Distinguir.", available: false, unavailable_reason: "needs_two_passed_concepts", unavailable_text: "Se abre cuando superes dos conceptos de esta ruta", recommended: false, recommended_text: null },
  ],
  paces: [
    { key: "free", name: "Libre", focus_minutes: null, break_minutes: null },
    { key: "pomodoro_25_5", name: "Pomodoro 25/5", focus_minutes: 25, break_minutes: 5 },
  ],
  default_method: null,
  default_pace: "free",
}
const check = { id: "q1", document_id: null, questions: [{ index: 0, text: "¿Son equivalentes 1/2 y 2/4?", options: { A: "Sí", B: "No" }, difficulty: "easy" }] }

function stub({ study = {}, lessonError }: { study?: Parameters<typeof path>[0]; lessonError?: Response } = {}) {
  const lessons: unknown[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/learning/me/preferences"))
      return json({ explanation_style: null, open_questions_enabled: false, study_methods_enabled: true, study_method: null, study_pace: "free" })
    if (url.endsWith("/learning/study-methods?path_id=p1")) return json(catalog)
    if (url.endsWith("/learning/paths/p1")) return json(path(study))
    if (url.endsWith("/learning/paths/p1/lesson") && method === "POST") {
      lessons.push(JSON.parse(String(init?.body)))
      if (lessonError && lessons.length === 1) return lessonError
      return json({ path: path(study, "q1"), markdown: "Dos fracciones son **equivalentes** si valen lo mismo.", check })
    }
    return json({ detail: "Not Found" }, 404)
  })
  return lessons
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

describe("Antes de empezar: método y ritmo", () => {
  it("el recomendado se señala sin marcarlo, el no disponible se ve con su motivo y lo elegido va a la lección", async () => {
    const lessons = stub()
    page()
    await screen.findByRole("group", { name: "Método de estudio" })
    expect((screen.getByRole("radio", { name: /Que decida LARIA/ }) as HTMLInputElement).checked).toBe(true)
    const recommended = screen.getByRole("radio", { name: /Ejemplos resueltos/ }) as HTMLInputElement
    expect(recommended.checked).toBe(false)
    expect(screen.getByText("Recomendado en el tramo básico")).toBeTruthy()
    expect((screen.getByRole("radio", { name: /Intercalado/ }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText("Se abre cuando superes dos conceptos de esta ruta")).toBeTruthy()
    expect(screen.getByText(/Se guarda para esta clase/)).toBeTruthy()
    // Sin las abiertas no hay mezcla que elegir
    expect(screen.queryByRole("group", { name: "Para escribir" })).toBeNull()

    fireEvent.click(screen.getByRole("radio", { name: /Recuerdo activo/ }))
    fireEvent.click(screen.getByRole("radio", { name: /Pomodoro 25\/5/ }))
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    await screen.findByText("Comprueba lo que has aprendido")
    expect(lessons).toEqual([{ study_method: "active_recall", study_pace: "pomodoro_25_5" }])
  })

  it("se abre con lo que ya tiene la ruta", async () => {
    stub({ study: { study_method: "worked_examples", study_pace: "pomodoro_25_5" } })
    page()
    expect(((await screen.findByRole("radio", { name: /Ejemplos resueltos/ })) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole("radio", { name: /Pomodoro 25\/5/ }) as HTMLInputElement).checked).toBe(true)
  })

  it("si el método ya no está disponible, vuelve a elegir con el motivo", async () => {
    const lessons = stub({
      lessonError: json({ detail: "Ese método necesita las preguntas escritas.", reason: "study_method_unavailable" }, 422),
    })
    page()
    fireEvent.click(await screen.findByRole("radio", { name: /Recuerdo activo/ }))
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/necesita las preguntas escritas/)
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    await screen.findByText("Comprueba lo que has aprendido")
    expect(lessons).toHaveLength(2)
  })
})
