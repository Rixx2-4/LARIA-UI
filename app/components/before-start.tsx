"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { lariaAPI, type AssessmentMix, type LessonOptions, type StudyCatalog, type StudyMethodKey, type StudyPaceKey } from "@/lib/laria-api"
import { PROFILE_HREF } from "@/lib/routes"
import { MixSteppers, validMix } from "./assessment-picker"
import { MethodChoices, PaceChoices } from "./study-choices"

// «Antes de empezar» (fase 3 del plan de métodos): cómo evaluar y, con los métodos
// activos, cómo estudiar (método y ritmo, ADR-055). En la clase lo elegido se guarda en
// la ruta; lo de siempre, para las clases nuevas, se cambia en el perfil

// La mezcla de siempre, si el backend tiene las abiertas activas; null si no (entonces
// no hay nada que elegir y se empieza directamente). Nunca falla: sin preferencias, null
export async function defaultAssessment(): Promise<AssessmentMix | null> {
  try {
    const prefs = await lariaAPI.learning.preferences()
    return prefs.open_questions_enabled && prefs.assessment ? prefs.assessment : null
  } catch {
    return null
  }
}

// El método y el ritmo con los que se abre la pantalla, y el catálogo para elegir
export interface StudySetup {
  catalog: StudyCatalog
  method: StudyMethodKey | null
  pace: StudyPaceKey
}

export function BeforeStart({
  intro,
  defaultMix,
  study = null,
  savedInPath = false,
  error = null,
  onStart,
}: {
  intro: string
  // null: las abiertas no están activas y no hay mezcla que elegir
  defaultMix: AssessmentMix | null
  study?: StudySetup | null
  // En la clase, lo elegido queda guardado en la ruta; en la prueba de paso, solo vale esta vez
  savedInPath?: boolean
  // Por qué no se pudo empezar con lo elegido (p. ej. un método que dejó de estar disponible)
  error?: string | null
  onStart: (choices: LessonOptions) => void
}) {
  const [mix, setMix] = useState(defaultMix)
  const [method, setMethod] = useState(study?.method ?? null)
  const [pace, setPace] = useState<StudyPaceKey>(study?.pace ?? "free")
  const change = (field: keyof AssessmentMix, delta: number) => {
    if (!mix) return
    const next = { ...mix, [field]: mix[field] + delta }
    if (validMix(next)) setMix(next)
  }
  const start = () =>
    onStart({
      ...(mix && { assessment: mix }),
      ...(study && { study_method: method, study_pace: pace }),
    })

  return (
    <section aria-labelledby="antes-de-empezar" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="antes-de-empezar" className="text-xl font-semibold">
          Antes de empezar
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      {study && (
        <>
          <MethodChoices catalog={study.catalog} value={method} onChange={setMethod} name="metodo-clase" />
          <PaceChoices catalog={study.catalog} value={pace} onChange={setPace} name="ritmo-clase" />
        </>
      )}
      {mix && (
        <div>
          <h3 className="mb-1 text-sm font-medium">Cómo te evalúo</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Las escritas las corrige LARIA y cuentan aunque aciertes solo una parte.
          </p>
          <MixSteppers mix={mix} onChange={change} />
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={start}>Empezar</Button>
        <p className="text-xs text-muted-foreground">
          {savedInPath ? "Se guarda para esta clase." : "Solo para esta vez."} Lo de siempre se cambia en{" "}
          <Link href={PROFILE_HREF} className="underline underline-offset-2 hover:text-foreground">
            tu perfil
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
