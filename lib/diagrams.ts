// Esquemas Mermaid dentro de las explicaciones (ADR-048 del backend): el tutor
// escribe un bloque ```mermaid en el markdown y el cliente lo dibuja

const FENCE = /^ {0,3}(```|~~~)[ \t]*([^\s`]*)/

// Dónde empieza un bloque ```mermaid que aún no se ha cerrado (la respuesta sigue
// llegando); null si no hay ninguno abierto. Los otros bloques de código se saltan
export function openDiagramAt(content: string): number | null {
  let open: { index: number; mermaid: boolean } | null = null
  let position = 0
  for (const line of content.split("\n")) {
    const fence = FENCE.exec(line)
    if (fence) {
      if (!open) open = { index: position, mermaid: fence[2].toLowerCase() === "mermaid" }
      else if (!fence[2]) open = null
    }
    position += line.length + 1
  }
  return open?.mermaid ? open.index : null
}

const DIAGRAM_NAME: Record<string, string> = {
  flowchart: "Diagrama de flujo",
  graph: "Diagrama de flujo",
  sequencediagram: "Diagrama de secuencia",
  statediagram: "Diagrama de estados",
  "statediagram-v2": "Diagrama de estados",
  mindmap: "Mapa conceptual",
  timeline: "Línea de tiempo",
  classdiagram: "Diagrama de clases",
  pie: "Gráfico circular",
  erdiagram: "Diagrama entidad-relación",
  "xychart-beta": "Gráfico",
  xychart: "Gráfico",
}

// «Diagrama de flujo», «Mapa conceptual»…, por la primera palabra del esquema
export function diagramName(source: string): string {
  const kind = source.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
  return DIAGRAM_NAME[kind] ?? "Esquema"
}

// Lo que lee un lector de pantalla: el tipo de esquema y sus etiquetas, sin repetir
export function diagramLabel(source: string, labels: string[]): string {
  const unique = [...new Set(labels.map((label) => label.replace(/\s+/g, " ").trim()).filter(Boolean))]
  const name = diagramName(source)
  if (!unique.length) return name
  const list = unique.join(", ")
  return `${name}: ${list.length > 400 ? `${list.slice(0, 400)}…` : list}`
}

// El código del esquema lo escribe el modelo: se trata como contenido no confiable.
// Topes holgados para un esquema de clase (los del ADR caben de sobra) y muy por
// debajo de los de Mermaid (50 000 caracteres, 500 flechas), que ya cuelgan el móvil
export const MAX_DIAGRAM_CHARS = 4000
export const MAX_DIAGRAM_LINES = 120

export type PreparedDiagram = { ok: true; source: string } | { ok: false; reason: "empty" | "too-large" | "unsafe" }

// %%{init: …}%% y la cabecera ---…--- cambian el tema, las fuentes o el CSS del
// esquema (themeCSS puede pedir recursos de fuera): el aspecto lo pone la app
const DIRECTIVE = /%%\{[\s\S]*?\}%%/g
const FRONTMATTER = /^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/
// En las etiquetas, solo HTML de formato (<br>, <b>, <sub>…): una <img> o un <a> se
// quitan antes de que Mermaid los meta en la página para medirlos. «<<interface>>»
// (diagramas de clases) no es HTML: va precedido de otro «<»
const NON_FORMAT_TAG = /(?<!<)<\/?(?!(?:br|b|i|strong|em|sub|sup|u|small)\b)[a-z][^<>]*>/gi
// Formas con imagen o icono (A@{ img: "https://…" }): Mermaid descarga la imagen al
// dibujar, antes de que se pueda limpiar el resultado. No se dibujan
const IMAGE_SHAPE = /@\{[^}]*\b(?:img|icon)\s*:/

const clean = (raw: string) => raw.replace(FRONTMATTER, "").replace(DIRECTIVE, "").replace(NON_FORMAT_TAG, "").trim()

export function prepareDiagram(raw: string): PreparedDiagram {
  const source = clean(raw)
  if (!source) return { ok: false, reason: "empty" }
  if (IMAGE_SHAPE.test(source)) return { ok: false, reason: "unsafe" }
  if (source.length > MAX_DIAGRAM_CHARS || source.split("\n").length > MAX_DIAGRAM_LINES) {
    return { ok: false, reason: "too-large" }
  }
  return { ok: true, source }
}

