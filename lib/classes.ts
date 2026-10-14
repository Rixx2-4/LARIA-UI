import type { LearningPath, PathModule, PlacementLevel } from "./laria-api"

// Las rutas que son clases (traen tema) agrupadas por fase, de la más reciente a
// la más antigua. Las creadas a mano (sin tema) no son clases y no aparecen
const IN_PROGRESS = new Set(["teaching", "check", "remediation", "advance"])

export interface ClassGroups {
  inProgress: LearningPath[]
  // A falta de una nivelación: la primera o la prueba de paso a un tramo nuevo
  needsPlacement: LearningPath[]
  completed: LearningPath[]
}

// Terminó un tramo pero no la ruta: le toca la prueba de paso al siguiente
export function tierDone(path: LearningPath): boolean {
  return path.teaching?.phase === "completed" && !!path.next_tier
}

export function classGroups(paths: LearningPath[]): ClassGroups {
  const classes = paths
    .filter((path) => !!path.topic?.trim())
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
  const phase = (path: LearningPath) => path.teaching?.phase
  return {
    inProgress: classes.filter((path) => IN_PROGRESS.has(phase(path) ?? "")),
    needsPlacement: classes.filter((path) => phase(path) === "assessment" || tierDone(path)),
    completed: classes.filter((path) => phase(path) === "completed" && !path.next_tier),
  }
}

export function inProgressCount(paths: LearningPath[]): number {
  return classGroups(paths).inProgress.length
}

// El tramo en el que se está: el del concepto que toca o, si no, el último abierto
export function currentTier(path: LearningPath): PlacementLevel | null {
  const current = path.modules.find((m) => m.concept === path.teaching?.concept)
  return current?.tier ?? path.tiers?.at(-1) ?? null
}

// Progreso dentro de un tramo (el de la ruta entera baja al abrir uno nuevo)
export function tierProgress(path: LearningPath, tier: PlacementLevel): number {
  const modules = path.modules.filter((m) => m.tier === tier)
  if (!modules.length) return path.progress ?? 0
  return modules.filter((m) => m.status === "completed" || m.status === "assumed").length / modules.length
}

// Cómo va un concepto, en palabras y no como nota (el dominio exacto no se enseña)
export function moduleLabel(module: PathModule): string {
  if (module.status === "locked") return "Bloqueado"
  if (module.status === "assumed") return "Ya lo sabías"
  if (module.status === "completed") return module.mastery >= 0.8 ? "Dominado" : "Hecho"
  if (module.status === "in_progress") return module.mastery >= 0.4 ? "En camino" : "Empezado"
  return "Por empezar"
}

// Cuánto se domina, en 0 a 3 tramos de una barra pequeña
export function masterySteps(module: PathModule): number {
  if (module.status === "assumed") return 3
  if (module.status === "locked" || module.mastery <= 0) return module.status === "completed" ? 1 : 0
  return module.mastery >= 0.8 ? 3 : module.mastery >= 0.4 ? 2 : 1
}

// «hoy», «ayer», «hace 3 días», «hace 2 meses»; vacío sin fecha
export function lastStudied(updatedAt: string | undefined, now = new Date()): string {
  if (!updatedAt) return ""
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return ""
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
  const format = new Intl.RelativeTimeFormat("es", { numeric: "auto" })
  if (days > -30) return format.format(Math.min(0, days), "day")
  if (days > -365) return format.format(Math.round(days / 30), "month")
  return format.format(Math.round(days / 365), "year")
}
