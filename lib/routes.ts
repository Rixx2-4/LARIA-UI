// Rutas de la app, construidas en un solo sitio

// "/" es la página de presentación; la app empieza en un chat nuevo
export const NEW_CHAT_HREF = "/chat"

// Entrar y crear cuenta: las pantallas de Clerk
export const SIGN_IN_HREF = "/sign-in"
export const SIGN_UP_HREF = "/sign-up"

export function chatHref(chatId: string): string {
  return `/chat/${encodeURIComponent(chatId)}`
}

export function quizHref(chatId: string | null): string {
  return chatId ? `/quiz?chat=${encodeURIComponent(chatId)}` : "/quiz"
}

// Nivelación en un tema; con el chat de origen, para poder volver a él al terminar
export function placementHref(topic?: string, chatId?: string | null): string {
  const params = new URLSearchParams()
  if (topic) params.set("tema", topic)
  if (chatId) params.set("chat", chatId)
  const query = params.toString()
  return query ? `/nivelacion?${query}` : "/nivelacion"
}

// Mis clases
export const CLASSES_HREF = "/clases"

// Repasos: lo que toca repasar según la curva del olvido (ADR-051)
export const REVIEWS_HREF = "/repasos"

// Perfil (progreso, metas, voz y estilo) y cuenta (la de Clerk)
export const PROFILE_HREF = "/perfil"
export const ACCOUNT_HREF = "/cuenta"

// La clase guiada de una ruta de aprendizaje
export function classHref(pathId: string): string {
  return `/clase/${encodeURIComponent(pathId)}`
}

// La prueba de paso al siguiente tramo de una ruta (no la nivelación general)
export function passageTestHref(pathId: string): string {
  return `${classHref(pathId)}/prueba-de-paso`
}

// Términos, privacidad y cookies: los publica el backend (ADR-019) y son públicos
export const LEGAL_DOCUMENTS = [
  { slug: "terminos", label: "Términos" },
  { slug: "privacidad", label: "Privacidad" },
  { slug: "cookies", label: "Cookies" },
] as const

export function legalHref(slug: string): string {
  return `/legal/${encodeURIComponent(slug)}`
}
