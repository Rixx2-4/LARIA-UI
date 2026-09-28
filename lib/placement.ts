// El tema probable de una petición tipo "quiero aprender X" o "¿qué es X?".
// Es solo una propuesta: el estudiante la ve y la puede corregir antes de empezar.

const LEADING_REQUEST =
  /^(?:oye,?\s+|hola,?\s+|por favor,?\s+)?(?:quiero\s+(?:aprender|entender|repasar)|me\s+(?:puedes\s+)?(?:enseñas?|explicas?|ayudas\s+(?:a|con))|enséñame|ensename|explícame|explicame|explica(?:me)?|ayúdame\s+(?:a\s+entender|con)|ayudame\s+(?:a\s+entender|con)|qu[eé]\s+(?:es|son|significa)|define|definición\s+de|concepto\s+de|vamos\s+a\s+ver|introdúceme\s+a|por\s+d[oó]nde\s+empiezo\s+con)(?:\s+|$)/i

const LEADING_FILLER = /^(?:sobre|acerca\s+de|de|a|el|la|los|las|lo|un|una|unos|unas)\s+/i

export function guessTopic(message: string): string {
  let text = message.trim().replace(/^[¿¡]+/, "")
  text = text.replace(LEADING_REQUEST, "")
  // "sobre las ecuaciones" → "ecuaciones"
  for (let i = 0; i < 3 && LEADING_FILLER.test(text); i++) text = text.replace(LEADING_FILLER, "")
  // Lo que viene después de una coma o de "para"/"porque" ya no es el tema
  text = text.split(/,|\s+(?:para|porque|que\s+no|por\s+favor)\s+/i)[0]
  text = text.replace(/[?!.¿¡:;]+$/g, "").replace(/\s+por\s+favor$/i, "").trim()
  if (text.length > 60) text = text.slice(0, 60).replace(/\s+\S*$/, "")
  return text.length >= 2 ? text : ""
}

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
