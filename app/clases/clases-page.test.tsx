import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react"
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

function stubServer(paths: unknown[], { deleteStatus = 204 }: { deleteStatus?: number } = {}) {
  const deletes: string[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      deletes.push(url)
      return deleteStatus === 204 ? new Response(null, { status: 204 }) : json({ detail: deleteStatus === 404 ? "Not Found" : "Error interno" }, deleteStatus)
    }
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.endsWith("/documents/")) return json([])
    if (url.endsWith("/learning/paths")) return json({ paths })
    if (url.endsWith("/learning/me/study-time?tz=" + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)))
      return json({ today_minutes: 12, daily_goal_minutes: 30, session_minutes: 20, goal_met_today: false, streak_days: 2, last_7_days: [] })
    if (url.endsWith("/learning/paths/p2/next"))
      return json({ suggestions: [{ topic: "porcentajes", label: "Porcentajes", kind: "advance", reason: "Se construye sobre fracciones", needs_placement: false }] })
    throw new Error(`Petición inesperada: ${url}`)
  })
  return deletes
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
      // Terminó el tramo básico: le toca la prueba de paso al intermedio
      path("p6", "Geometría", "completed", "2026-09-28T10:00:00Z", { tiers: ["basico"], next_tier: "intermedio" }),
      // Ruta creada a mano (sin tema): no es una clase
      path("p5", "Plan propio", "teaching", "2026-10-01T13:00:00Z", { topic: "" }),
    ])
    renderPage()

    const inProgress = await screen.findByRole("region", { name: "En curso" })
    // La más reciente primero
    expect(within(inProgress).getAllByRole("listitem").map((li) => li.querySelector("h3")?.textContent)).toEqual(["Derivadas", "Ecuaciones"])
    expect(within(inProgress).getByText("Vas por: Despejar la x")).toBeTruthy()
    expect(within(inProgress).getAllByRole("link", { name: "Continuar" }).map((a) => a.getAttribute("href"))).toEqual(["/clase/p4", "/clase/p1"])

    const placement = screen.getByRole("region", { name: "Pendientes" })
    expect(within(placement).getByRole("link", { name: "Hacer la prueba de paso" }).getAttribute("href")).toBe("/clase/p6/prueba-de-paso")
    expect(within(placement).getByText(/prueba de paso para abrir el tramo intermedio/)).toBeTruthy()
    expect(within(placement).getByText("Prueba de paso disponible")).toBeTruthy()
    expect(within(placement).getByRole("link", { name: "Hacer la nivelación" }).getAttribute("href")).toBe("/nivelacion?tema=astronom%C3%ADa")

    const completed = screen.getByRole("region", { name: "Completadas" })
    expect(within(completed).getByText("100%")).toBeTruthy()
    expect(within(completed).getByRole("link", { name: "Abrir" }).getAttribute("href")).toBe("/clase/p2")

    expect(screen.queryByText("Plan propio")).toBeNull()

    // El objetivo de hoy y cómo seguir tras la última ruta completada (Fracciones)
    expect(await screen.findByLabelText("12 de 30 min hoy")).toBeTruthy()
    const next = await screen.findByRole("region", { name: "Después de Fracciones" })
    expect(within(next).getByText("Porcentajes")).toBeTruthy()
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

  it("la última que estudiaste va destacada, con su nivel, su temario y el repaso pendiente", async () => {
    stubServer([
      path("p1", "Ecuaciones", "teaching", "2026-10-01T12:00:00Z", {
        tiers: ["basico", "intermedio"],
        teaching: { phase: "teaching", concept: "despejar", concept_title: "Despejar la x", return_to: null, return_to_title: null, variant: "review", pending_check_quiz_id: null, last_outcome: null, passed_concepts: [], reason: null },
        modules: [
          { title: "Qué es una ecuación", concept: "ecuacion", kind: "content", status: "completed", mastery: 0.9, position: 0, tier: "basico" },
          { title: "Despejar la x", concept: "despejar", kind: "content", status: "in_progress", mastery: 0.5, position: 1, tier: "intermedio" },
          { title: "Sistemas", concept: "sistemas", kind: "content", status: "locked", mastery: 0, position: 2, tier: "intermedio" },
        ],
      }),
      path("p2", "Derivadas", "teaching", "2026-09-01T12:00:00Z"),
    ])
    renderPage()

    const inProgress = await screen.findByRole("region", { name: "En curso" })
    const [first, second] = within(inProgress).getAllByRole("listitem").filter((li) => li.parentElement === inProgress.querySelector("ul"))
    expect(within(first).getByText("Sigue donde lo dejaste")).toBeTruthy()
    expect(within(second).queryByText("Sigue donde lo dejaste")).toBeNull()
    expect(within(first).getByText("Repaso pendiente")).toBeTruthy()
    expect(within(first).getByText("Repasamos: Despejar la x")).toBeTruthy()
    // El nivel, en 3 pasos; el progreso, el del tramo en curso
    expect(within(first).getByRole("list", { name: "Nivel intermedio, 2 de 3" })).toBeTruthy()
    expect(within(first).getByText("0 de 2 conceptos · tramo intermedio")).toBeTruthy()
    // El dominio en palabras, nunca como nota
    expect(within(first).getByText("Ver temario (3)")).toBeTruthy()
    expect(within(first).getByText("Dominado")).toBeTruthy()
    expect(within(first).getByText("En camino")).toBeTruthy()
    expect(within(first).getByText("Bloqueado")).toBeTruthy()
    expect(first.textContent).not.toMatch(/90|50 ?%/)
  })

  it("antes de borrar una clase pide confirmarlo; cancelar no borra nada", async () => {
    const deletes = stubServer([path("p1", "Ecuaciones", "teaching", "2026-10-01T12:00:00Z")])
    renderPage()

    const trigger = await screen.findByRole("button", { name: "Borrar la clase Ecuaciones" })
    // Como en el navegador: el botón pulsado tiene el foco
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar la clase «Ecuaciones»?" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(within(dialog).getByText(/Lo que ya aprendiste se queda en tu perfil/)).toBeTruthy()
    // El foco empieza en lo seguro
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" }))

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(deletes).toEqual([])
    expect(screen.getByText("Ecuaciones")).toBeTruthy()
  })

  it("al confirmar, borra la clase y la quita de la lista", async () => {
    const deletes = stubServer([path("p1", "Ecuaciones", "teaching", "2026-10-01T12:00:00Z"), path("p4", "Derivadas", "teaching", "2026-09-01T12:00:00Z")])
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Borrar la clase Ecuaciones" }))
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar clase" }))

    await waitFor(() => expect(screen.queryByText("Ecuaciones")).toBeNull())
    expect(deletes).toEqual([expect.stringMatching(/\/learning\/paths\/p1$/)])
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByText("Derivadas")).toBeTruthy()
  })

  it("si ya estaba borrada (404), la quita igual", async () => {
    stubServer([path("p1", "Ecuaciones", "teaching", "2026-10-01T12:00:00Z")], { deleteStatus: 404 })
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Borrar la clase Ecuaciones" }))
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar clase" }))

    expect(await screen.findByText("Aún no tienes clases")).toBeTruthy()
  })

  it("si no se puede borrar, lo dice en el diálogo y la clase sigue", async () => {
    stubServer([path("p1", "Ecuaciones", "teaching", "2026-10-01T12:00:00Z")], { deleteStatus: 500 })
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Borrar la clase Ecuaciones" }))
    const dialog = screen.getByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Borrar clase" }))

    expect(await within(dialog).findByRole("alert")).toBeTruthy()
    expect(screen.getAllByText("Ecuaciones").length).toBeGreaterThan(0)
  })
})
