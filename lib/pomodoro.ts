// El temporizador de Pomodoro de la clase (ADR-055): un ritmo, no un método. Concentración
// y pausa se alternan; al acabar la concentración empieza sola la pausa, y al acabar la
// pausa se espera a que el alumno siga. Todo se calcula desde endsAt, así que cerrar la
// pestaña o dormir el equipo no lo desajusta

export type PomodoroPhase = "focus" | "break"

export interface PomodoroState {
  pace: string
  phase: PomodoroPhase
  running: boolean
  // Cuándo acaba la fase en marcha (ms); null en pausa
  endsAt: number | null
  // Lo que le queda a la fase detenida (ms)
  remainingMs: number
}

export interface PomodoroPace {
  key: string
  focus_minutes: number
  break_minutes: number
}

const MINUTE = 60_000
const length = (pace: PomodoroPace, phase: PomodoroPhase) => (phase === "focus" ? pace.focus_minutes : pace.break_minutes) * MINUTE

export function initialPomodoro(pace: PomodoroPace): PomodoroState {
  return { pace: pace.key, phase: "focus", running: false, endsAt: null, remainingMs: length(pace, "focus") }
}

export function startPomodoro(state: PomodoroState, now: number): PomodoroState {
  return state.running ? state : { ...state, running: true, endsAt: now + state.remainingMs }
}

export function pausePomodoro(state: PomodoroState, now: number): PomodoroState {
  return state.running && state.endsAt !== null
    ? { ...state, running: false, endsAt: null, remainingMs: Math.max(0, state.endsAt - now) }
    : state
}

export function remainingMs(state: PomodoroState, now: number): number {
  return state.running && state.endsAt !== null ? Math.max(0, state.endsAt - now) : state.remainingMs
}

// Avanza las fases que ya terminaron. ended: la última que acabó (para avisar), o null
export function tickPomodoro(state: PomodoroState, now: number, pace: PomodoroPace): { state: PomodoroState; ended: PomodoroPhase | null } {
  let current = state
  let ended: PomodoroPhase | null = null
  while (current.running && current.endsAt !== null && now >= current.endsAt) {
    if (current.phase === "focus") {
      // La pausa empieza sola, contada desde que acabó la concentración
      current = { ...current, phase: "break", endsAt: current.endsAt + length(pace, "break"), remainingMs: length(pace, "break") }
      ended = "focus"
    } else {
      // Tras la pausa, la siguiente concentración espera a que sigas
      current = { ...current, phase: "focus", running: false, endsAt: null, remainingMs: length(pace, "focus") }
      ended = "break"
    }
  }
  return { state: current, ended }
}

// 1499000 → "24:59"
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

// Se guarda por ruta; uno de otro ritmo (lo cambió) o roto se descarta
export function loadPomodoro(raw: string | null, pace: PomodoroPace): PomodoroState {
  try {
    const parsed = raw ? (JSON.parse(raw) as PomodoroState) : null
    if (parsed && parsed.pace === pace.key && (parsed.phase === "focus" || parsed.phase === "break") && typeof parsed.remainingMs === "number") {
      return parsed
    }
  } catch {
    // Se empieza de cero
  }
  return initialPomodoro(pace)
}
