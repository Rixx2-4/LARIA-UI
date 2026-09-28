import type { ChatMessage, TutorEnvelope } from "./laria-api"

// El envelope del tutor de un mensaje. El backend lo guarda tal cual en `metadata`;
// mensajes antiguos lo tenían anidado en `metadata.envelope`
export function tutorEnvelope(message: ChatMessage): TutorEnvelope | null {
  const metadata = message.metadata
  if (!metadata) return null
  const nested = metadata.envelope as TutorEnvelope | undefined
  return nested ?? metadata
}

// Etiqueta visible para cada tipo de respuesta; "answer" y "error" no llevan
const TYPE_LABEL: Record<string, string> = {
  explanation: "Explicación",
  hint: "Pista",
  quiz: "Quiz",
  celebration: "Logro",
}

export function envelopeLabel(envelope: TutorEnvelope | null): string | null {
  return (envelope?.type && TYPE_LABEL[envelope.type]) || null
}

// Si la respuesta se apoya en un documento (tutoría) o no (chat libre); null si no se sabe
export function envelopeGrounded(envelope: TutorEnvelope | null): boolean | null {
  const grounded = envelope?.payload?.grounded ?? envelope?.grounded
  return typeof grounded === "boolean" ? grounded : null
}
