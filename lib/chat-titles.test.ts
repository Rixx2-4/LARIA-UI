import { describe, it, expect } from "vitest"
import { fallbackTitle, titleRequestMessages } from "./chat-titles"

describe("títulos de chat", () => {
  it("el título de respaldo corta por palabras, no a media palabra", () => {
    const title = fallbackTitle([{ role: "user", content: "¿Qué es la fotosíntesis y cómo funciona en las plantas verdes?" }])
    expect(title).toBe("Qué es la fotosíntesis y cómo")
  })

  it("prepara como mucho 4 mensajes no vacíos de hasta 2000 caracteres", () => {
    const request = titleRequestMessages([
      { role: "user", content: "a".repeat(2500) },
      { role: "assistant", content: "  " },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
      { role: "assistant", content: "d" },
      { role: "user", content: "e" },
    ])
    expect(request.map((m) => m.content.length)).toEqual([2000, 1, 1, 1])
  })
})
