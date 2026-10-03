import { describe, it, expect } from "vitest"
import { dictationErrorMessage } from "./use-dictation"

describe("dictationErrorMessage", () => {
  it("cada error del navegador dice qué pasa y qué hacer", () => {
    expect(dictationErrorMessage("network")).toMatch(/no tiene servicio de dictado/)
    expect(dictationErrorMessage("not-allowed")).toMatch(/Permite el acceso al micrófono/)
    expect(dictationErrorMessage("service-not-allowed")).toMatch(/desactivado/)
    expect(dictationErrorMessage("audio-capture")).toMatch(/ningún micrófono/)
    expect(dictationErrorMessage("language-not-supported")).toMatch(/español/)
    expect(dictationErrorMessage("lo-que-sea")).toMatch(/No se pudo usar el dictado/)
  })

  it("parar o no decir nada no es un error que haya que contar", () => {
    expect(dictationErrorMessage("aborted")).toBeNull()
    expect(dictationErrorMessage("no-speech")).toBeNull()
  })
})
