import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import QuizPage from "./page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("chat=c1"),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/quiz",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const quiz = {
  id: "q1", document_id: "d1", total_points: 1, created_at: "",
  questions: [{ index: 0, text: "¿Dónde ocurre la fotosíntesis?", options: { A: "Mitocondria", B: "Cloroplasto" }, difficulty: "easy" }],
}

// Con las abiertas activas el backend arma el quiz con la mezcla (ADR-053), no con el número
function stub(openEnabled: boolean) {
  const generated: { url: string; body?: string }[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [{ id: "c1", title: "Fotosíntesis", document_id: "d1" }] })
    if (url.endsWith("/learning/me/preferences"))
      return json({ explanation_style: null, open_questions_enabled: openEnabled, assessment: { open_questions: 1, choice_questions: 4 } })
    if (url.includes("/chats/c1/quiz?")) {
      generated.push({ url, body: init?.body ? String(init.body) : undefined })
      return json(quiz)
    }
    return json({ detail: "Not Found" }, 404)
  })
  return generated
}

const page = () =>
  render(
    <AuthProvider>
      <ChatProvider>
        <QuizPage />
      </ChatProvider>
    </AuthProvider>,
  )

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("Quiz de un documento con preguntas abiertas", () => {
  it("se elige la mezcla (partiendo de la del perfil) y se manda como assessment", async () => {
    const generated = stub(true)
    page()
    await screen.findByRole("group", { name: "Para escribir" })
    expect(screen.queryByText("Rápido · ~3 min")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Una más para escribir" }))
    fireEvent.click(await screen.findByRole("button", { name: /Empezar quiz/ }))
    await screen.findByText("¿Dónde ocurre la fotosíntesis?")
    expect(generated).toHaveLength(1)
    expect(JSON.parse(generated[0].body!)).toEqual({ assessment: { open_questions: 2, choice_questions: 4 } })
    expect(generated[0].url).toMatch(/num_questions=6/)
  })

  it("sin las abiertas, el número de preguntas de siempre y sin body", async () => {
    const generated = stub(false)
    page()
    fireEvent.click(await screen.findByRole("button", { name: /Empezar quiz/ }))
    await screen.findByText("¿Dónde ocurre la fotosíntesis?")
    expect(screen.queryByRole("group", { name: "Para escribir" })).toBeNull()
    expect(generated[0].body).toBeUndefined()
    expect(generated[0].url).toMatch(/num_questions=5/)
  })
})
