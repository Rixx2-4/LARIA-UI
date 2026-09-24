// Reglas para los títulos de chat que se piden al backend

type TitleMessage = { role: "user" | "assistant"; content: string }

// El backend acepta hasta 5 mensajes de como mucho 2000 caracteres
const MAX_TITLE_MESSAGES = 4
const MAX_TITLE_CHARS = 2000

export function titleRequestMessages(messages: { role: string; content: string }[]): TitleMessage[] {
  return messages
    .filter((m): m is TitleMessage => (m.role === "user" || m.role === "assistant") && m.content.trim() !== "")
    .slice(0, MAX_TITLE_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_TITLE_CHARS) }))
}

// Último recurso si el backend no consigue generar título: la primera frase del
// usuario, cortada por palabras (nunca a media palabra) y sin signos sueltos
export function fallbackTitle(messages: { role: string; content: string }[]): string | null {
  const first = messages.find((m) => m.role === "user" && m.content.trim())?.content.trim()
  if (!first) return null
  const sentence = first.split(/[\n.!?]/).find((part) => part.trim()) ?? first
  const words = sentence.replace(/[¿¡"“”«»]/g, "").trim().split(/\s+/).slice(0, 6)
  let title = words.join(" ")
  if (title.length > 50) title = title.slice(0, 50).replace(/\s+\S*$/, "")
  title = title.replace(/[,:;]+$/, "")
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : null
}
