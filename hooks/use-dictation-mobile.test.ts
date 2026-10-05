import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDictation } from "./use-dictation"
import { FakeSpeechRecognition } from "@/test/speech"

afterEach(() => {
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
  FakeSpeechRecognition.instances = []
  vi.restoreAllMocks()
})

describe("useDictation en el móvil", () => {
  it.each([
    ["Android", "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile", false],
    ["escritorio", "Mozilla/5.0 (X11; Linux x86_64) Chrome/130", true],
  ])("%s: modo continuo = %s (en el móvil, una frase por pulsación)", (_name, userAgent, continuous) => {
    ;(window as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent)
    const { result } = renderHook(() => useDictation({ onTranscript: () => {} }))

    act(() => result.current.start())

    expect(FakeSpeechRecognition.instances[0].continuous).toBe(continuous)
  })
})
