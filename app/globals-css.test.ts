import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// jsdom no aplica el CSS, así que se comprueba la regla en el propio archivo.
// En un navegador a 360 px se comprobó que la ecuación se desplaza de lado
const css = readFileSync(join(__dirname, "globals.css"), "utf8")
const rule = (selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? ""

describe("CSS global", () => {
  it("una ecuación en bloque larga se desplaza dentro de su caja en vez de desbordar (móvil)", () => {
    const display = rule(".katex-display")
    expect(display).toMatch(/overflow-x:\s*auto/)
    expect(display).toMatch(/max-width:\s*100%/)
  })

  it("el texto de los mensajes parte las palabras largas", () => {
    expect(rule(".message-text")).toMatch(/overflow-wrap:\s*anywhere/)
  })
})
