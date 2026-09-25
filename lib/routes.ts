// Rutas de la app, construidas en un solo sitio

// "/" es la página de presentación; la app empieza en un chat nuevo
export const NEW_CHAT_HREF = "/chat"

// Para llegar al formulario directamente en modo "crear cuenta"
export const SIGN_UP_HREF = "/chat?modo=registro"

export function chatHref(chatId: string): string {
  return `/chat/${encodeURIComponent(chatId)}`
}

export function quizHref(chatId: string | null): string {
  return chatId ? `/quiz?chat=${encodeURIComponent(chatId)}` : "/quiz"
}
