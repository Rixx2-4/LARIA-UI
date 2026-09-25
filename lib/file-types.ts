// Qué es cada archivo según su tipo MIME, en un solo sitio para la subida,
// la tarjeta del adjunto y el visor

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv",
  json: "application/json", xml: "text/xml", html: "text/html", css: "text/css",
  js: "text/javascript", ts: "text/typescript", py: "text/x-python",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
}

// El tipo de un archivo del que solo se conoce el nombre (p. ej. tras recargar)
export function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream"
}

// Texto legible tal cual: código, datos y texto plano
export function isTextMime(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("python")
  )
}

export type FileCategory = "image" | "pdf" | "spreadsheet" | "presentation" | "text" | "other"

export function fileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel")) return "spreadsheet"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation"
  if (isTextMime(mimeType)) return "text"
  return "other"
}

// Qué vista previa admite el visor; null si ninguna
export function previewKind(mimeType: string): "image" | "pdf" | "text" | null {
  const category = fileCategory(mimeType)
  if (category === "image" || category === "pdf") return category
  // Una hoja CSV también se lee bien como texto
  return isTextMime(mimeType) ? "text" : null
}
