import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { StudyGoalsPicker } from "./study-goals-picker"
import { ClassStudyBar, DailyProgress } from "./study-progress"
import { NextSuggestions } from "./next-suggestions"
import { setAuthToken, type StudyTimeSummary } from "@/lib/laria-api"

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }) }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

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

const summary = (extra: Partial<StudyTimeSummary> = {}): StudyTimeSummary => ({
  today_minutes: 18, daily_goal_minutes: 30, session_minutes: 20, goal_met_today: false, streak_days: 3,
  last_7_days: [], ...extra,
})

describe("StudyGoalsPicker", () => {
  it("carga las metas y guarda al tocar, sin perder la otra", async () => {
    const saved: unknown[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        saved.push(JSON.parse(String(init.body)))
        return json(JSON.parse(String(init.body)))
      }
      return json({ session_minutes: 20, daily_goal_minutes: null })
    })
    render(<StudyGoalsPicker />)

    const session = await screen.findByRole("group", { name: "¿Cuánto quieres que dure cada clase?" })
    expect(session.querySelector('[aria-pressed="true"]')?.textContent).toBe("20 min")
    fireEvent.click(screen.getByText("1 hora"))

    await waitFor(() => expect(saved).toEqual([{ session_minutes: 20, daily_goal_minutes: 60 }]))
    expect(screen.getByText("1 hora").getAttribute("aria-pressed")).toBe("true")
  })

  it("sin el endpoint (404) no se muestra", async () => {
    vi.stubGlobal("fetch", async () => json({ detail: "Not Found" }, 404))
    const { container } = render(<StudyGoalsPicker />)
    await new Promise((r) => setTimeout(r, 30))
    expect(container.textContent).toBe("")
  })
})

describe("progreso del día y de la sesión", () => {
  it("el anillo dice cuánto llevas del objetivo y la racha", () => {
    render(<DailyProgress summary={summary()} />)
    expect(screen.getByLabelText("18 de 30 min hoy")).toBeTruthy()
    expect(screen.getByText("3 días")).toBeTruthy()
  })

  it("al llegar a la duración de la clase pregunta si seguir; «Dejarlo aquí» lleva a Mis clases", () => {
    const { rerender } = render(<ClassStudyBar summary={summary()} sessionSeconds={19 * 60} />)
    expect(screen.queryByText(/¿Seguimos o lo dejamos aquí\?/)).toBeNull()

    rerender(<ClassStudyBar summary={summary()} sessionSeconds={20 * 60} />)
    expect(screen.getByText(/Llevas 20 min de clase/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Dejarlo aquí" }).getAttribute("href")).toBe("/clases")
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }))
    expect(screen.queryByText(/Llevas 20 min de clase/)).toBeNull()
  })

  it("al cumplir el objetivo, LARIA lo celebra una sola vez al día", () => {
    render(<ClassStudyBar summary={summary({ goal_met_today: true, today_minutes: 31 })} sessionSeconds={60} />)
    expect(screen.getByText("¡Objetivo de hoy cumplido!")).toBeTruthy()
    cleanup()

    render(<ClassStudyBar summary={summary({ goal_met_today: true, today_minutes: 32 })} sessionSeconds={60} />)
    expect(screen.queryByText("¡Objetivo de hoy cumplido!")).toBeNull()
  })
})

describe("NextSuggestions", () => {
  const suggestions = [
    { topic: "fracciones", label: "Fracciones", kind: "level_up", reason: "Sube a intermedio", needs_placement: true },
    { topic: "porcentajes", label: "Porcentajes", kind: "advance", reason: "Se construye sobre fracciones", needs_placement: false },
  ]

  it("con nivelación lleva a nivelarse; si no, crea la ruta y abre la clase", async () => {
    const created: unknown[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.endsWith("/learning/paths/p1/next")) return json({ suggestions })
      if (url.endsWith("/learning/paths/from-topic")) {
        created.push(JSON.parse(String(init?.body)))
        return json({ id: "p2", topic: "porcentajes", modules: [], teaching: null })
      }
      throw new Error(`Petición inesperada: ${url}`)
    })
    render(<NextSuggestions pathId="p1" />)

    fireEvent.click(await screen.findByRole("button", { name: /Nivelarme/ }))
    expect(nav.push).toHaveBeenCalledWith("/nivelacion?tema=fracciones")

    fireEvent.click(screen.getByRole("button", { name: /Empezar/ }))
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/clase/p2"))
    expect(created).toEqual([{ topic: "porcentajes" }])
  })

  it("sin sugerencias (o si falla) no muestra nada", async () => {
    vi.stubGlobal("fetch", async () => json({ suggestions: [] }))
    const { container } = render(<NextSuggestions pathId="p1" />)
    await waitFor(() => expect(container.textContent).toBe(""))
  })
})
