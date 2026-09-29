"use client"

import { Check } from "lucide-react"
import type { ExplanationStyle } from "@/lib/laria-api"

// Cómo prefiere el estudiante que LARIA le explique. Los valores son los estilos del
// backend (CognitiveStyle); null deja que LARIA lo deduzca. Vale para todos los temas.
export const STYLE_OPTIONS: { value: ExplanationStyle | null; label: string; hint: string }[] = [
  { value: "simple", label: "Sencillo", hint: "Sin tecnicismos" },
  { value: "step_by_step", label: "Paso a paso", hint: "Un paso cada vez" },
  { value: "analogy", label: "Con ejemplos y analogías", hint: "Comparado con cosas conocidas" },
  { value: "visual", label: "Con esquemas y dibujos", hint: "Estructuras que se ven" },
  { value: "mathematical", label: "Con fórmulas", hint: "Y sus demostraciones" },
  { value: "technical", label: "Técnico y riguroso", hint: "Con la precisión del libro" },
  { value: null, label: "Que lo decida LARIA", hint: "Según cómo te vaya" },
]

interface StylePickerProps {
  value: ExplanationStyle | null | undefined
  onChoose: (style: ExplanationStyle | null) => void
  disabled?: boolean
  compact?: boolean
}

export function StylePicker({ value, onChoose, disabled = false, compact = false }: StylePickerProps) {
  return (
    <div role="group" aria-label="Cómo prefieres que te explique" className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {STYLE_OPTIONS.map((option) => {
        const selected = value !== undefined && value === option.value
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChoose(option.value)}
            aria-pressed={selected}
            disabled={disabled}
            className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
              selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <span>
              <span className="block text-[13.5px] font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
            {selected && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
