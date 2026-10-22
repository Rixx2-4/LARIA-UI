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

  it("el icono es la cuadrícula «Loading V2» de useAnimations: 4×4, en ola por diagonales y decorativa", () => {
    render(<ThinkingIndicator />)
    const loader = screen.getByRole("status").querySelector("svg.thinking-loader")!
    expect(loader.getAttribute("aria-hidden")).toBe("true")
    const squares = [...loader.querySelectorAll("rect")]
    expect(squares).toHaveLength(16)
    // La ola empieza arriba a la izquierda y acaba abajo a la derecha
    expect(squares[0].style.getPropertyValue("--diagonal")).toBe("0")
    expect(squares[15].style.getPropertyValue("--diagonal")).toBe("6")
  })
})
