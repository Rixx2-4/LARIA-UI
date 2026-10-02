import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import ClasesPage from "./page"
import { setAuthToken } from "@/lib/laria-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/clases",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

const path = (id: string, title: string, phase: string, updated_at: string, extra: Record<string, unknown> = {}) => ({
  id, title, topic: title.toLowerCase(), subject: "", modules: [], progress: 0.5, created_at: "", updated_at,
  teaching: { phase, concept: null, concept_title: phase === "check" ? "Despejar la x" : null, return_to: null, return_to_title: null, variant: null, pending_check_quiz_id: null, last_outcome: null, passed_concepts: [], reason: null },
  ...extra,
})

function stubServer(paths: unknown[]) {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/documents/")) return json([])
    if (url.endsWith("/learning/paths")) return json({ paths })
    throw new Error(`Petición inesperada: ${url}`)
  })
}

function renderPage() {
  return render(
    <AuthProvider>
      <ChatProvider>
        <ClasesPage />
      </ChatProvider>
    </AuthProvider>,
  )
}

describe("Mis clases", () => {
  it("agrupa por fase, de la más reciente a la más antigua, y cada una lleva a su sitio", async () => {
    stubServer([
      path("p1", "Ecuaciones", "check", "2026-10-01T10:00:00Z"),
      path("p2", "Fracciones", "completed", "2026-09-30T10:00:00Z", { progress: 1 }),
      path("p3", "Astronomía", "assessment", "2026-09-29T10:00:00Z"),
      path("p4", "Derivadas", "teaching", "2026-10-01T12:00:00Z"),
      // Ruta creada a mano (sin tema): no es una clase
      path("p5", "Plan propio", "teaching", "2026-10-01T13:00:00Z", { topic: "" }),
    ])
    renderPage()

    const inProgress = await screen.findByRole("region", { name: "En curso" })
    // La más reciente primero
    expect(within(inProgress).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual(["Derivadas", "Ecuaciones"])
    expect(within(inProgress).getByText("Ahora: Despejar la x")).toBeTruthy()
    expect(within(inProgress).getAllByRole("link", { name: "Continuar" }).map((a) => a.getAttribute("href"))).toEqual(["/clase/p4", "/clase/p1"])

    const placement = screen.getByRole("region", { name: "Pendientes de nivelación" })
    expect(within(placement).getByRole("link", { name: "Hacer la nivelación" }).getAttribute("href")).toBe("/nivelacion?tema=astronom%C3%ADa")

    const completed = screen.getByRole("region", { name: "Completadas" })
    expect(within(completed).getByText("100%")).toBeTruthy()
    expect(within(completed).getByRole("link", { name: "Abrir" }).getAttribute("href")).toBe("/clase/p2")

    expect(screen.queryByText("Plan propio")).toBeNull()
  })

  it("sin clases invita a nivelarse en un tema", async () => {
    stubServer([])
    renderPage()

    expect(await screen.findByText("Aún no tienes clases")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Nivelarme en un tema" }).getAttribute("href")).toBe("/nivelacion")
  })

  it("si no se pueden cargar, lo dice y deja reintentar", async () => {
    let up = false
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
      if (url.endsWith("/chats/")) return json({ chats: [] })
      if (url.endsWith("/learning/paths")) return up ? json({ paths: [] }) : json({ detail: "Error interno" }, 500)
      throw new Error(`Petición inesperada: ${url}`)
    })
    renderPage()

    expect(await screen.findByText("Error interno")).toBeTruthy()
    up = true
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByText("Aún no tienes clases")).toBeTruthy()
  })
})
