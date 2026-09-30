import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
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

  it("sin conexión ofrece reintentar y, al volver la red, entra", async () => {
    setAuthToken("valido")
    let online = false
    vi.stubGlobal("fetch", async () => {
      if (!online) throw new TypeError("Failed to fetch")
      return json({ id: "u1", username: "ana", email: "a@a.a" })
    })
    renderProtectedPage()

    expect(await screen.findByText("No se pudo conectar con Plenum")).toBeTruthy()
    online = true
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Contenido privado")).toBeTruthy()
  })
})
