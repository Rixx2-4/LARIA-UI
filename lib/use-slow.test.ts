import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSlow } from "./use-slow"

afterEach(() => vi.useRealTimers())

describe("useSlow", () => {
  it("avisa solo si la espera pasa del tiempo, y se olvida al terminar", () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ active }) => useSlow(active, 5000), { initialProps: { active: true } })
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(true)
    rerender({ active: false })
    expect(result.current).toBe(false)
  })
})
