import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, act, cleanup } from "@testing-library/react"
import { ThinkingIndicator, THINKING_PHRASES } from "./thinking-indicator"

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("ThinkingIndicator", () => {
  it("empieza con \"Pensando…\" y va rotando frases mientras espera", () => {
    render(<ThinkingIndicator />)
    const status = screen.getByRole("status")
    expect(status.textContent).toContain("Pensando…")

    act(() => vi.advanceTimersByTime(2500))
    const second = status.textContent
    expect(second).not.toContain("Pensando…")
    expect(THINKING_PHRASES.some((p) => second?.includes(p))).toBe(true)

    act(() => vi.advanceTimersByTime(2500))
    expect(status.textContent).not.toBe(second)
  })

  it("si el tutor dice qué está haciendo, muestra eso en lugar de las frases", () => {
    render(<ThinkingIndicator label="Buscando en tus apuntes" />)

    expect(screen.getByRole("status").textContent).toContain("Buscando en tus apuntes")
    act(() => vi.advanceTimersByTime(6000))
    expect(screen.getByRole("status").textContent).toContain("Buscando en tus apuntes")
  })
})
