"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Pause, Play, RotateCcw, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatClock,
  initialPomodoro,
  loadPomodoro,
  pausePomodoro,
  remainingMs,
  startPomodoro,
  tickPomodoro,
  type PomodoroPace,
  type PomodoroState,
} from "@/lib/pomodoro"

// El temporizador del ritmo Pomodoro en la clase (ADR-055). Sin sonido: avisa con un
// mensaje que leen los lectores de pantalla y uno visible. Su estado se guarda por ruta,
// así que recargar o volver otro día lo deja donde estaba

const storageKey = (pathId: string) => `laria_pomodoro:${pathId}`

function save(pathId: string, state: PomodoroState) {
  try {
    localStorage.setItem(storageKey(pathId), JSON.stringify(state))
  } catch {
    // Sin almacenamiento dura solo esta visita
  }
}

function read(pathId: string): string | null {
  try {
    return localStorage.getItem(storageKey(pathId))
  } catch {
    return null
  }
}

const ENDED_MESSAGE = {
  focus: (pace: PomodoroPace) => `Toca descansar ${pace.break_minutes} minutos. Levántate, estira o bebe agua.`,
  break: () => "Se acabó la pausa. Sigue cuando quieras.",
}

export function PomodoroTimer({ pathId, pace }: { pathId: string; pace: PomodoroPace }) {
  const [state, setState] = useState<PomodoroState>(() => initialPomodoro(pace))
  const [now, setNow] = useState(() => Date.now())
  const [announcement, setAnnouncement] = useState("")
  // El estado al día para el intervalo, sin recrearlo en cada segundo
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // localStorage solo existe en el cliente: se lee al montar (o al cambiar de ritmo)
  useEffect(() => {
    const loaded = tickPomodoro(loadPomodoro(read(pathId), pace), Date.now(), pace).state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded)
  }, [pathId, pace])

  useEffect(() => {
    if (!state.running) return
    const id = setInterval(() => {
      const at = Date.now()
      setNow(at)
      const { state: next, ended } = tickPomodoro(stateRef.current, at, pace)
      if (!ended) return
      stateRef.current = next
      setState(next)
      save(pathId, next)
      const message = ENDED_MESSAGE[ended](pace)
      setAnnouncement(message)
      toast(message)
    }, 1000)
    return () => clearInterval(id)
  }, [state.running, pace, pathId])

  const update = (next: PomodoroState) => {
    setNow(Date.now())
    setState(next)
    save(pathId, next)
  }

  const left = remainingMs(state, now)
  const label = state.phase === "focus" ? "Concentración" : "Pausa"
  const fresh = !state.running && state.phase === "focus" && left === pace.focus_minutes * 60_000

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
      <Timer className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>{" "}
        <span role="timer" aria-label={`${label}: quedan ${formatClock(left)}`} className="tabular-nums">
          {formatClock(left)}
        </span>
        <span className="text-muted-foreground"> · Pomodoro {pace.focus_minutes}/{pace.break_minutes}</span>
      </div>
      <div className="flex gap-1">
        {state.running ? (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => update(pausePomodoro(state, Date.now()))}>
            <Pause className="h-4 w-4" aria-hidden />
            Pausar
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => update(startPomodoro(state, Date.now()))}>
            <Play className="h-4 w-4" aria-hidden />
            {fresh ? "Empezar" : "Seguir"}
          </Button>
        )}
        {!fresh && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => update(initialPomodoro(pace))} aria-label="Reiniciar el temporizador">
            <RotateCcw className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
