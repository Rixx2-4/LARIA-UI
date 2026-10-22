// Qué es cada archivo según su tipo MIME, en un solo sitio para la subida,
// la tarjeta del adjunto y el visor

// Lo que se puede subir al chat: lo mismo que acepta el backend (file_parser.py): texto,
// datos, código y cuatro binarios
export const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".pptx", ".xlsx",
  ".txt", ".md", ".markdown",
  ".csv", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".tex", ".rst", ".log",
  ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".htm", ".css", ".scss", ".sh", ".bash", ".sql",
  ".java", ".c", ".cpp", ".h", ".cs", ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".r", ".jl", ".lua", ".pl",
]

// El tipo de cada extensión que se puede subir (más las imágenes). Tras recargar solo se
// conoce el nombre del archivo, y casi ningún navegador da el tipo del código (.java,
// .sql…): sin estar aquí, el visor no sabía que es texto y decía «Vista previa no
// disponible»
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain", md: "text/markdown", markdown: "text/markdown", csv: "text/csv",
  json: "application/json", xml: "text/xml", yaml: "text/yaml", yml: "text/yaml", toml: "text/x-toml",
  ini: "text/plain", cfg: "text/plain", tex: "text/x-tex", rst: "text/x-rst", log: "text/plain",
  py: "text/x-python", js: "text/javascript", ts: "text/typescript", tsx: "text/typescript", jsx: "text/javascript",
  html: "text/html", htm: "text/html", css: "text/css", scss: "text/x-scss", sh: "text/x-sh", bash: "text/x-sh",
  sql: "text/x-sql", java: "text/x-java", c: "text/x-c", cpp: "text/x-c++", h: "text/x-c", cs: "text/x-csharp",
  php: "text/x-php", rb: "text/x-ruby", go: "text/x-go", rs: "text/x-rust", swift: "text/x-swift",
  kt: "text/x-kotlin", r: "text/x-r", jl: "text/x-julia", lua: "text/x-lua", pl: "text/x-perl",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
}

// El tipo de un archivo del que solo se conoce el nombre (p. ej. tras recargar)
export function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream"
}

// Texto legible tal cual: código, datos y texto plano
export function isTextMime(mimeType: string): boolean {
  // Word, PowerPoint y Excel (…openxmlformats-officedocument…) llevan "xml" en el tipo,
  // pero son un ZIP: leídos como texto saldría basura
  if (mimeType.includes("officedocument")) return false
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
