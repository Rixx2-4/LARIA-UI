import { describe, it, expect } from "vitest"
import { ALLOWED_EXTENSIONS, fileCategory, isTextMime, mimeFromFilename, previewKind } from "./file-types"

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

describe("tipos de archivo", () => {
  it("Word, Excel y PowerPoint no son texto aunque su tipo diga «xml»: no se leen como texto", () => {
    expect(isTextMime(DOCX)).toBe(false)
    expect(previewKind(DOCX)).toBeNull()
    expect(fileCategory(XLSX)).toBe("spreadsheet")
    expect(fileCategory(PPTX)).toBe("presentation")
    expect(fileCategory(DOCX)).toBe("other")
  })

  it("el XML, el JSON y el código sí son texto", () => {
    expect(isTextMime("text/xml")).toBe(true)
    expect(isTextMime("application/json")).toBe(true)
    expect(isTextMime("text/x-python")).toBe(true)
  })

  // Tras recargar (o cuando el navegador no da el tipo) solo se conoce el nombre. Antes,
  // 34 de las 45 extensiones quedaban como application/octet-stream y el visor decía
  // «Vista previa no disponible» al abrir, p. ej., un .java o un .sql ya subido
  it("toda extensión que se puede subir tiene su tipo: el código y el texto se ven como texto", () => {
    const office = [".docx", ".pptx", ".xlsx"]
    for (const ext of ALLOWED_EXTENSIONS) {
      const mime = mimeFromFilename(`archivo${ext}`)
      expect(mime, ext).not.toBe("application/octet-stream")
      if (ext === ".pdf") expect(previewKind(mime)).toBe("pdf")
      else if (office.includes(ext)) expect(previewKind(mime), ext).toBeNull()
      else expect(previewKind(mime), ext).toBe("text")
    }
    // Word, PowerPoint y Excel no se pueden dibujar, pero se reconocen (tarjeta e icono)
    expect(mimeFromFilename("tema.docx")).toBe(DOCX)
    expect(fileCategory(mimeFromFilename("datos.xlsx"))).toBe("spreadsheet")
    expect(fileCategory(mimeFromFilename("clase.pptx"))).toBe("presentation")
  })
})
