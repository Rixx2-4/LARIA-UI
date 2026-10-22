import { describe, it, expect } from "vitest"
import { classGroups, currentTier, lastStudied, masterySteps, moduleLabel, tierDone, tierProgress } from "./classes"
import type { LearningPath } from "./laria-api"

const mod = (concept: string, tier: "basico" | "intermedio", status: string) =>
  ({ title: concept, concept, kind: "content", status, mastery: 0, position: 0, tier }) as LearningPath["modules"][number]

const path = (id: string, phase: string, extra: Partial<LearningPath> = {}) =>
  ({ id, topic: "fracciones", modules: [], updated_at: "2026-10-01", teaching: { phase, concept: null }, ...extra }) as LearningPath

describe("clases por tramos", () => {
  it("un tramo terminado (completed con next_tier) espera la prueba de paso; sin next_tier, la ruta terminó", () => {
    const tramo = path("a", "completed", { next_tier: "intermedio", tiers: ["basico"] })
    const fin = path("b", "completed", { next_tier: null, tiers: ["basico", "intermedio", "avanzado"] })
    const groups = classGroups([tramo, fin])

    expect(tierDone(tramo)).toBe(true)
    expect(groups.needsPlacement.map((p) => p.id)).toEqual(["a"])
    expect(groups.completed.map((p) => p.id)).toEqual(["b"])
  })

  it("el tramo actual es el del concepto que toca, y su progreso cuenta solo sus módulos", () => {
    const p = path("a", "teaching", {
      tiers: ["basico", "intermedio"],
      progress: 0.5,
      modules: [mod("x", "basico", "completed"), mod("y", "basico", "completed"), mod("z", "intermedio", "in_progress"), mod("w", "intermedio", "locked")],
      teaching: { phase: "teaching", concept: "z" } as LearningPath["teaching"],
    })
    expect(currentTier(p)).toBe("intermedio")
    expect(tierProgress(p, "intermedio")).toBe(0)
    expect(tierProgress(p, "basico")).toBe(1)
  })
})

describe("cómo se cuenta el avance de una clase", () => {
  const at = (status: string, mastery: number) => ({ ...mod("x", "basico", status), mastery }) as LearningPath["modules"][number]

  it("el dominio de un concepto va en palabras, no como nota", () => {
    expect(moduleLabel(at("completed", 0.9))).toBe("Dominado")
    expect(moduleLabel(at("completed", 0.5))).toBe("Hecho")
    expect(moduleLabel(at("in_progress", 0.5))).toBe("En camino")
    expect(moduleLabel(at("in_progress", 0.1))).toBe("Empezado")
    expect(moduleLabel(at("assumed", 0))).toBe("Ya lo sabías")
    expect(moduleLabel(at("locked", 0))).toBe("Bloqueado")
    expect(moduleLabel(at("available", 0))).toBe("Por empezar")
    expect([masterySteps(at("locked", 0)), masterySteps(at("in_progress", 0.5)), masterySteps(at("completed", 0.95))]).toEqual([0, 2, 3])
  })

  it("cuándo se estudió por última vez, en relativo", () => {
    const now = new Date(2026, 9, 14, 18, 0)
    expect(lastStudied(new Date(2026, 9, 14, 9, 0).toISOString(), now)).toBe("hoy")
    expect(lastStudied(new Date(2026, 9, 13, 23, 0).toISOString(), now)).toBe("ayer")
    expect(lastStudied(new Date(2026, 9, 10, 12, 0).toISOString(), now)).toBe("hace 4 días")
    expect(lastStudied(new Date(2026, 6, 1, 12, 0).toISOString(), now)).toBe("hace 3 meses")
    expect(lastStudied(undefined, now)).toBe("")
  })

  it("una clase con tema pero aún sin estado de enseñanza sale en curso, no desaparece", () => {
    expect(classGroups([path("p9", "teaching", { teaching: null })]).inProgress.map((p) => p.id)).toEqual(["p9"])
  })
})
