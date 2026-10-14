import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import type { ReactNode } from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { AuthProvider, SERVER_DOWN_MESSAGE, WAKE_DEADLINE_MS, useAuth } from "./auth-context"
import { lariaAPI, setAuthToken } from "@/lib/laria-api"

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const ana = { id: "u1", username: "ana", email: "a@a.a" }

beforeEach(() => setAuthToken("token-de-prueba"))
afterEach(() => {
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("AuthProvider", () => {
  it("un 401 en cualquier petición cierra la sesión", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/users/me")) return json(ana)
      return json({ detail: "Token inválido o expirado" }, 401)
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).toMatchObject({ username: "ana" }))

    await act(() => lariaAPI.chats.list().catch(() => {}))

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  // El servidor puede estar dormido (Render): se insiste hasta 90 s antes de dar error
  it("si el servidor no responde, sigue intentándolo; pasado el tope, lo explica y deja reintentar", async () => {
    vi.useFakeTimers()
    let online = false
    vi.stubGlobal("fetch", async () => {
      if (!online) throw new TypeError("Failed to fetch")
      return json(ana)
    })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(result.current.connectionError).toBeNull()
    expect(result.current.wakingSince).not.toBeNull()
    expect(result.current.isLoading).toBe(true)

    await act(() => vi.advanceTimersByTimeAsync(WAKE_DEADLINE_MS))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.wakingSince).toBeNull()
    expect(result.current.connectionError).toBe(SERVER_DOWN_MESSAGE)

    online = true
    await act(() => result.current.retry())
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.connectionError).toBeNull()
  })

  it("un 503 (el servidor despertando) seguido de un 200 entra sin mostrar ningún error", async () => {
    vi.useFakeTimers()
    let calls = 0
    vi.stubGlobal("fetch", async () => (++calls <= 2 ? json({ detail: "Service Unavailable" }, 503) : json(ana)))
    const errors: (string | null)[] = []
    const { result } = renderHook(() => {
      const auth = useAuth()
      errors.push(auth.connectionError)
      return auth
    }, { wrapper })

    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(result.current.isAuthenticated).toBe(true)
    expect(errors.every((error) => error === null)).toBe(true)
  })

  it("un 401 no se reintenta: cierra la sesión", async () => {
    vi.useFakeTimers()
    let calls = 0
    vi.stubGlobal("fetch", async () => {
      calls++
      return json({ detail: "Token inválido o expirado" }, 401)
    })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    // La petición y su repetición con un token nuevo; nada más
    expect(calls).toBe(2)
    expect(result.current.wakingSince).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("un rechazo del backend (403) se muestra a la primera, sin esperar", async () => {
    let calls = 0
    vi.stubGlobal("fetch", async () => {
      calls++
      return json({ detail: "Verifica tu correo en Clerk para entrar." }, 403)
    })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.connectionError).toBe("Verifica tu correo en Clerk para entrar."))
    expect(calls).toBe(1)
  })

  it("reintentar cuando la sesión ya no existe lleva al login, no se queda atascado", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch")
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => vi.advanceTimersByTimeAsync(WAKE_DEADLINE_MS + 10_000))
    expect(result.current.connectionError).not.toBeNull()

    setAuthToken(null) // p. ej. cerró sesión en otra pestaña
    await act(() => result.current.retry())

    expect(result.current.connectionError).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})