// Formas de los nodos de un diagrama de flujo: A[...], A(...), A{...}, A((...)), A>...]…
const FLOW_NODE = /([\p{L}\p{N}_-]+)\s*(?:\(\(|\[\[|\[\(|\(\[|\[\/|\[\\|\{\{|\[|\(|\{|>)\s*"?([^"\]\)\}]*?)"?\s*(?:\)\)|\]\]|\)\]|\]\)|\/\]|\\\]|\}\}|\]|\)|\})/gu
// Una flecha con etiqueta opcional: -->|sí|, -- No -->, -.->, ==>, ---
const FLOW_EDGE = /\s*(?:--\s*([^->|][^->]*?)\s*-->|-->\s*\|([^|]*)\||-\.->|-->|==>|---|-\.-|--o|--x)\s*/g
const FLOW_SKIP = /^(?:subgraph|end|classDef|class|style|linkStyle|click|direction)\b/
const SEQ_ARROW = /\s*(?:-->>|->>|-->|->|--x|-x|--\)|-\))\s*/g

// ¿Abre y cierra los mismos corchetes y comillas?
function balanced(line: string): boolean {
  const count = (pattern: RegExp) => (line.match(pattern) ?? []).length
  return count(/[[({]/g) === count(/[\])}]/g) && count(/"/g) % 2 === 0 && !/→\s*>/.test(line)
}

// El esquema contado en texto, para cuando no se puede dibujar: lo que dice, sin la
// sintaxis de Mermaid (identificadores, formas, estilos). Solo reordena lo que ya
// trae el código; no añade nada
export function diagramOutline(raw: string): string[] {
  const source = clean(raw).slice(0, MAX_DIAGRAM_CHARS)
  const [header = "", ...body] = source.split("\n")
  const kind = header.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
  const lines = body
    .map((line) =>
      line
        .replace(/%%.*$/, "")
        // A@{ shape: …, label: "Inicio" } se lee como A["Inicio"]
        .replace(/([\p{L}\p{N}_-]+)@\{([^}]*)\}/gu, (_, id: string, meta: string) => {
          const label = /\blabel:\s*"([^"]*)"/.exec(meta)?.[1]
          return label ? `${id}["${label}"]` : id
        })
        .trim(),
    )
    .filter(Boolean)
  let outline: string[]

  if (kind === "flowchart" || kind === "graph") {
    const labels = new Map<string, string>()
    for (const line of lines) for (const [, id, label] of line.matchAll(FLOW_NODE)) if (label.trim()) labels.set(id, label.trim())
    outline = lines
      .filter((line) => !FLOW_SKIP.test(line))
      .map((line) =>
        line
          .replace(FLOW_NODE, (_, id: string) => `\u0000${id}\u0000`)
          .replace(FLOW_EDGE, (_, dashed?: string, piped?: string) => {
            const label = (dashed ?? piped ?? "").trim()
            return label ? ` → (${label}) ` : " → "
          })
          .replace(/\u0000([^\u0000]+)\u0000|([\p{L}\p{N}_-]+)/gu, (match, marked?: string, bare?: string) => labels.get(marked ?? bare ?? "") ?? marked ?? match)
          .replace(/\s*;\s*$/, "")
          .trim(),
      )
      // Una línea mal cerrada (esquema roto) deja corchetes, comillas o flechas a medias
      .map((line) => (/[[\]{}()"]|→\s*>/.test(line) && !balanced(line) ? line.replace(/\s*[[({]+"?\s*/g, " ").replace(/"?[\])}]+|→\s*>+/g, (m) => (m.startsWith("→") ? "→" : "")).replace(/\s+/g, " ").trim() : line))
  } else {
    outline = lines.map((line) =>
      line
        .replace(SEQ_ARROW, " → ")
        .replace(/^(?:title|section|participant|actor)\s+/i, "")
        .replace(/^[\p{L}\p{N}_-]*\s*(?:\(\(|\[|\(|\{\{|\))\s*"?([^"\]\)\}]*?)"?\s*(?:\)\)|\]|\)|\}\}|\()$/u, "$1")
        .trim(),
    )
  }
  return outline.filter(Boolean).slice(0, 40)
}
