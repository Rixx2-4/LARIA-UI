// Rutas de la app que llevan datos en la URL, construidas en un solo sitio

export function quizHref(chatId: string | null): string {
  return chatId ? `/quiz?chat=${encodeURIComponent(chatId)}` : "/quiz"
}
