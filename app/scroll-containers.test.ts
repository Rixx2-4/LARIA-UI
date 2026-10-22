import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

// jsdom no maqueta, así que se comprueba en el código. El fallo: un elemento con
// position:absolute (los sr-only, los radios ocultos de una lista) dentro de un
// contenedor con scroll que NO es su bloque contenedor se coloca respecto al documento
// y no se recorta. El documento crecía (en /quiz, 1236 px en una ventana de 820) y se
// desplazaba toda la interfaz, barra lateral incluida; al tabular, el foco movía
// incluso el contenedor raíz overflow-hidden. Con `relative`, cada contenedor con
// scroll recorta lo suyo. Comprobado en Chrome a 1366×820 y 390×844
const root = join(__dirname, "..")

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path)
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : []
  })
}

// Dentro de un overlay `fixed`, que ya es el bloque contenedor de lo absoluto
const INSIDE_FIXED_OVERLAY = ["app/components/file-viewer.tsx", "app/components/mermaid-diagram.tsx"]

describe("contenedores con scroll", () => {
  it("cada contenedor con scroll vertical es el bloque contenedor de su contenido (relative)", () => {
    const offenders: string[] = []
    for (const file of [...sources(join(root, "app")), ...sources(join(root, "components"))]) {
      const name = relative(root, file)
      if (INSIDE_FIXED_OVERLAY.includes(name) || name.startsWith("app/components/landing/")) continue
      for (const [, classes] of readFileSync(file, "utf8").matchAll(/className="([^"]*)"/g)) {
        const list = classes.split(/\s+/)
        const scrolls = list.some((c) => c === "overflow-auto" || c === "overflow-y-auto")
        const positioned = list.some((c) => ["relative", "absolute", "fixed", "sticky"].includes(c))
        if (scrolls && !positioned) offenders.push(`${name}: ${classes}`)
      }
    }
    expect(offenders).toEqual([])
  })

  // Un ScrollArea que ocupa el resto de una columna flex (flex-1) necesita min-h-0: sin
  // él crece hasta su contenido y no hay nada que desplazar. Pasaba en el Historial de la
  // barra lateral: con 40 chats la lista medía 1166 px en una ventana de 720 y los últimos
  // no se podían alcanzar ni con la rueda ni con el dedo. Comprobado en Chrome a 1280×720
  // y 390×700
  it("cada ScrollArea que llena una columna flex puede encogerse (min-h-0) para desplazarse", () => {
    const offenders: string[] = []
    for (const file of [...sources(join(root, "app")), ...sources(join(root, "components"))]) {
      const name = relative(root, file)
      for (const [, classes] of readFileSync(file, "utf8").matchAll(/<ScrollArea\s[^>]*className="([^"]*)"/g)) {
        const list = classes.split(/\s+/)
        if (list.includes("flex-1") && !list.includes("min-h-0")) offenders.push(`${name}: ${classes}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
