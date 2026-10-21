import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { setAuthToken } from "@/lib/laria-api"
import { StudyDefaultsPicker } from "./study-defaults"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const catalog = {
  methods: [
    { key: "active_recall", name: "Recuerdo activo", summary: "Recordar sin mirar.", good_for: "", available: true, unavailable_reason: null, unavailable_text: null, recommended: false, recommended_text: null },
  ],
  paces: [
    { key: "free", name: "Libre", focus_minutes: null, break_minutes: null },
    { key: "pomodoro_15_3", name: "Pomodoro 15/3", focus_minutes: 15, break_minutes: 3 },
  ],
  default_method: null,
  default_pace: "free",
}

function stub(enabled: boolean, failPut = false) {
  const puts: unknown[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/learning/me/preferences") && init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)))
      return failPut ? json({ detail: "Error" }, 500) : json({})
    }
    if (url.endsWith("/learning/me/preferences"))
      return json({ explanation_style: null, study_methods_enabled: enabled, study_method: null, study_pace: "free" })
    if (url.endsWith("/learning/study-methods")) return json(catalog)
    return json({ detail: "Not Found" }, 404)
  })
  return puts
}

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("StudyDefaultsPicker", () => {
  it("guarda al tocar el método y el ritmo de las clases nuevas, con merge", async () => {
    const puts = stub(true)
    render(<StudyDefaultsPicker />)
    fireEvent.click(await screen.findByRole("radio", { name: /Recuerdo activo/ }))
    await waitFor(() => expect(puts).toEqual([{ study_method: "active_recall", study_pace: "free" }]))
    fireEvent.click(screen.getByRole("radio", { name: /Pomodoro 15\/3/ }))
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1]).toEqual({ study_method: "active_recall", study_pace: "pomodoro_15_3" })
  })

  it("si no se guarda, vuelve a lo de antes", async () => {
    stub(true, true)
    render(<StudyDefaultsPicker />)
    const recall = (await screen.findByRole("radio", { name: /Recuerdo activo/ })) as HTMLInputElement
    fireEvent.click(recall)
    await waitFor(() => expect((screen.getByRole("radio", { name: /Que decida LARIA/ }) as HTMLInputElement).checked).toBe(true))
  })

  it("con los métodos apagados no aparece", async () => {
    stub(false)
    const { container } = render(<StudyDefaultsPicker />)
    await new Promise((r) => setTimeout(r, 50))
    expect(container.textContent).toBe("")
  })
})
