import { describe, it, expect } from "vitest"
import { diagramLabel, diagramName, openDiagramAt } from "./diagrams"

describe("esquemas en el markdown", () => {
  it("encuentra el bloque mermaid que sigue abierto", () => {
    expect(openDiagramAt("Hola\n\n```mermaid\nflowchart TD\n  A --> B")).toBe(6)
    expect(openDiagramAt("Hola\n\n```mermaid\nflowchart TD\n  A --> B\n```\n")).toBeNull()
    // Un bloque de otro lenguaje abierto no es un esquema
    expect(openDiagramAt("```python\nprint(1)")).toBeNull()
    // Uno cerrado antes y el esquema después, abierto
    expect(openDiagramAt("```js\nx\n```\nY:\n```mermaid\nmindmap")).toBe(15)
  })

  it("nombra el esquema y lista sus etiquetas sin repetir", () => {
    expect(diagramName("stateDiagram-v2\n  [*] --> A")).toBe("Diagrama de estados")
    expect(diagramName("mindmap\n  root")).toBe("Mapa conceptual")
    expect(diagramName("pie\n  x")).toBe("Esquema")
    expect(diagramLabel("timeline\n  1789", ["1789", " Revolución ", "1789"])).toBe("Línea de tiempo: 1789, Revolución")
    expect(diagramLabel("flowchart TD", [])).toBe("Diagrama de flujo")
  })
})
