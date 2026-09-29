import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
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

  it("sin actividad todavía, invita a hacer el primer quiz en lugar de mostrar un 0%", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json([])
      if (url.endsWith("/profile"))
        return json({ student_id: "u1", pace: "normal", total_attempts: 0, total_struggle_signals: 0, frequent_errors: [], updated_at: "", learning_velocity: 0, pedagogical_memory: null, mastery_by_document: [], mastery_by_concept: [] })
      if (url.endsWith("/learning/me")) return json({ attempts: [], tutor_interactions: [], recommendations: [] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(
      <AuthProvider>
        <ChatProvider>
          <PerfilPage />
        </ChatProvider>
      </AuthProvider>,
    )

    expect(await screen.findByText("Aún no hay actividad de aprendizaje")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Hacer un quiz" }).getAttribute("href")).toBe("/quiz")
    // El ritmo "normal" por defecto no es un nivel medido
    expect(screen.getByText("Sin actividad todavía")).toBeTruthy()
    expect(screen.queryByText(/Nivel:/)).toBeNull()
  })

  it("si falla la lista de documentos, lo avisa sin ocultar el resto del perfil", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json({ detail: "Error" }, 500)
      if (url.endsWith("/profile"))
        return json({ student_id: "u1", pace: "normal", total_attempts: 3, total_struggle_signals: 0, frequent_errors: [], updated_at: "", learning_velocity: 0, pedagogical_memory: null, mastery_by_document: [], mastery_by_concept: [] })
      if (url.endsWith("/learning/me")) return json({ attempts: [], tutor_interactions: [], recommendations: [] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(
      <AuthProvider>
        <ChatProvider>
          <PerfilPage />
        </ChatProvider>
      </AuthProvider>,
    )

    expect(await screen.findByText("3 intentos de quiz completados")).toBeTruthy()
    expect(screen.getByText("No se pudieron cargar tus documentos")).toBeTruthy()
  })

  it("muestra el nivel por tema con su nombre, y la clave si la nivelación es antigua", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json([])
      if (url.endsWith("/profile"))
        return json({
          student_id: "u1", pace: "normal", total_attempts: 2, total_struggle_signals: 0, frequent_errors: [], updated_at: "",
          learning_velocity: 0, pedagogical_memory: null, mastery_by_document: [], mastery_by_concept: [],
          level_by_topic: { electronica: "intermedio", derivadas: "basico" },
          topic_labels: { electronica: "Electrónica" },
        })
      if (url.endsWith("/learning/me")) return json({ attempts: [], tutor_interactions: [], recommendations: [] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(
      <AuthProvider>
        <ChatProvider>
          <PerfilPage />
        </ChatProvider>
      </AuthProvider>,
    )

    const section = await screen.findByRole("region", { name: "Tu nivel por tema" })
    expect(section.textContent).toContain("Electrónica · intermedio")
    expect(section.textContent).toContain("derivadas · básico")
    expect(section.textContent).not.toContain("electronica")
  })

  it("deja elegir cómo prefiere que le expliquen y lo guarda al tocar", async () => {
    const saved: unknown[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json([])
      if (url.endsWith("/learning/me/preferences") && init?.method === "PUT") {
        saved.push(JSON.parse(String(init.body)))
        return json(JSON.parse(String(init.body)))
      }
      if (url.endsWith("/profile"))
        return json({
          student_id: "u1", pace: "normal", total_attempts: 1, total_struggle_signals: 0, frequent_errors: [], updated_at: "",
          learning_velocity: 0, pedagogical_memory: null, mastery_by_document: [], mastery_by_concept: [],
          explanation_style_choice: "analogy",
        })
      if (url.endsWith("/learning/me")) return json({ attempts: [], tutor_interactions: [], recommendations: [] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(
      <AuthProvider>
        <ChatProvider>
          <PerfilPage />
        </ChatProvider>
      </AuthProvider>,
    )

    const section = await screen.findByRole("region", { name: "Cómo prefieres que te explique" })
    expect(section.querySelector('[aria-pressed="true"]')?.textContent).toContain("Con ejemplos y analogías")
    fireEvent.click(screen.getByText("Con fórmulas"))
    await waitFor(() => expect(saved).toEqual([{ explanation_style: "mathematical" }]))
  })

  it("sin explanation_style_choice (backend antiguo) no muestra la sección", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/documents/")) return json([])
      if (url.endsWith("/profile"))
        return json({ student_id: "u1", pace: "normal", total_attempts: 1, total_struggle_signals: 0, frequent_errors: [], updated_at: "", learning_velocity: 0, pedagogical_memory: null, mastery_by_document: [], mastery_by_concept: [] })
      if (url.endsWith("/learning/me")) return json({ attempts: [], tutor_interactions: [], recommendations: [] })
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(
      <AuthProvider>
        <ChatProvider>
          <PerfilPage />
        </ChatProvider>
      </AuthProvider>,
    )

    await screen.findByText(/intentos de quiz completados/)
    expect(screen.queryByRole("region", { name: "Cómo prefieres que te explique" })).toBeNull()
  })
})
