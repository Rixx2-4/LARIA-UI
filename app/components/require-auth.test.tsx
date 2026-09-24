import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { RequireAuth } from "./require-auth"
import { setAuthToken } from "@/lib/laria-api"

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
  it("sin sesión muestra el login y no la página", async () => {
    renderProtectedPage()

    expect(await screen.findByText("Bienvenido de nuevo")).toBeTruthy()
    expect(screen.queryByText("Contenido privado")).toBeNull()
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

    expect(await screen.findByText("No se pudo conectar con LARIA")).toBeTruthy()
    online = true
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Contenido privado")).toBeTruthy()
  })
})
