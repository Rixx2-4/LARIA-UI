import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDocuments } from "./use-documents"
import { setAuthToken } from "@/lib/laria-api"

const doc = (status: string, has_analysis = false) => ({
  id: "d1", owner_id: "u1", filename: "tema1.pdf", subject: "Ciencias",
  status, uploaded_at: "", has_analysis, error_message: null,
})

beforeEach(() => {
  vi.useFakeTimers()
  setAuthToken("token")
})
afterEach(() => {
  vi.useRealTimers()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

// El servidor responde cada vez con el siguiente estado de la lista
function stubStatuses(...statuses: string[]) {
  let calls = 0
  vi.stubGlobal("fetch", async () => {
    const status = statuses[Math.min(calls, statuses.length - 1)]
    calls++
    return new Response(JSON.stringify([doc(status)]), { status: 200 })
  })
  return () => calls
}

describe("useDocuments", () => {
  it("mientras un documento se procesa, vuelve a consultar hasta que termina", async () => {
    const calls = stubStatuses("processing", "processing", "analyzed")
    const { result } = renderHook(() => useDocuments(true))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.documents[0].status).toBe("processing")

    await act(() => vi.advanceTimersByTimeAsync(3000))
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current.documents[0].status).toBe("analyzed")

    await act(() => vi.advanceTimersByTimeAsync(30000))
    expect(calls()).toBe(3)
  })

  it("si no está activo, no consulta nada", async () => {
    const calls = stubStatuses("processing")
    renderHook(() => useDocuments(false))

    await act(() => vi.advanceTimersByTimeAsync(10000))
    expect(calls()).toBe(0)
  })

  it("un fallo de red momentáneo no detiene la consulta ni vacía la lista", async () => {
    let calls = 0
    vi.stubGlobal("fetch", async () => {
      calls++
      if (calls === 2) throw new TypeError("Failed to fetch")
      return new Response(JSON.stringify([doc(calls >= 3 ? "analyzed" : "processing")]), { status: 200 })
    })
    const { result } = renderHook(() => useDocuments(true))

    await act(() => vi.advanceTimersByTimeAsync(0))
    await act(() => vi.advanceTimersByTimeAsync(3000)) // falla
    expect(result.current.documents[0].status).toBe("processing")

    await act(() => vi.advanceTimersByTimeAsync(10000))
    expect(result.current.documents[0].status).toBe("analyzed")
  })
})
