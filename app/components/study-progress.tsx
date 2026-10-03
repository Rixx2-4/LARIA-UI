"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Flame, Timer, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StudyTimeSummary } from "@/lib/laria-api"
import { LariaMascot } from "./laria-mascot"

// El objetivo de hoy como un anillo que se llena, con la racha al lado
export function DailyProgress({ summary }: { summary: StudyTimeSummary }) {
  const goal = summary.daily_goal_minutes
  const ratio = goal ? Math.min(1, summary.today_minutes / goal) : 0
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const label = goal ? `${summary.today_minutes} de ${goal} min hoy` : `${summary.today_minutes} min hoy`
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex items-center gap-2" aria-label={label}>
        {goal ? (
          <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r={radius} fill="none" className="stroke-muted" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              className={summary.goal_met_today ? "stroke-green-600 dark:stroke-green-400" : "stroke-primary"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
            />
          </svg>
        ) : null}
        <span aria-hidden>{label}</span>
      </span>
      {summary.streak_days > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground" title="Días seguidos">
          <Flame className="h-4 w-4 text-orange-500" aria-hidden />
          {summary.streak_days} {summary.streak_days === 1 ? "día" : "días"}
        </span>
      )}
    </div>
  )
}

const CONGRATS_KEY = "laria_meta_felicitada"

function today(): string {
  // La fecha local (no UTC): el objetivo es «de hoy» para quien estudia
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function alreadyCongratulated(): boolean {
  try {
    return localStorage.getItem(CONGRATS_KEY) === today()
  } catch {
    return false
  }
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

// En la clase: el cronómetro de la sesión y el progreso del día; al llegar a la
// duración elegida, si seguir o dejarlo; al cumplir el objetivo diario, LARIA lo celebra
export function ClassStudyBar({ summary, sessionSeconds }: { summary: StudyTimeSummary | null; sessionSeconds: number }) {
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const [congratsDismissed, setCongratsDismissed] = useState(false)
  // Se decide al aparecer y se recuerda: una felicitación por día
  const [congratulate] = useState(() => !alreadyCongratulated())
  const sessionMinutes = summary?.session_minutes ?? null
  const sessionDone = !!sessionMinutes && sessionSeconds >= sessionMinutes * 60

  const showCongrats = !!summary?.goal_met_today && congratulate && !congratsDismissed
  // Al aparecer queda apuntada: hoy no se vuelve a felicitar, aunque no se cierre
  useEffect(() => {
    if (!showCongrats) return
    try {
      localStorage.setItem(CONGRATS_KEY, today())
    } catch {
      // Sin almacenamiento, podría volver a felicitar hoy: no pasa nada
    }
  }, [showCongrats])

  if (!summary) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm" aria-label={`Sesión: ${formatClock(sessionSeconds)}${sessionMinutes ? ` de ${sessionMinutes} min` : ""}`}>
          <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span aria-hidden className="tabular-nums">
            {formatClock(sessionSeconds)}
            {sessionMinutes ? <span className="text-muted-foreground"> / {sessionMinutes} min</span> : null}
          </span>
        </span>
        <DailyProgress summary={summary} />
      </div>

      {sessionDone && !sessionDismissed && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Llevas {sessionMinutes} min de clase. ¿Seguimos o lo dejamos aquí? Tu sitio queda guardado.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setSessionDismissed(true)}>
              Seguir
            </Button>
            <Button size="sm" asChild>
              <Link href="/clases">Dejarlo aquí</Link>
            </Button>
          </div>
        </div>
      )}

      {showCongrats && (
        <div role="status" className="relative flex items-center gap-3 rounded-xl border border-green-600/30 bg-green-500/10 p-4">
          <LariaMascot state="speaking" className="h-14 w-14 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">¡Objetivo de hoy cumplido!</p>
            <p className="text-muted-foreground">
              {summary.today_minutes} minutos estudiados
              {summary.streak_days > 1 ? ` y ${summary.streak_days} días seguidos` : ""}. ¡Muy bien!
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCongratsDismissed(true)}
            aria-label="Cerrar"
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
