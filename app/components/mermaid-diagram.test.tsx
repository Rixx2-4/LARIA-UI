import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { MessageContent } from "./message-content"
import { DiagramThemeContext, forgetDiagrams } from "./mermaid-diagram"
import { MAX_DIAGRAM_LINES } from "@/lib/diagrams"
import { ClassBoard } from "@/app/clase/class-board"
import type { useSpeech } from "@/hooks/use-speech"

// Mermaid de verdad necesita un navegador (mide el texto con getBBox): en jsdom se
// simula con lo que importa aquí, qué se le pide y qué devuelve
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  // Como el de verdad: false si la sintaxis no vale (con suppressErrors) y el tipo si vale
  parse: vi.fn(async (source: string) => {
    if (source.includes("ROTO")) return false
    return { diagramType: source.startsWith("architecture") ? "architecture" : source.startsWith("mindmap") ? "mindmap" : "flowchart-v2" }
  }),
  render: vi.fn(async (_id: string, source: string) => {
    if (source.includes("FALLA")) throw new Error("Could not measure text")
    if (source.includes("MALICIOSO")) {
      return {
        svg: '<svg viewBox="0 0 100 50"><style>.n{fill:url(https://x.test/a.png)}</style><image href="https://x.test/espia.png"/>' +
          '<a href="javascript:alert(1)"><text>clic</text></a><foreignObject><div><img src="https://x.test/b.png" onerror="alert(1)">Nodo</div></foreignObject>' +
          '<path marker-end="url(#flecha)" onclick="alert(1)"/></svg>',
      }
    }
    const width = source.includes("ANCHO") ? 1600 : 100
    const labels = [...source.matchAll(/\["([^"]+)"\]/g)].map((m) => `<g class="node"><span class="nodeLabel">${m[1]}</span></g>`)
    return { svg: `<svg viewBox="0 0 ${width} 50">${labels.join("")}</svg>` }
  }),
}))
vi.mock("mermaid", () => ({ default: mermaid }))

