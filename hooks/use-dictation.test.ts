import { describe, it, expect } from "vitest"
import { dictationErrorMessage, transcriptFrom } from "./use-dictation"

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

const results = (...items: [string, boolean][]) => items.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal }))

describe("transcriptFrom (lo que entrega Chrome en Android)", () => {
  it("la misma frase repetida 12 veces como definitiva cuenta una sola vez", () => {
    const repeated = Array.from({ length: 12 }, () => ["hola qué tal", true] as [string, boolean])
    expect(transcriptFrom(results(...repeated))).toEqual({ finalText: "hola qué tal", interim: "" })
  })

  it("las versiones acumuladas («hola», «hola qué», «hola qué tal») dan la última", () => {
    expect(transcriptFrom(results(["hola", true], ["hola qué", true], ["hola qué tal", true])).finalText).toBe("hola qué tal")
  })

  it("frases distintas se juntan, y lo provisional va aparte", () => {
    expect(transcriptFrom(results(["la fotosíntesis", true], ["ocurre en las hojas", true], ["de las", false]))).toEqual({
      finalText: "la fotosíntesis ocurre en las hojas",
      interim: "de las",
    })
  })

  it("lo provisional que repite lo ya definitivo no se muestra dos veces", () => {
    expect(transcriptFrom(results(["hola", true], ["hola", false]))).toEqual({ finalText: "hola", interim: "" })
  })
})
