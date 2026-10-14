import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { RequireAuth } from "./require-auth"
import { setAuthToken, setSession } from "@/lib/laria-api"

const nav = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => "/perfil",
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function renderProtectedPage() {
  return render(
    <AuthProvider>
      <RequireAuth>
        <p>Contenido privado</p>
      </RequireAuth>
    </AuthProvider>,
  )
}

afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("RequireAuth", () => {
  it("sin sesión lleva a entrar (y de vuelta a esta página después), sin enseñarla", async () => {
    setAuthToken(null)
    renderProtectedPage()

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/sign-in?redirect_url=%2Fperfil"))
    expect(screen.queryByText("Contenido privado")).toBeNull()
  })

  it("mientras Clerk no sabe si hay sesión, espera sin redirigir", () => {
    setSession("loading")
    nav.replace.mockClear()
    renderProtectedPage()

    expect(screen.getByRole("status")).toBeTruthy()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("si el backend rechaza la cuenta, dice por qué y deja cerrar sesión", async () => {
    setAuthToken("valido")
    vi.stubGlobal("fetch", async () => json({ detail: "Verifica tu correo en Clerk para entrar." }, 403))
    renderProtectedPage()

    expect(await screen.findByText("Verifica tu correo en Clerk para entrar.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }))
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/sign-in?redirect_url=%2Fperfil"))
  })

  it("con sesión muestra la página", async () => {
    setAuthToken("valido")
    vi.stubGlobal("fetch", async () => json({ id: "u1", username: "ana", email: "a@a.a" }))
    renderProtectedPage()

    expect(screen.getByRole("status")).toBeTruthy()
    expect(await screen.findByText("Contenido privado")).toBeTruthy()
  })

  it("si el servidor está dormido, explica que lo está despertando y entra cuando responde", async () => {
    vi.useFakeTimers()
    setAuthToken("valido")
    let calls = 0
    vi.stubGlobal("fetch", async () => (++calls <= 2 ? json({ detail: "Service Unavailable" }, 503) : json({ id: "u1", username: "ana", email: "a@a.a" })))
    renderProtectedPage()

    await act(() => vi.advanceTimersByTimeAsync(1_600))
    expect(screen.getByText("Despertando el servidor…")).toBeTruthy()
    expect(screen.getByRole("progressbar", { name: "Esperando al servidor" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()

    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(screen.getByText("Contenido privado")).toBeTruthy()
  })

  it("si no responde en 90 s, lo dice y ofrece reintentar; al volver, entra", async () => {
    vi.useFakeTimers()
    setAuthToken("valido")
    let online = false
    vi.stubGlobal("fetch", async () => {
      if (!online) throw new TypeError("Failed to fetch")
      return json({ id: "u1", username: "ana", email: "a@a.a" })
    })
    renderProtectedPage()

    await act(() => vi.advanceTimersByTimeAsync(100_000))
    expect(screen.getByText("El servidor no responde. Puede ser una caída temporal del proveedor.")).toBeTruthy()
    online = true
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    await act(() => vi.advanceTimersByTimeAsync(10))

    expect(screen.getByText("Contenido privado")).toBeTruthy()
  })
})
