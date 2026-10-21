"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { lariaAPI, type StudyCatalog, type StudyMethodKey, type StudyPaceKey } from "@/lib/laria-api"
import { MethodChoices, PaceChoices } from "./study-choices"

// Cómo estudias por defecto (ADR-055): el método y el ritmo con los que se abren las
// clases nuevas. Cada clase guarda luego lo suyo desde «Antes de empezar». Se guarda al
// tocar. Solo aparece con los métodos activos

interface Defaults {
  method: StudyMethodKey | null
  pace: StudyPaceKey
}

export function StudyDefaultsPicker() {
  const [catalog, setCatalog] = useState<StudyCatalog | null>(null)
  const [defaults, setDefaults] = useState<Defaults | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const prefs = await lariaAPI.learning.preferences()
      if (!prefs.study_methods_enabled) return
      const loaded = await lariaAPI.learning.studyMethods()
      if (cancelled) return
      setCatalog(loaded)
      setDefaults({ method: prefs.study_method ?? null, pace: prefs.study_pace ?? loaded.default_pace })
    })()
      // Sin preferencias o sin catálogo no hay nada que ajustar
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!catalog || !defaults) return null

  const save = async (next: Defaults) => {
    const previous = defaults
    setDefaults(next)
    setSaving(true)
    try {
      await lariaAPI.learning.setStudyDefaults({ study_method: next.method, study_pace: next.pace })
    } catch {
      setDefaults(previous)
      toast.error("No se pudo guardar cómo quieres estudiar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border p-4" aria-labelledby="como-estudias">
      <div>
        <h2 id="como-estudias" className="text-sm font-semibold">
          Cómo estudias
        </h2>
        <p className="text-xs text-muted-foreground">
          Con lo que se abren tus clases nuevas. En cada clase puedes cambiarlo antes de empezar.
        </p>
      </div>
      <MethodChoices
        catalog={catalog}
        value={defaults.method}
        onChange={(method) => save({ ...defaults, method })}
        name="metodo-perfil"
        disabled={saving}
      />
      <PaceChoices catalog={catalog} value={defaults.pace} onChange={(pace) => save({ ...defaults, pace })} name="ritmo-perfil" disabled={saving} />
    </section>
  )
}
