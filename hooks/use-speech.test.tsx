import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSpeech } from "./use-speech"
import { setAuthToken } from "@/lib/laria-api"

// Un AudioContext de mentira que arranca (o no) al pedírselo
function fakeAudioContext(startsRunning: boolean) {
  const sources: unknown[] = []
  class FakeContext {
    state = "suspended"
    destination = {}
    resume() {
      if (startsRunning) this.state = "running"
      return Promise.resolve()
    }
    close() {
      return Promise.resolve()
    }
    createAnalyser() {
      return { fftSize: 0, connect: vi.fn(), getByteTimeDomainData: (b: Uint8Array) => b.fill(128 + 40) }
    }
    createMediaElementSource(element: unknown) {
      sources.push(element)
      return { connect: vi.fn() }
    }
  }
  vi.stubGlobal("AudioContext", FakeContext)
  return sources
}

beforeEach(() => {
  setAuthToken("token")
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ enabled: true, max_chars: 1200 })))
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
})
afterEach(() => {
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useSpeech: volumen para la boca de la mascota", () => {
  it("con el contexto de audio en marcha, conecta el analizador y mide el volumen", async () => {
    const sources = fakeAudioContext(true)
    const { result } = renderHook(() => useSpeech())

    await act(async () => result.current.prime())

    expect(sources).toHaveLength(1)
    expect(result.current.getLevel()).toBeCloseTo(40 / 128, 2)
  })

  it("si el contexto no arranca, NO pasa el audio por él (LARIA se quedaría muda)", async () => {
    const sources = fakeAudioContext(false)
    const { result } = renderHook(() => useSpeech())

    await act(async () => result.current.prime())

    expect(sources).toEqual([])
    expect(result.current.getLevel()).toBeNull()
  })

  it("sin Web Audio, no hay medición y la voz funciona igual", async () => {
    vi.stubGlobal("AudioContext", undefined)
    const { result } = renderHook(() => useSpeech())

    await act(async () => result.current.prime())

    expect(result.current.getLevel()).toBeNull()
  })
})
