import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import PerfilPage from "./page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/perfil",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("PerfilPage", () => {
  it("si no se pueden cargar los datos de aprendizaje, lo dice y permite reintentar", async () => {
    let learningUp = false
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json([])
      if (url.includes("/learning/")) {
        if (!learningUp) return json({ detail: "Error interno" }, 500)
        if (url.endsWith("/profile"))
          return json({ student_id: "u1", pace: "normal", total_attempts: 3, total_struggle_signals: 0, frequent_errors: [], updated_at: "", learning_velocity: 0, pedagogical_memory: null, mastery_by_document: [], mastery_by_concept: [] })
        return json({ attempts: [], tutor_interactions: [], recommendations: [] })
      }
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(
      <AuthProvider>
        <ChatProvider>
          <PerfilPage />
        </ChatProvider>
      </AuthProvider>,
    )

    expect(await screen.findByText("No se pudo cargar tu perfil de aprendizaje")).toBeTruthy()
    expect(screen.queryByText("0%")).toBeNull()

    learningUp = true
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("3 intentos de quiz completados")).toBeTruthy()
  })
})
