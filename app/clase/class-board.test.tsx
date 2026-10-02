import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import { ClassBoard } from "./class-board"
import type { useSpeech } from "@/hooks/use-speech"

afterEach(cleanup)

// La voz, de mentira: está leyendo el primer trozo de la lección «k»
function speaking(getLevel: () => number | null) {
  return {
    enabled: true, configLoaded: true, maxChars: 1200, mode: "voice", setMode: vi.fn(),
    speaking: { key: "k", index: 0 }, speakingKey: "k", pendingKey: "k",
    getLevel, enqueue: vi.fn(), playMessage: vi.fn(), prime: vi.fn(), stop: vi.fn(),
  } as unknown as ReturnType<typeof useSpeech>
}

describe("ClassBoard: la boca de LARIA", () => {
  it("con el volumen del audio, la boca lo sigue (--mouth) en lugar del bucle", async () => {
    render(
      <ClassBoard lessonKey="k" markdown="Una ecuación es una igualdad con una incógnita, como la de este ejemplo." speech={speaking(() => 0.1)}>
        <p>comprobación</p>
      </ClassBoard>,
    )
    const mascot = screen.getByRole("img", { name: "LARIA está explicando" })
    await waitFor(() => expect(mascot.getAttribute("data-lipsync")).toBe("on"))
    expect(Number(mascot.style.getPropertyValue("--mouth"))).toBeGreaterThan(0)
  })

  it("sin medición (navegador sin Web Audio) se queda con la animación en bucle", async () => {
    render(
      <ClassBoard lessonKey="k" markdown="Una ecuación es una igualdad con una incógnita, como la de este ejemplo." speech={speaking(() => null)}>
        <p>comprobación</p>
      </ClassBoard>,
    )
    const mascot = screen.getByRole("img", { name: "LARIA está explicando" })
    await new Promise((r) => setTimeout(r, 50))
    expect(mascot.hasAttribute("data-lipsync")).toBe(false)
  })
})
