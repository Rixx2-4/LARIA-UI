import { describe, it, expect, beforeEach } from "vitest"
import { guessTopic, markPlacementOffered, wasPlacementOffered } from "./placement"

describe("guessTopic", () => {
  it.each([
    ["Quiero aprender ecuaciones", "ecuaciones"],
    ["¿Qué es la fotosíntesis?", "fotosíntesis"],
    ["me enseñas derivadas?", "derivadas"],
    ["Explícame las fracciones, que no las entiendo", "fracciones"],
    ["quiero aprender sobre la revolución francesa para el examen", "revolución francesa"],
    ["hola, me explicas los logaritmos por favor", "logaritmos"],
    ["quiero entender la regla de la cadena", "regla de la cadena"],
  ])("«%s» → «%s»", (message, topic) => {
    expect(guessTopic(message)).toBe(topic)
  })

  it("sin tema reconocible deja el campo vacío para que lo escriba el estudiante", () => {
    expect(guessTopic("vamos a ver")).toBe("")
    expect(guessTopic("¿?")).toBe("")
  })
})

describe("oferta una vez por chat", () => {
  beforeEach(() => localStorage.clear())

  it("recuerda los chats en los que ya se ofreció", () => {
    expect(wasPlacementOffered("c1")).toBe(false)
    markPlacementOffered("c1")
    expect(wasPlacementOffered("c1")).toBe(true)
    expect(wasPlacementOffered("c2")).toBe(false)
  })
})
