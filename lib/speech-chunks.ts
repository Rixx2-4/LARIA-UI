// Trocea la respuesta del tutor en frases para leerlas en voz mientras se escribe.
// Una frase está lista al cerrarse (". ", "? ", "! ", párrafo, fin de un bloque de
// código o antes de un elemento de lista); las muy cortas se juntan con la siguiente
// para no hacer una petición por cada «Muy bien.». Ningún trozo pasa de maxChars.

export const MIN_CHUNK_CHARS = 40

const FENCE = /^ {0,3}(```|~~~)/
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/

// Posiciones donde se puede cortar (el corte va justo después) y los bloques de código
function boundaries(text: string): { cuts: number[]; codeBlocks: [number, number][] } {
  const cuts: number[] = []
  const codeBlocks: [number, number][] = []
  let fenceStart = -1
  let lineStart = 0

  while (lineStart < text.length) {
    const newline = text.indexOf("\n", lineStart)
    const lineEnd = newline === -1 ? text.length : newline + 1
    const line = text.slice(lineStart, newline === -1 ? text.length : newline)
    // Una línea sin su salto todavía puede crecer: no se decide nada sobre ella
    const complete = newline !== -1

    if (FENCE.test(line) && complete) {
      if (fenceStart === -1) {
        if (lineStart > 0) cuts.push(lineStart)
        fenceStart = lineStart
      } else {
        codeBlocks.push([fenceStart, lineEnd])
        cuts.push(lineEnd)
        fenceStart = -1
      }
    } else if (fenceStart === -1) {
      if (complete && LIST_ITEM.test(text.slice(lineEnd)) && lineEnd < text.length) cuts.push(lineEnd)
      if (complete && line.trim() === "" && lineStart > 0) cuts.push(lineEnd)
      // Con el salto incluido: una frase que acaba la línea también se cierra
      for (const match of text.slice(lineStart, lineEnd).matchAll(/[.?!…]+["»)\]]*(?=\s)/g)) {
        const at = lineStart + match.index + match[0].length
        // Tras el punto hace falta ver el espacio: «3.» puede ser «3.5»
        if (at < text.length) cuts.push(at)
      }
    }
    lineStart = lineEnd
  }
  return { cuts: [...new Set(cuts)].sort((a, b) => a - b), codeBlocks }
}

// Un bloque de código se lee como «te dejo el código en pantalla»: si no cabe, se
// manda recortado pero cerrado, para que el servidor lo siga reconociendo
function fitCodeBlock(block: string, maxChars: number): string {
  if (block.length <= maxChars) return block
  const firstLine = block.slice(0, block.indexOf("\n") + 1)
  return `${firstLine}${block.slice(firstLine.length, maxChars - firstLine.length - 5).trimEnd()}\n\`\`\`\n`
}

// Parte un trozo demasiado largo por el último espacio antes del límite
function hardSplit(segment: string, maxChars: number): string[] {
  const parts: string[] = []
  let rest = segment
  while (rest.length > maxChars) {
    const space = rest.lastIndexOf(" ", maxChars)
    const at = space > maxChars / 2 ? space + 1 : maxChars
    parts.push(rest.slice(0, at))
    rest = rest.slice(at)
  }
  if (rest) parts.push(rest)
  return parts
}

/**
 * De `text` (lo aún no leído), saca los trozos listos para decir. `rest` es el final
 * de `text` que todavía no está listo: quien llama sabe así por dónde va. Con `final`
 * (terminó la respuesta) no queda resto.
 */
export function takeSpeakable(text: string, final: boolean, maxChars: number): { chunks: string[]; rest: string } {
  const { cuts, codeBlocks } = boundaries(text)
  const ends = final && text.length > 0 && cuts.at(-1) !== text.length ? [...cuts, text.length] : cuts

  const segments: { text: string; code: boolean }[] = []
  let from = 0
  for (const end of ends) {
    if (end <= from) continue
    segments.push({ text: text.slice(from, end), code: codeBlocks.some(([start, stop]) => start === from && stop === end) })
    from = end
  }

  const chunks: string[] = []
  let pending = ""
  let consumed = 0
  const flush = () => {
    if (pending) chunks.push(pending)
    consumed += pending.length
    pending = ""
  }

  for (const segment of segments) {
    if (segment.code) {
      flush()
      chunks.push(fitCodeBlock(segment.text, maxChars))
      consumed += segment.text.length
      continue
    }
    if (pending && pending.length + segment.text.length > maxChars) flush()
    if (segment.text.length > maxChars) {
      const parts = hardSplit(segment.text, maxChars)
      for (const part of parts.slice(0, -1)) {
        chunks.push(part)
        consumed += part.length
      }
      pending = parts.at(-1) ?? ""
    } else {
      pending += segment.text
    }
    if (pending.trim().length >= MIN_CHUNK_CHARS) flush()
  }
  if (final) flush()

  // Solo cuentan los trozos con algo que decir; el espacio sobrante no se pierde en `rest`
  return { chunks: chunks.filter((chunk) => chunk.trim()), rest: text.slice(consumed) }
}
