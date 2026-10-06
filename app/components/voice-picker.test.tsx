import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { VoicePicker } from "./voice-picker"
import { setAuthToken } from "@/lib/laria-api"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const VOICES = {
  voices: [
    { id: "coral", label: "Coral", gender: "femenina", description: "Cálida y cercana" },
    { id: "nova", label: "Nova", gender: "femenina", description: "Clara y animada" },
    { id: "shimmer", label: "Shimmer", gender: "femenina", description: "Suave" },
    { id: "ash", label: "Ash", gender: "masculina", description: "Serena" },
    { id: "echo", label: "Echo", gender: "masculina", description: "Firme" },
    { id: "onyx", label: "Onyx", gender: "masculina", description: "Grave" },
  ],
  default: "coral",
  selected: null,
  sample_text: "Hola, soy LARIA, tu tutora de Plenum.",
}

beforeEach(() => {
  setAuthToken("token")
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
  URL.createObjectURL = vi.fn(() => "blob:voz")
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubServer({ voices = VOICES as unknown, voicesStatus = 200 } = {}) {
  const calls = { speech: [] as unknown[], saved: [] as unknown[] }
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/speech/voices")) return json(voicesStatus === 200 ? voices : { detail: "Not Found" }, voicesStatus)
    if (url.endsWith("/speech") && method === "POST") {
      calls.speech.push(JSON.parse(String(init?.body)))
      return new Response(new Blob(["mp3"], { type: "audio/mpeg" }))
    }
    if (url.endsWith("/speech/voice") && method === "PUT") {
      calls.saved.push(JSON.parse(String(init?.body)))
      return json(JSON.parse(String(init?.body)))
    }
    throw new Error(`Petición inesperada: ${method} ${url}`)
  })
  return calls
}

describe("VoicePicker", () => {
  it("carga las voces en dos grupos, marca la de por defecto y avisa de que son de IA", async () => {
    stubServer()
    render(<VoicePicker />)

    expect(await screen.findByRole("group", { name: "Voces femeninas" })).toBeTruthy()
    expect(screen.getByRole("group", { name: "Voces masculinas" })).toBeTruthy()
    expect(screen.getByText("Coral").closest("button")?.getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByText("Las voces son generadas por IA.")).toBeTruthy()
  })

  it("▶ pide la frase de ejemplo con esa voz, sin cambiar la elegida", async () => {
    const calls = stubServer()
    render(<VoicePicker />)

    fireEvent.click(await screen.findByRole("button", { name: "Escuchar Onyx" }))

    await waitFor(() => expect(calls.speech).toEqual([{ text: "Hola, soy LARIA, tu tutor de Plenum.", emotion: "calm", voice: "onyx" }]))
    expect(calls.saved).toEqual([])
  })

  it("la frase de ejemplo concuerda con la voz: «tu tutora» en femenino, «tu tutor» en masculino", async () => {
    const calls = stubServer()
    render(<VoicePicker />)

    fireEvent.click(await screen.findByRole("button", { name: "Escuchar Nova" }))
    await waitFor(() => expect(calls.speech).toHaveLength(1))
    fireEvent.click(screen.getByRole("button", { name: "Escuchar Ash" }))
    await waitFor(() => expect(calls.speech).toHaveLength(2))

    expect(calls.speech.map((c) => (c as { text: string }).text)).toEqual([
      "Hola, soy LARIA, tu tutora de Plenum.",
      "Hola, soy LARIA, tu tutor de Plenum.",
    ])
  })

  it("si el backend manda una frase por género, usa esa", async () => {
    const calls = stubServer({ voices: { ...VOICES, sample_texts: { masculina: "Hola, soy tu tutor LARIA." } } })
    render(<VoicePicker />)

    fireEvent.click(await screen.findByRole("button", { name: "Escuchar Echo" }))
    await waitFor(() => expect(calls.speech).toEqual([{ text: "Hola, soy tu tutor LARIA.", emotion: "calm", voice: "echo" }]))
  })

  it("elegir una voz la guarda en el perfil; volver a la de por defecto guarda null", async () => {
    const calls = stubServer()
    render(<VoicePicker />)

    fireEvent.click(await screen.findByText("Echo"))
    await waitFor(() => expect(calls.saved).toEqual([{ voice: "echo" }]))
    expect(screen.getByText("Echo").closest("button")?.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(screen.getByText("Coral"))
    await waitFor(() => expect(calls.saved).toEqual([{ voice: "echo" }, { voice: null }]))
  })

  it("sin voces en el backend (404) no muestra nada", async () => {
    stubServer({ voicesStatus: 404 })
    const { container } = render(<VoicePicker />)

    // Espera a que la consulta de voces haya terminado
    await new Promise((r) => setTimeout(r, 50))
    expect(container.textContent).toBe("")
  })
})
