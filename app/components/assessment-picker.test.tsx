import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AssessmentPicker, validMix } from "./assessment-picker"
import { setAuthToken } from "@/lib/laria-api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setAuthToken(null)
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function serve(prefs: Record<string, unknown>) {
  const puts: unknown[] = []
  setAuthToken("token")
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/learning/me/preferences") && init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)))
      return json({ ...prefs, assessment: JSON.parse(String(init.body)).assessment })
    }
    if (url.endsWith("/learning/me/preferences")) return json(prefs)
    return json({}, 404)
  })
  return puts
}

describe("AssessmentPicker", () => {
  it("con las abiertas apagadas en el servidor no se ofrece (sería un ajuste sin efecto)", async () => {
    serve({ explanation_style: null, assessment: { open_questions: 3, choice_questions: 3 }, open_questions_enabled: false })
    const { container } = render(<AssessmentPicker />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.innerHTML).toBe("")
  })

  it("un backend anterior (sin el campo) tampoco lo enseña", async () => {
    serve({ explanation_style: null })
    const { container } = render(<AssessmentPicker />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.innerHTML).toBe("")
  })

  it("con las abiertas activas, cada cambio se guarda solo con assessment (el PUT mezcla)", async () => {
    const puts = serve({ explanation_style: "visual", assessment: { open_questions: 3, choice_questions: 3 }, open_questions_enabled: true })
    render(<AssessmentPicker />)
    fireEvent.click(await screen.findByRole("button", { name: "Una más para escribir" }))
    await waitFor(() => expect(puts).toEqual([{ assessment: { open_questions: 4, choice_questions: 3 } }]))
    expect(screen.getByRole("group", { name: "Para escribir" }).textContent).toContain("4")
  })

  it("respeta los límites del servidor: cada uno de 0 a 10 y en total de 1 a 12", () => {
    expect(validMix({ open_questions: 3, choice_questions: 3 })).toBe(true)
    expect(validMix({ open_questions: 0, choice_questions: 0 })).toBe(false)
    expect(validMix({ open_questions: 11, choice_questions: 0 })).toBe(false)
    expect(validMix({ open_questions: 7, choice_questions: 6 })).toBe(false)
    expect(validMix({ open_questions: -1, choice_questions: 3 })).toBe(false)
  })
})
