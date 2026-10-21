"use client"

import type { StudyCatalog, StudyMethodKey, StudyPaceKey } from "@/lib/laria-api"

// Elegir método de estudio y ritmo (ADR-055), en «Antes de empezar» y en el perfil.
// Los textos son del backend. Un método no disponible se ve desactivado con su motivo;
// el recomendado lleva una etiqueta, pero nunca se marca solo. Sin elegir = «que
// decida LARIA» (null), que deja la clase como siempre

export function MethodChoices({
  catalog,
  value,
  onChange,
  name,
  disabled = false,
}: {
  catalog: StudyCatalog
  value: StudyMethodKey | null
  onChange: (method: StudyMethodKey | null) => void
  // Para agrupar los radios (dos grupos en la misma página no se pisan)
  name: string
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Método de estudio</legend>
      <Option
        name={name}
        checked={value === null}
        onSelect={() => onChange(null)}
        title="Que decida LARIA"
        detail="La clase de siempre: explicación y comprobación."
      />
      {catalog.methods.map((method) => (
        <Option
          key={method.key}
          name={name}
          checked={value === method.key}
          onSelect={() => onChange(method.key)}
          title={method.name}
          detail={method.summary}
          badge={method.recommended ? method.recommended_text ?? "Recomendado" : null}
          unavailable={method.available ? null : method.unavailable_text ?? "No disponible ahora"}
        />
      ))}
    </fieldset>
  )
}

export function PaceChoices({
  catalog,
  value,
  onChange,
  name,
  disabled = false,
}: {
  catalog: StudyCatalog
  value: StudyPaceKey
  onChange: (pace: StudyPaceKey) => void
  name: string
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Ritmo</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {catalog.paces.map((pace) => (
          <Option
            key={pace.key}
            name={name}
            checked={value === pace.key}
            onSelect={() => onChange(pace.key)}
            title={pace.name}
            detail={
              pace.focus_minutes && pace.break_minutes
                ? `${pace.focus_minutes} min de estudio y ${pace.break_minutes} de pausa`
                : "Sin temporizador: paras cuando quieras"
            }
          />
        ))}
      </div>
    </fieldset>
  )
}

function Option({
  name,
  checked,
  onSelect,
  title,
  detail,
  badge = null,
  unavailable = null,
}: {
  name: string
  checked: boolean
  onSelect: () => void
  title: string
  detail: string
  badge?: string | null
  unavailable?: string | null
}) {
  return (
    <label
      className={`flex gap-3 rounded-xl border p-3 text-sm transition-colors ${
        unavailable
          ? "cursor-not-allowed border-border opacity-60"
          : checked
            ? "cursor-pointer border-primary bg-primary/5"
            : "cursor-pointer border-border hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        disabled={!!unavailable}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge && <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{badge}</span>}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
        {unavailable && <span className="block text-xs text-muted-foreground">{unavailable}</span>}
      </span>
    </label>
  )
}
