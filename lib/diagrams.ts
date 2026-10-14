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
