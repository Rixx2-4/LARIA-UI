import { describe, it, expect } from "vitest"
import { diagramLabel, diagramName, diagramOutline, MAX_DIAGRAM_CHARS, MAX_DIAGRAM_LINES, openDiagramAt, prepareDiagram } from "./diagrams"

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
    expect(diagramName("pie\n  x")).toBe("Gráfico circular")
    expect(diagramName("gantt\n  x")).toBe("Esquema")
    expect(diagramLabel("timeline\n  1789", ["1789", " Revolución ", "1789"])).toBe("Línea de tiempo: 1789, Revolución")
    expect(diagramLabel("flowchart TD", [])).toBe("Diagrama de flujo")
  })

  it("un bloque ```Mermaid (con mayúscula) abierto también es un esquema", () => {
    expect(openDiagramAt("```Mermaid\nflowchart TD")).toBe(0)
  })
})

describe("preparar un esquema del modelo (contenido no confiable)", () => {
  it("quita las directivas y la cabecera de configuración: el aspecto lo decide la app", () => {
    const source = '%%{init: {"theme": "forest", "themeCSS": ".node{fill:url(https://x.test/a.png)}"}}%%\nflowchart TD\n  A --> B'
    expect(prepareDiagram(source)).toEqual({ ok: true, source: "flowchart TD\n  A --> B" })
    const front = "---\ntitle: Ciclo\nconfig:\n  theme: forest\n---\nflowchart LR\n  A --> B"
    expect(prepareDiagram(front)).toEqual({ ok: true, source: "flowchart LR\n  A --> B" })
  })

  it("no deja pasar formas con imágenes o iconos: Mermaid las descargaría antes de dibujar", () => {
    expect(prepareDiagram('flowchart TD\n  A@{ img: "https://x.test/a.png", label: "X" }')).toEqual({ ok: false, reason: "unsafe" })
    expect(prepareDiagram('flowchart TD\n  A@{ icon: "fa:user", label: "X" }')).toEqual({ ok: false, reason: "unsafe" })
    // Las formas sin imagen sí
    expect(prepareDiagram('flowchart TD\n  A@{ shape: rounded, label: "X" }').ok).toBe(true)
  })

  it("en las etiquetas solo quedan las etiquetas HTML de formato: el resto se quita", () => {
    expect(prepareDiagram('flowchart TD\n  A["<img src=https://x.test/a.png onerror=alert(1)>Hola<br>mundo <b>ya</b>"]')).toEqual({
      ok: true,
      source: 'flowchart TD\n  A["Hola<br>mundo <b>ya</b>"]',
    })
    // <<interface>> de los diagramas de clases no es HTML
    const classes = "classDiagram\n  class Figura {\n    <<interface>>\n  }\n  Figura <|-- Circulo"
    expect(prepareDiagram(classes)).toEqual({ ok: true, source: classes })
  })

  it("rechaza los vacíos y los demasiado grandes antes de pasarlos a Mermaid", () => {
    expect(prepareDiagram("  \n")).toEqual({ ok: false, reason: "empty" })
    expect(prepareDiagram("flowchart TD\n" + "  A --> B\n".repeat(MAX_DIAGRAM_LINES))).toEqual({ ok: false, reason: "too-large" })
    expect(prepareDiagram("flowchart TD\n  A[\"" + "x".repeat(MAX_DIAGRAM_CHARS) + "\"]")).toEqual({ ok: false, reason: "too-large" })
  })
})

describe("el esquema en texto, por si no se puede dibujar", () => {
  it("un diagrama de flujo se lee como pasos con flechas, con las etiquetas y no los identificadores", () => {
    const source = 'flowchart TD\n  A["Evaporación"] --> B("Condensación")\n  B -->|si hace frío| C{"¿Precipita?"}\n  C -- No --> B\n  classDef x fill:#fff\n  class A x'
    expect(diagramOutline(source)).toEqual([
      "Evaporación → Condensación",
      "Condensación → (si hace frío) ¿Precipita?",
      "¿Precipita? → (No) Condensación",
    ])
  })

  it("en un esquema roto, los restos de sintaxis de las líneas mal cerradas no se enseñan", () => {
    expect(diagramOutline('flowchart TD\n  A["Inicio"] --> B["Medio\n  B -->> C((')).toEqual(["Inicio → B Medio", "B → C"])
  })

  it("aunque el esquema se rechace, el texto sale sin directivas ni HTML", () => {
    expect(diagramOutline('%%{init: {"theme": "forest"}}%%\nflowchart TD\n  A@{ img: "https://x.test/a.png", label: "Foto" } --> B["<img src=x>Fin"]')).toEqual(["Foto → Fin"])
  })

  it("una forma con metadatos se lee por su etiqueta", () => {
    expect(diagramOutline('flowchart TD\n  A@{ shape: rounded, label: "Inicio" } --> B["Fin"]')).toEqual(["Inicio → Fin"])
  })

  it("los demás tipos, línea a línea y sin sintaxis", () => {
    expect(diagramOutline("mindmap\n  root((Célula))\n    Núcleo\n    [Membrana]")).toEqual(["Célula", "Núcleo", "Membrana"])
    expect(diagramOutline("sequenceDiagram\n  Cliente->>Servidor: Pide la página\n  Servidor-->>Cliente: HTML")).toEqual([
      "Cliente → Servidor: Pide la página",
      "Servidor → Cliente: HTML",
    ])
    expect(diagramOutline("timeline\n  title Independencia\n  1810 : Grito de Dolores")).toEqual(["Independencia", "1810 : Grito de Dolores"])
  })
})
