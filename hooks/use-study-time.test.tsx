import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStudyTime } from "./use-study-time"
import { setAuthToken } from "@/lib/laria-api"

const json = (body: unknown) => new Response(JSON.stringify(body))
const SUMMARY = { today_minutes: 5, daily_goal_minutes: 30, session_minutes: 20, goal_met_today: false, streak_days: 1, last_7_days: [] }

let pings: unknown[] = []
let visibility = "visible"

beforeEach(() => {
  vi.useFakeTimers()
  setAuthToken("token")
  pings = []
  visibility = "visible"
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility as DocumentVisibilityState)
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") pings.push(JSON.parse(String(init.body)))
    return json(SUMMARY)
  })
})
afterEach(() => {
  vi.useRealTimers()
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useStudyTime", () => {
  it("cuenta la sesión y avisa al backend cada minuto con la zona horaria", async () => {
    const { result } = renderHook(() => useStudyTime())
    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(result.current.sessionSeconds).toBe(60)
    expect(pings).toHaveLength(1)
    expect(pings[0]).toMatchObject({ seconds: 60, timezone: expect.any(String) })
    expect(result.current.summary?.today_minutes).toBe(5)
  })

  it("con la pestaña oculta no cuenta nada", async () => {
    visibility = "hidden"
    const { result } = renderHook(() => useStudyTime())
    await act(() => vi.advanceTimersByTimeAsync(120_000))

    expect(result.current.sessionSeconds).toBe(0)
    expect(pings).toEqual([])
  })

  it("sin actividad deja de contar, salvo mientras LARIA explica (busy)", async () => {
    const idle = renderHook(() => useStudyTime())
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    // 2 minutos de margen tras la última actividad y luego para
    expect(idle.result.current.sessionSeconds).toBeLessThanOrEqual(121)
    idle.unmount()

    pings = []
    const listening = renderHook(() => useStudyTime({ busy: true }))
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    expect(listening.result.current.sessionSeconds).toBe(300)
    expect(pings).toHaveLength(5)
  })
})
