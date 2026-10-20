import { describe, it, expect, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, cleanup } from "@testing-library/react"
import { LariaMascot, MASCOT_VIEWBOX } from "./laria-mascot"

afterEach(cleanup)

// jsdom no aplica el CSS ni mide el SVG: lo que se vio en Chrome (todas las
// combinaciones de estado, emoción y señalar) queda fijado en el marcado y en las reglas
const css = readFileSync(join(__dirname, "..", "globals.css"), "utf8")

describe("LariaMascot", () => {
  it("el viewBox deja margen para lo que se mueve: el dibujo (60 60 410 540) más lo medido al girar y saltar", () => {
    const [x, y, w, h] = MASCOT_VIEWBOX.split(" ").map(Number)
    // Pensando se salía 38 por la izquierda y 9 por abajo; celebrando, 18 por arriba
    expect(60 - x).toBeGreaterThanOrEqual(38)
    expect(60 - y).toBeGreaterThanOrEqual(18)
    expect(y + h - 600).toBeGreaterThanOrEqual(9)
    expect(x + w).toBeGreaterThanOrEqual(470)
    const { container } = render(<LariaMascot state="thinking" />)
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(MASCOT_VIEWBOX)
  })

  it.each(["idle", "thinking", "speaking"] as const)("tiene sus dos cejas neutras en el marcado (%s)", (state) => {
    const { container } = render(<LariaMascot state={state} />)
    expect(container.querySelector(".mascot-brow-left")).not.toBeNull()
    expect(container.querySelector(".mascot-brow-right")).not.toBeNull()
  })

  it("las cejas neutras no empiezan ocultas; las de cada emoción sí", () => {
    expect(css).toMatch(/\.mascot-brows > :not\(\.mascot-brow-left, \.mascot-brow-right\)/)
  })

  it("paciente y sorprendida cambian las neutras por las suyas", () => {
    for (const emotion of ["patient", "surprised"]) {
      expect(css).toContain(`.laria-mascot[data-emotion="${emotion}"] :is(.mascot-brow-left, .mascot-brow-right)`)
    }
  })

  it("pensando levanta la ceja derecha y deja la izquierda: nunca una sola ni tres", () => {
    expect(css).toMatch(/\[data-state="thinking"\] \.mascot-brow-left \{\s*opacity: 1;/)
    expect(css).toMatch(/\[data-state="thinking"\] :is\(\.mascot-brow-right, \.mascot-brows-patient, \.mascot-brows-surprised\) \{\s*opacity: 0;/)
  })
})
