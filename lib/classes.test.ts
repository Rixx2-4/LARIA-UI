import { describe, it, expect } from "vitest"
import { classGroups, currentTier, tierDone, tierProgress } from "./classes"
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
