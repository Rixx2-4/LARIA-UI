import type { ReviewAgenda, ReviewItem } from "./laria-api"

// Cómo se cuentan y se dicen los repasos (ADR-051). La retención es una estimación
// del modelo: se redondea y se presenta como tal, nunca como una medida

// Lo que toca hoy: lo vencido más lo de hoy (counts trae el total, aunque items venga recortado)
export function dueCount(agenda: ReviewAgenda | null): number {
  return agenda ? agenda.counts.overdue + agenda.counts.today : 0
}

export function isDue(item: ReviewItem): boolean {
  return item.status === "overdue" || item.status === "today"
}

// 0,724 → "72 %"
export function percent(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)} %`
}

const DAY_MS = 24 * 60 * 60 * 1000

// Días de calendario (en la zona del navegador) entre hoy y la fecha
function calendarDays(iso: string, now: Date): number {
  const date = new Date(iso)
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((start(date) - start(now)) / DAY_MS)
}

// Cuándo toca: "Hoy", "Mañana", "En 5 días", "Hace 3 días"
export function whenLabel(iso: string, now = new Date()): string {
  const days = calendarDays(iso, now)
  if (days === 0) return "Hoy"
  if (days === 1) return "Mañana"
  if (days === -1) return "Ayer"
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`
}

// "12 oct"
export function shortDate(iso: string | number): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" }).replace(".", "")
}

// Lo que dice la fila de un repaso según su estado
export function statusLabel(item: ReviewItem, now = new Date()): string {
  if (item.status === "overdue") return `Tocaba ${whenLabel(item.next_review_at, now).toLowerCase()}`
  if (item.status === "today") return "Toca hoy"
  return `Próximo repaso: ${whenLabel(item.next_review_at, now).toLowerCase()}`
}
