import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react"
import { PomodoroTimer } from "./pomodoro-timer"

const pace = { key: "pomodoro_15_3", focus_minutes: 15, break_minutes: 3 }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(new Date(2026, 9, 21, 10, 0, 0))
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("PomodoroTimer", () => {
  it("cuenta, avisa sin sonido al tocar pausa y recuerda su estado por ruta", () => {
    const { unmount } = render(<PomodoroTimer pathId="p1" pace={pace} />)
    expect(screen.getByRole("timer").textContent).toBe("15:00")
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole("timer").textContent).toBe("14:00")
    act(() => {
      vi.advanceTimersByTime(14 * 60_000)
    })
    expect(screen.getByText("Pausa")).toBeTruthy()
    expect(screen.getByText(/Toca descansar 3 minutos/)).toBeTruthy()
    unmount()
    // Al volver a la clase sigue donde estaba
    render(<PomodoroTimer pathId="p1" pace={pace} />)
    expect(screen.getByText("Pausa")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pausar" })).toBeTruthy()
  })

  it("cada ruta tiene el suyo", () => {
    render(<PomodoroTimer pathId="p1" pace={pace} />)
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }))
    cleanup()
    render(<PomodoroTimer pathId="p2" pace={pace} />)
    expect(screen.getByRole("button", { name: "Empezar" })).toBeTruthy()
  })
})