afterEach(() => {
  cleanup()
  forgetDiagrams()
  mermaid.initialize.mockClear()
  mermaid.parse.mockClear()
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
    expect(container.textContent).not.toContain("flowchart")
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

  it("valida la sintaxis antes de dibujar y, si no vale, ofrece el esquema en texto", async () => {
    const { container } = render(<MessageContent content={'Antes.\n\n```mermaid\nflowchart TD\n    A["Evaporación"] --> B["ROTO"]\n```\n\nDespués.'} />)

    expect(await screen.findByText("No se pudo dibujar el esquema.")).toBeTruthy()
    expect(mermaid.parse).toHaveBeenCalledWith(expect.stringContaining("flowchart TD"), { suppressErrors: true })
    expect(mermaid.render).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("Ver el esquema en texto"))
    expect(screen.getByRole("listitem").textContent).toBe("Evaporación → ROTO")
    expect(container.textContent).not.toContain("flowchart")
    expect(screen.getByText("Después.")).toBeTruthy()
  })

  it("si falla al dibujar (no al validar), el mismo aviso con el texto", async () => {
    render(<MessageContent content={'```mermaid\nflowchart TD\n    A["Paso FALLA"] --> B["Otro"]\n```'} />)

    expect(await screen.findByText("No se pudo dibujar el esquema.")).toBeTruthy()
    expect(screen.getByText("Ver el esquema en texto")).toBeTruthy()
  })

  it("solo dibuja los tipos de esquema pensados para clase", async () => {
    render(<MessageContent content={"```mermaid\narchitecture-beta\n    service api(server)[API]\n```"} />)

    expect(await screen.findByText("No se pudo dibujar el esquema.")).toBeTruthy()
    expect(mermaid.render).not.toHaveBeenCalled()
  })

  it("uno demasiado grande no llega a Mermaid", async () => {
    const big = "flowchart TD\n" + Array.from({ length: MAX_DIAGRAM_LINES }, (_, i) => `    N${i}["Paso ${i}"] --> N${i + 1}`).join("\n")
    render(<MessageContent content={"```mermaid\n" + big + "\n```"} />)

    expect(await screen.findByText("El esquema es demasiado grande para dibujarlo.")).toBeTruthy()
    expect(mermaid.parse).not.toHaveBeenCalled()
    expect(mermaid.render).not.toHaveBeenCalled()
  })

  it("las directivas del modelo no cambian el tema ni el CSS: se quitan antes de validar y dibujar", async () => {
    render(<MessageContent content={'```mermaid\n%%{init: {"theme": "forest", "themeCSS": "x"}}%%\n' + CICLO + "\n```"} />)

    await screen.findByRole("img", { name: /Diagrama de flujo/ })
    expect(mermaid.render.mock.calls[0][1]).toBe(CICLO)
  })

  it("del SVG se quitan las imágenes y enlaces externos, los scripts y los eventos", async () => {
    render(<MessageContent content={'```mermaid\nflowchart TD\n    A["MALICIOSO"]\n```'} />)

    const diagram = await screen.findByRole("img", { name: /Diagrama de flujo/ })
    const html = diagram.innerHTML
    expect(html).not.toContain("x.test")
    expect(html).not.toContain("javascript:")
    expect(html).not.toMatch(/onerror|onclick/)
    expect(diagram.querySelector("image, img")).toBeNull()
    // Lo propio del esquema se queda: las flechas apuntan a sus marcadores internos
    expect(diagram.querySelector("path")?.getAttribute("marker-end")).toBe("url(#flecha)")
    expect(diagram.textContent).toContain("Nodo")
  })

  it("en streaming, mientras llega un segundo esquema, el primero no se vuelve a dibujar; al final, los dos en orden", async () => {
    const first = 'flowchart TD\n    A["Uno"] --> B["Dos"]'
    const second = 'flowchart TD\n    C["Tres"] --> D["Cuatro"]'
    const partial = "Primero:\n\n```mermaid\n" + first + "\n```\n\nLuego:\n\n```mermaid\nflowchart TD\n    C"
    const { rerender, container } = render(<MessageContent content={partial} />)
    const firstDiagram = await screen.findByRole("img", { name: /Uno, Dos/ })
    expect(screen.getByRole("status").textContent).toContain("Dibujando el esquema…")

    rerender(<MessageContent content={partial.replace(/ {4}C$/, "") + second.split("\n")[1] + "\n```\n\nFin."} />)
    await screen.findByRole("img", { name: /Tres, Cuatro/ })
    // El mismo nodo del DOM: no se desmontó ni se volvió a montar
    expect(screen.getByRole("img", { name: /Uno, Dos/ })).toBe(firstDiagram)

    expect(mermaid.render.mock.calls.map((call) => call[1])).toEqual([first, second])
    const ids = mermaid.render.mock.calls.map((call) => call[0])
    expect(new Set(ids).size).toBe(2)
    const text = container.textContent ?? ""
    expect(text.indexOf("Primero:")).toBeLessThan(text.indexOf("Luego:"))
    expect(text.indexOf("Luego:")).toBeLessThan(text.indexOf("Fin."))
    const diagrams = screen.getAllByRole("img")
    expect(diagrams.map((d) => d.getAttribute("aria-label"))).toEqual(["Diagrama de flujo: Uno, Dos", "Diagrama de flujo: Tres, Cuatro"])
  })

  it("un bloque de código normal sigue siendo código, y ```Mermaid con mayúscula es un esquema", async () => {
    const { container } = render(<MessageContent content={"```js\nconst a = 1\n```\n\n```Mermaid\n" + CICLO + "\n```"} />)

    expect(container.querySelector("pre")?.textContent).toContain("const a = 1")
    expect(await screen.findByRole("img", { name: /Diagrama de flujo/ })).toBeTruthy()
  })

  it("uno muy ancho no se encoge hasta ser ilegible: se desplaza dentro de su caja", async () => {
    render(<MessageContent content={'```mermaid\nflowchart LR\n    A["ANCHO"] --> B["Fin"]\n```'} />)

    const diagram = await screen.findByRole("img", { name: /Diagrama de flujo/ })
    expect(diagram.style.getPropertyValue("--diagram-min-width")).toBe("960px")
  })
})
