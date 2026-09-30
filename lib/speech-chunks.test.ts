import { describe, it, expect } from "vitest"
import { takeSpeakable } from "./speech-chunks"

const MAX = 1200

describe("takeSpeakable", () => {
  it("corta al cerrarse una frase y deja la que está a medias para después", () => {
    const text = "La fotosíntesis convierte la luz en energía química. Ocurre en los cloroplastos de"
    const { chunks, rest } = takeSpeakable(text, false, MAX)
    expect(chunks).toEqual(["La fotosíntesis convierte la luz en energía química."])
    expect(rest).toBe(" Ocurre en los cloroplastos de")
  })

  it("no corta un punto sin espacio detrás (3.5) ni una frase que puede seguir", () => {
    expect(takeSpeakable("El valor es 3.5 y el resultado final es correcto.", false, MAX).chunks).toEqual([])
  })

  it("junta las frases cortas con la siguiente", () => {
    const { chunks } = takeSpeakable("¡Muy bien! Exacto. Ahora vamos a ver qué pasa con las derivadas parciales. Y", false, MAX)
    expect(chunks).toEqual(["¡Muy bien! Exacto. Ahora vamos a ver qué pasa con las derivadas parciales."])
  })

  it("al terminar la respuesta lo dice todo, aunque sea corto", () => {
    expect(takeSpeakable(" ¿Seguimos?", true, MAX)).toEqual({ chunks: [" ¿Seguimos?"], rest: "" })
  })

  it("un bloque de código va entero y solo cuando se cierra", () => {
    const open = "Mira este ejemplo en Python, que es muy corto:\n```python\nprint('hola')\n"
    const first = takeSpeakable(open, false, MAX)
    expect(first.chunks).toEqual(["Mira este ejemplo en Python, que es muy corto:\n"])
    expect(first.rest).toBe("```python\nprint('hola')\n")

    const closed = takeSpeakable(first.rest + "```\nY así se imprime.", true, MAX)
    expect(closed.chunks).toEqual(["```python\nprint('hola')\n```\n", "Y así se imprime."])
  })

  it("un bloque de código que no cabe se recorta, pero cerrado", () => {
    const code = "```js\n" + "x = 1;\n".repeat(300) + "```\n"
    const [chunk] = takeSpeakable(code, true, MAX).chunks
    expect(chunk.length).toBeLessThanOrEqual(MAX)
    expect(chunk.startsWith("```js\n")).toBe(true)
    expect(chunk.endsWith("```\n")).toBe(true)
  })

  it("corta antes de cada elemento de una lista y en los párrafos", () => {
    const text = "Tres pasos para resolver una ecuación de primer grado:\n- Agrupar los términos con x a un lado\n- Despejar x dividiendo\n\nFin del"
    expect(takeSpeakable(text, false, MAX).chunks).toEqual([
      "Tres pasos para resolver una ecuación de primer grado:\n",
      "- Agrupar los términos con x a un lado\n- Despejar x dividiendo\n\n",
    ])
  })

  it("ningún trozo pasa del máximo, aunque una frase sea larguísima", () => {
    const long = "palabra ".repeat(400) + "fin."
    const { chunks } = takeSpeakable(long, true, 300)
    expect(chunks.every((chunk) => chunk.length <= 300)).toBe(true)
    expect(chunks.join("")).toBe(long)
  })

  it("por trozos o de una vez, se dice lo mismo", () => {
    const answer = "Una derivada mide cómo cambia una función. Por ejemplo, la de x al cuadrado es 2x. ¿Lo ves? Probemos otra vez con un caso nuevo."
    let spoken: string[] = []
    let offset = 0
    for (let i = 1; i <= answer.length; i += 7) {
      const partial = answer.slice(0, i)
      const { chunks, rest } = takeSpeakable(partial.slice(offset), false, MAX)
      spoken = [...spoken, ...chunks]
      offset = partial.length - rest.length
    }
    spoken = [...spoken, ...takeSpeakable(answer.slice(offset), true, MAX).chunks]
    expect(spoken.join("")).toBe(answer)
  })
})
