// Ofrecer la nivelación una sola vez por chat: si la aceptó o dijo "ahora no",
// ese chat ya no la vuelve a proponer
const STORAGE_KEY = "laria_nivelacion_ofrecida"

function handledChats(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function wasPlacementOffered(chatId: string): boolean {
  return handledChats().includes(chatId)
}

export function markPlacementOffered(chatId: string): void {
  try {
    const chats = handledChats().filter((id) => id !== chatId)
    // Solo los últimos 200 chats: no hace falta más
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...chats, chatId].slice(-200)))
  } catch {
    // Sin almacenamiento, la oferta simplemente puede volver a salir
  }
}
