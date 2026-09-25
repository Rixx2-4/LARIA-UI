import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { LoginScreen } from "./login-screen"

function renderRegister() {
  render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>,
  )
  fireEvent.click(screen.getByRole("button", { name: "Regístrate" }))
  fireEvent.change(screen.getByPlaceholderText("Tu nombre de usuario"), { target: { value: "ana" } })
  fireEvent.change(screen.getByPlaceholderText("tu@email.com"), { target: { value: "ana@example.com" } })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("LoginScreen", () => {
  it("al registrarse pide lo mismo que el backend y no envía una contraseña que no lo cumple", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    renderRegister()

    fireEvent.change(screen.getByPlaceholderText("Mínimo 12 caracteres"), { target: { value: "abcdefgh1234" } })
    expect(screen.getByText("Una mayúscula").textContent).toContain("(pendiente)")
    expect(screen.getByText("Al menos 12 caracteres").textContent).toContain("(cumplido)")

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }))

    expect((await screen.findByRole("alert")).textContent).toBe("La contraseña no cumple todos los requisitos.")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("al iniciar sesión no impone un mínimo ni muestra los requisitos", () => {
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>,
    )

    const password = screen.getByPlaceholderText("Tu contraseña")
    expect(password.getAttribute("minlength")).toBeNull()
    expect(screen.queryByText("Al menos 12 caracteres")).toBeNull()
  })

  it("desde «Crear cuenta» de la presentación (?modo=registro) abre directamente el registro", () => {
    window.history.replaceState(null, "", "/chat?modo=registro")
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>,
    )

    expect(screen.getByText("Crea tu cuenta")).toBeTruthy()
    window.history.replaceState(null, "", "/")
  })
})
