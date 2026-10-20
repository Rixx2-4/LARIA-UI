import { describe, it, expect } from "vitest"
import { formatVersion, markGaps, withoutTitle } from "./legal"

describe("documentos legales", () => {
  it("cada hueco sin rellenar se ve como «Pendiente»", () => {
    expect(markGaps("Responsable: [[COMPLETAR: responsable]]. Correo: [[COMPLETAR:correo de contacto]]")).toBe(
      "Responsable: **[Pendiente: responsable]**. Correo: **[Pendiente: correo de contacto]**",
    )
  })

  it("un texto completo no cambia", () => {
    expect(markGaps("# Cookies\n\nSolo las necesarias.")).toBe("# Cookies\n\nSolo las necesarias.")
  })

  it("la versión, como fecha en español", () => {
    expect(formatVersion("2026-10-02")).toBe("2 de octubre de 2026")
    expect(formatVersion("v3")).toBe("v3")
  })
  it("quita el título del principio, que la página muestra aparte", () => {
    expect(withoutTitle("# Política de privacidad\n\n**Versión.** Texto\n\n# Otra")).toBe("**Versión.** Texto\n\n# Otra")
  })
})
