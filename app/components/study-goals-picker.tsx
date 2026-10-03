"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { lariaAPI, type DailyGoalMinutes, type SessionMinutes, type StudyGoals } from "@/lib/laria-api"

// Cuánto estudiar: la duración de cada clase y el objetivo de minutos al día. Se
// guarda al tocar (en el perfil, vale en cualquier dispositivo). Sin el endpoint
// (backend anterior) no se muestra nada

const SESSION_OPTIONS: { value: SessionMinutes | null; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: null, label: "Sin límite" },
]

const DAILY_OPTIONS: { value: DailyGoalMinutes | null; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: null, label: "Sin objetivo" },
]

function Chips<T>({
  label,
  options,
  value,
  onChoose,
  disabled,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChoose: (value: T) => void
  disabled: boolean
}) {
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value !== undefined && value === option.value
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChoose(option.value)}
              aria-pressed={selected}
              disabled={disabled}
              className={`rounded-full border px-3 py-1 text-[13px] transition-colors disabled:opacity-60 ${
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StudyGoalsPicker({ className = "" }: { className?: string }) {
  const [goals, setGoals] = useState<StudyGoals | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    lariaAPI.study
      .goals()
      .then((loaded) => !cancelled && setGoals(loaded))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!goals) return null

  const save = async (next: StudyGoals) => {
    const previous = goals
    setGoals(next)
    setSaving(true)
    try {
      await lariaAPI.study.setGoals(next)
    } catch (error) {
      setGoals(previous)
      toast.error("No se pudo guardar", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Chips
        label="¿Cuánto quieres que dure cada clase?"
        options={SESSION_OPTIONS}
        value={goals.session_minutes}
        onChoose={(session_minutes) => save({ ...goals, session_minutes })}
        disabled={saving}
      />
      <Chips
        label="¿Cuánto quieres estudiar al día?"
        options={DAILY_OPTIONS}
        value={goals.daily_goal_minutes}
        onChoose={(daily_goal_minutes) => save({ ...goals, daily_goal_minutes })}
        disabled={saving}
      />
    </div>
  )
}
