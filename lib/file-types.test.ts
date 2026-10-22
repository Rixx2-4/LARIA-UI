import { describe, it, expect } from "vitest"
import { fileCategory, isTextMime, previewKind } from "./file-types"

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
})
