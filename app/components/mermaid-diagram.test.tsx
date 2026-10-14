import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { MessageContent } from "./message-content"
import { DiagramThemeContext } from "./mermaid-diagram"
import { ClassBoard } from "@/app/clase/class-board"
import type { useSpeech } from "@/hooks/use-speech"

// Mermaid de verdad necesita un navegador (mide el texto con getBBox): en jsdom se
// simula con lo que importa aquí, qué se le pide y qué devuelve
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, source: string) => {
    if (source.includes("ROTO")) throw new Error("Parse error on line 2")
    const labels = [...source.matchAll(/\["([^"]+)"\]/g)].map((m) => `<g class="node"><span class="nodeLabel">${m[1]}</span></g>`)
    return { svg: `<svg viewBox="0 0 100 50">${labels.join("")}</svg>` }
  }),
}))
vi.mock("mermaid", () => ({ default: mermaid }))

afterEach(() => {
  cleanup()
  mermaid.initialize.mockClear()
  mermaid.render.mockClear()
})

const CICLO = 'flowchart TD\n    A["Evaporación"] --> B["Condensación"]\n    B --> C["Precipitación"]'

describe("Esquemas en las explicaciones", () => {
  it("un bloque mermaid se dibuja (no se enseña su código), en modo estricto y con nombre para el lector de pantalla", async () => {
    const { container } = render(<MessageContent content={"El ciclo del agua:\n\n```mermaid\n" + CICLO + "\n```\n\nY vuelta a empezar."} />)

    const diagram = await screen.findByRole("img", { name: "Diagrama de flujo: Evaporación, Condensación, Precipitación" })
    expect(diagram.querySelector("svg")).toBeTruthy()
    expect(container.textContent).not.toContain("flowchart")
    expect(container.querySelector("pre")).toBeNull()
    expect(screen.getByText("El ciclo del agua:")).toBeTruthy()
    expect(screen.getByText("Y vuelta a empezar.")).toBeTruthy()
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: "strict", startOnLoad: false, theme: "default" }))
    expect(mermaid.render.mock.calls[0][1]).toBe(CICLO)
  })

  it("mientras el bloque no se cierra (streaming), dice que está dibujando y no enseña el código a medias", () => {
    const { container } = render(<MessageContent content={'Mira este esquema:\n\n```mermaid\nflowchart TD\n    A["Evapo'} />)

    expect(screen.getByRole("status").textContent).toContain("Dibujando el esquema…")
    expect(screen.getByText("Mira este esquema:")).toBeTruthy()
    expect(container.textContent).not.toContain("flowchart")
    expect(mermaid.render).not.toHaveBeenCalled()
  })

  it("otro bloque de código sin cerrar se sigue enseñando como código", () => {
    const { container } = render(<MessageContent content={"```python\nprint('hola')"} />)

    expect(container.querySelector("pre")?.textContent).toContain("print('hola')")
    expect(screen.queryByText("Dibujando el esquema…")).toBeNull()
  })

  it("si Mermaid no puede dibujarlo, un aviso discreto: ni el código ni el error", async () => {
    const { container } = render(<MessageContent content={"Antes.\n\n```mermaid\nflowchart TD\n    ROTO\n```\n\nDespués."} />)

    expect(await screen.findByText("No se pudo dibujar el esquema.")).toBeTruthy()
    expect(container.textContent).not.toContain("ROTO")
    expect(container.textContent).not.toContain("Parse error")
    expect(screen.getByText("Antes.")).toBeTruthy()
    expect(screen.getByText("Después.")).toBeTruthy()
  })

  it("en la pizarra (verde oscuro) usa el tema oscuro", async () => {
    render(
      <DiagramThemeContext.Provider value="dark">
        <MessageContent content={"```mermaid\n" + CICLO + "\n```"} />
      </DiagramThemeContext.Provider>,
    )

    await screen.findByRole("img", { name: /Diagrama de flujo/ })
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }))
  })

  it("se puede ampliar a pantalla completa y cerrar con Escape", async () => {
    render(<MessageContent content={"```mermaid\n" + CICLO + "\n```"} />)

    const expand = await screen.findByRole("button", { name: "Ampliar: Diagrama de flujo" })
    expand.focus()
    fireEvent.click(expand)
    const dialog = screen.getByRole("dialog", { name: "Esquema ampliado" })
    expect(dialog.querySelector("svg")).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar" }))

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(expand)
  })

  it("en la pizarra de la clase, sin voz, el esquema de la lección se dibuja entero y en oscuro", async () => {
    const speech = {
      enabled: false, configLoaded: true, maxChars: 1200, mode: "text", setMode: vi.fn(),
      speaking: null, speakingKey: null, pendingKey: null,
      getLevel: () => null, enqueue: vi.fn(), playMessage: vi.fn(), prime: vi.fn(), stop: vi.fn(),
    } as unknown as ReturnType<typeof useSpeech>
    render(
      <ClassBoard lessonKey="k" markdown={"El ciclo del agua tiene tres pasos.\n\n```mermaid\n" + CICLO + "\n```\n\nY se repite."} speech={speech}>
        <p>comprobación</p>
      </ClassBoard>,
    )

    expect(await screen.findByRole("img", { name: /Diagrama de flujo: Evaporación/ })).toBeTruthy()
    expect(mermaid.render.mock.calls[0][1]).toBe(CICLO)
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }))
  })
})
