import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import { ClassBoard, isImportant } from "./class-board"
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

describe("ClassBoard: LARIA señala los datos importantes", () => {
  it("reconoce un dato importante: negrita, fórmula aparte, cita o frase que lo anuncia", () => {
    expect(isImportant("La **hipotenusa** es el lado mayor.")).toBe(true)
    expect(isImportant("$$a^2 + b^2 = c^2$$")).toBe(true)
    expect(isImportant("> Un número primo solo se divide entre 1 y él mismo.")).toBe(true)
    expect(isImportant("Recuerda: el orden de los factores no altera el producto.")).toBe(true)
    expect(isImportant("Esta es la idea clave del tema.")).toBe(true)
    expect(isImportant("Ahora veamos un caso sencillo con números pequeños.")).toBe(false)
  })

  it("mientras dice un dato importante, señala la pizarra; con una frase normal, no", () => {
    const lesson = "Ahora veamos un caso sencillo con números pequeños. Recuerda: la **suma** de los ángulos es 180°."
    const at = (index: number) =>
      ({ ...speaking(() => null), speaking: { key: "k", index } }) as unknown as ReturnType<typeof useSpeech>

    const { rerender } = render(<ClassBoard lessonKey="k" markdown={lesson} speech={at(0)}><p>c</p></ClassBoard>)
    expect(screen.getByRole("img", { name: "LARIA está explicando" })).toBeTruthy()

    rerender(<ClassBoard lessonKey="k" markdown={lesson} speech={at(1)}><p>c</p></ClassBoard>)
    expect(screen.getByRole("img", { name: "LARIA está explicando, sorprendida, señalando la pizarra" })).toBeTruthy()
  })
})
