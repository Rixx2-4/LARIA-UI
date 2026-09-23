import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import type { ReactNode } from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "./auth-context"
import { lariaAPI, setAuthToken } from "@/lib/laria-api"

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const ana = { id: "u1", username: "ana", email: "a@a.a" }

beforeEach(() => setAuthToken("token-de-prueba"))
afterEach(() => {
  setAuthToken(null)
  vi.unstubAllGlobals()
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

  it("si no hay conexión al arrancar, no entra sin usuario y permite reintentar", async () => {
    let online = false
    vi.stubGlobal("fetch", async () => {
      if (!online) throw new TypeError("Failed to fetch")
      return json(ana)
    })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.connectionError).toBe("No se pudo conectar con LARIA")

    online = true
    await act(() => result.current.retry())

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.connectionError).toBeNull()
  })
})
