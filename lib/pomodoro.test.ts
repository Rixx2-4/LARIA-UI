import { describe, it, expect } from "vitest"
import { formatClock, initialPomodoro, loadPomodoro, pausePomodoro, remainingMs, startPomodoro, tickPomodoro } from "./pomodoro"

const pace = { key: "pomodoro_25_5", focus_minutes: 25, break_minutes: 5 }
const MIN = 60_000

describe("pomodoro", () => {
  it("empieza detenido con la concentración entera, y pausar guarda lo que queda", () => {
    const fresh = initialPomodoro(pace)
    expect(fresh).toMatchObject({ phase: "focus", running: false, remainingMs: 25 * MIN })
    const running = startPomodoro(fresh, 0)
    expect(remainingMs(running, 10 * MIN)).toBe(15 * MIN)
    const paused = pausePomodoro(running, 10 * MIN)
    expect(remainingMs(paused, 99 * MIN)).toBe(15 * MIN)
  })

  it("al acabar la concentración empieza sola la pausa; tras la pausa se espera", () => {
    const running = startPomodoro(initialPomodoro(pace), 0)
    const toBreak = tickPomodoro(running, 25 * MIN, pace)
    expect(toBreak.ended).toBe("focus")
    expect(toBreak.state).toMatchObject({ phase: "break", running: true, endsAt: 30 * MIN })
    const toFocus = tickPomodoro(toBreak.state, 30 * MIN, pace)
    expect(toFocus.ended).toBe("break")
    expect(toFocus.state).toMatchObject({ phase: "focus", running: false, remainingMs: 25 * MIN })
  })

  it("si se cerró la pestaña, al volver salta las fases ya pasadas sin desajustarse", () => {
    const running = startPomodoro(initialPomodoro(pace), 0)
    expect(tickPomodoro(running, 27 * MIN, pace).state).toMatchObject({ phase: "break", endsAt: 30 * MIN })
    expect(tickPomodoro(running, 3 * 60 * MIN, pace).state).toMatchObject({ phase: "focus", running: false })
  })

  it("lo guardado de otro ritmo o roto se descarta", () => {
    const other = JSON.stringify({ ...initialPomodoro({ key: "pomodoro_15_3", focus_minutes: 15, break_minutes: 3 }) })
    expect(loadPomodoro(other, pace).remainingMs).toBe(25 * MIN)
    expect(loadPomodoro("{roto", pace).remainingMs).toBe(25 * MIN)
    expect(formatClock(25 * MIN - 1000)).toBe("24:59")
  })
})
