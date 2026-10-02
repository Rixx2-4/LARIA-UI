import type { LearningPath } from "./laria-api"

// Las rutas que son clases (traen tema) agrupadas por fase, de la más reciente a
// la más antigua. Las creadas a mano (sin tema) no son clases y no aparecen
const IN_PROGRESS = new Set(["teaching", "check", "remediation", "advance"])

export interface ClassGroups {
  inProgress: LearningPath[]
  needsPlacement: LearningPath[]
  completed: LearningPath[]
}

export function classGroups(paths: LearningPath[]): ClassGroups {
  const classes = paths
    .filter((path) => !!path.topic?.trim())
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
  const phase = (path: LearningPath) => path.teaching?.phase
  return {
    inProgress: classes.filter((path) => IN_PROGRESS.has(phase(path) ?? "")),
    needsPlacement: classes.filter((path) => phase(path) === "assessment"),
    completed: classes.filter((path) => phase(path) === "completed"),
  }
}

export function inProgressCount(paths: LearningPath[]): number {
  return classGroups(paths).inProgress.length
}
