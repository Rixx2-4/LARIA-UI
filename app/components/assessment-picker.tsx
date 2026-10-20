"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Minus, Plus } from "lucide-react"
import { lariaAPI, type AssessmentMix } from "@/lib/laria-api"

// Cómo te evalúa LARIA: cuántas preguntas escritas (las corrige la IA, con crédito
// parcial) y cuántas de opción lleva cada comprobación de clase y cada práctica. Se
// guarda al tocar. Solo aparece si el backend tiene las abiertas activas: con el
// interruptor apagado el valor se guardaría pero no cambiaría nada (ADR-052)

const MAX_EACH = 10
const MAX_TOTAL = 12

// Lo que acepta el servidor: cada valor de 0 a 10 y entre los dos de 1 a 12
export function validMix(mix: AssessmentMix): boolean {
  const total = mix.open_questions + mix.choice_questions
  return (
    [mix.open_questions, mix.choice_questions].every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_EACH) &&
    total >= 1 &&
    total <= MAX_TOTAL
  )
}

export function AssessmentPicker() {
  const [mix, setMix] = useState<AssessmentMix | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    lariaAPI.learning
      .preferences()
      .then((prefs) => !cancelled && prefs.open_questions_enabled && prefs.assessment && setMix(prefs.assessment))
      // Sin preferencias no hay nada que ajustar
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!mix) return null

  const change = async (field: keyof AssessmentMix, delta: number) => {
    const next = { ...mix, [field]: mix[field] + delta }
    if (!validMix(next)) return
    const previous = mix
    setMix(next)
    setSaving(true)
    try {
      await lariaAPI.learning.setAssessment(next)
    } catch {
      setMix(previous)
      toast.error("No se pudo guardar cómo quieres que te evalúe")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-border p-4" aria-labelledby="como-te-evalua">
      <h2 id="como-te-evalua" className="text-sm font-semibold">
        Cómo te evalúo
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Las preguntas de cada comprobación de clase y de cada práctica. Las escritas las corrige LARIA y cuentan aunque
        aciertes solo una parte.
      </p>
      <MixSteppers mix={mix} onChange={change} disabled={saving} />
    </section>
  )
}

// Los dos contadores (escritas y de opción), que solo dejan llegar a mezclas válidas
export function MixSteppers({
  mix,
  onChange,
  disabled = false,
}: {
  mix: AssessmentMix
  onChange: (field: keyof AssessmentMix, delta: number) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stepper
          label="Para escribir"
          value={mix.open_questions}
          onMinus={() => onChange("open_questions", -1)}
          onPlus={() => onChange("open_questions", 1)}
          canMinus={validMix({ ...mix, open_questions: mix.open_questions - 1 })}
          canPlus={validMix({ ...mix, open_questions: mix.open_questions + 1 })}
          disabled={disabled}
        />
        <Stepper
          label="De opción múltiple"
          value={mix.choice_questions}
          onMinus={() => onChange("choice_questions", -1)}
          onPlus={() => onChange("choice_questions", 1)}
          canMinus={validMix({ ...mix, choice_questions: mix.choice_questions - 1 })}
          canPlus={validMix({ ...mix, choice_questions: mix.choice_questions + 1 })}
          disabled={disabled}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Entre las dos, de 1 a {MAX_TOTAL} preguntas.</p>
    </>
  )
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  canMinus,
  canPlus,
  disabled,
}: {
  label: string
  value: number
  onMinus: () => void
  onPlus: () => void
  canMinus: boolean
  canPlus: boolean
  disabled: boolean
}) {
  const button =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={button} onClick={onMinus} disabled={disabled || !canMinus} aria-label={`Una menos ${label.toLowerCase()}`}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <output aria-live="polite" className="w-6 text-center font-semibold tabular-nums">
          {value}
        </output>
        <button type="button" className={button} onClick={onPlus} disabled={disabled || !canPlus} aria-label={`Una más ${label.toLowerCase()}`}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
