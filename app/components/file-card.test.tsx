import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { FileCard } from "./file-card"
import { setAuthToken } from "@/lib/laria-api"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const doc = (status: string, error_message: string | null = null) =>
  json({ id: "d1", owner_id: "u1", filename: "libro.pdf", subject: "General", status, uploaded_at: "", has_analysis: status === "analyzed", error_message })

beforeEach(() => {
  setAuthToken("token")
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

// Avanza el reloj una consulta (5 s) y deja que lleguen las respuestas
const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(5000))

describe("FileCard: análisis del documento", () => {
  it("mientras el backend lo analiza dice «Analizando…» y deja de preguntar al terminar", async () => {
    const answers = [doc("analyzing"), doc("analyzing"), doc("analyzed")]
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => answers.shift() ?? doc("analyzed"))
    vi.stubGlobal("fetch", fetchMock)
    render(<FileCard filename="libro.pdf" mimeType="application/pdf" documentId="d1" documentStatus="uploaded" onClick={() => {}} />)

    expect(screen.queryByText(/Analizando/)).toBeNull()
    await nextPoll()
    expect(screen.getByText("Analizando… puede tardar hasta un minuto")).toBeTruthy()
    await nextPoll()
    await nextPoll()
    expect(screen.queryByText(/Analizando/)).toBeNull()

    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/documents\/d1$/)
  })

  it("si el análisis falla, enseña el motivo del backend", async () => {
    vi.stubGlobal("fetch", async () => doc("error", "El PDF está protegido con contraseña."))
    render(<FileCard filename="libro.pdf" mimeType="application/pdf" documentId="d1" documentStatus="uploaded" onClick={() => {}} />)

    await nextPoll()
    expect(screen.getByRole("alert").textContent).toBe("El PDF está protegido con contraseña.")
  })

  it("un documento ya analizado no consulta nada", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<FileCard filename="libro.pdf" mimeType="application/pdf" documentId="d1" documentStatus="analyzed" onClick={() => {}} />)

    await nextPoll()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
