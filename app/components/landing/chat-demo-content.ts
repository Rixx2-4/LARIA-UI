import katex from "katex"

// La respuesta de la demo, por párrafos. Las fórmulas se convierten a HTML aquí,
// en el servidor, al generar la página: así la presentación no descarga KaTeX
// ni el pipeline de Markdown (~400 KB) solo para pintar tres fórmulas.

export type DemoPiece = { kind: "text"; value: string } | { kind: "math"; html: string; display: boolean }

type Source = string | { tex: string; display?: boolean }

const ANSWER: Source[][] = [
  ["Cuando una función va dentro de otra, derivas la de fuera y multiplicas por la derivada de la de dentro:"],
  [{ tex: String.raw`\frac{d}{dx}\,f(g(x)) = f'(g(x))\cdot g'(x)`, display: true }],
  [
    "Con ",
    { tex: "f(x) = (3x+1)^2" },
    ", la de fuera es ",
    { tex: "u^2" },
    " y la de dentro ",
    { tex: "g(x) = 3x+1" },
    ". Queda ",
    { tex: String.raw`f'(x) = 2(3x+1)\cdot 3 = 6(3x+1)` },
    ".",
  ],
]

// Cada párrafo en trozos que se "escriben" de uno en uno: unas pocas palabras
// seguidas o una fórmula entera (nunca LaTeX a medias)
export function demoAnswer(): DemoPiece[][] {
  return ANSWER.map((paragraph) =>
    paragraph.flatMap((source): DemoPiece[] => {
      if (typeof source !== "string") {
        const html = katex.renderToString(source.tex, { displayMode: !!source.display, throwOnError: true })
        return [{ kind: "math", html, display: !!source.display }]
      }
      const words = source.split(/(?<=\s)/)
      const chunks: DemoPiece[] = []
      for (let i = 0; i < words.length; i += 3) chunks.push({ kind: "text", value: words.slice(i, i + 3).join("") })
      return chunks
    }),
  )
}
