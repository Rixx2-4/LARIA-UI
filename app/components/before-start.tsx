"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { lariaAPI, type AssessmentMix } from "@/lib/laria-api"
import { PROFILE_HREF } from "@/lib/routes"
import { MixSteppers, validMix } from "./assessment-picker"

// «Antes de empezar» (fase 3 del plan de métodos): se elige cómo evaluar esta sesión
// sin cambiar lo de siempre, que se guarda en el perfil. De momento solo la mezcla de
// preguntas; el método y el ritmo se añadirán aquí

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

export function BeforeStart({
  intro,
  defaultMix,
  onStart,
}: {
  intro: string
  defaultMix: AssessmentMix
  onStart: (mix: AssessmentMix) => void
}) {
  const [mix, setMix] = useState(defaultMix)
  const change = (field: keyof AssessmentMix, delta: number) => {
    const next = { ...mix, [field]: mix[field] + delta }
    if (validMix(next)) setMix(next)
  }

  return (
    <section aria-labelledby="antes-de-empezar" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="antes-de-empezar" className="text-xl font-semibold">
          Antes de empezar
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium">Cómo te evalúo</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Las escritas las corrige LARIA y cuentan aunque aciertes solo una parte.
        </p>
        <MixSteppers mix={mix} onChange={change} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={() => onStart(mix)}>Empezar</Button>
        <p className="text-xs text-muted-foreground">
          Solo para esta vez. Lo de siempre se cambia en{" "}
          <Link href={PROFILE_HREF} className="underline underline-offset-2 hover:text-foreground">
            tu perfil
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
