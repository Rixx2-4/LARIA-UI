import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { getAuthToken, setAuthToken } from "@/lib/laria-api"
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
  setAuthToken(null)
  delete window.google
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// Google Identity Services de mentira: su «botón» entrega un ID token al pulsarlo
function fakeGoogle() {
  const initialized: { client_id: string }[] = []
  let callback: (response: { credential: string }) => void = () => {}
  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          initialized.push({ client_id: config.client_id })
          callback = config.callback
        },
        renderButton: (parent) => {
          const button = document.createElement("button")
          button.textContent = "Continuar con Google"
          button.onclick = () => callback({ credential: "google-id-token" })
          parent.appendChild(button)
        },
      },
    },
  }
  return initialized
}

describe("LoginScreen", () => {
  it("al registrarse pide lo mismo que el backend y no envía una contraseña que no lo cumple", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    renderRegister()

    fireEvent.change(screen.getByPlaceholderText("Mínimo 8 caracteres"), { target: { value: "abcdefg1" } })
    expect(screen.getByText("Una mayúscula").textContent).toContain("(pendiente)")
    expect(screen.getByText("Al menos 8 caracteres").textContent).toContain("(cumplido)")

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }))

    expect((await screen.findByRole("alert")).textContent).toBe("La contraseña no cumple todos los requisitos.")
    // Solo la consulta de formas de entrar; nada de registro
    expect(fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !url.endsWith("/auth/providers"))).toEqual([])
  })

  it("al iniciar sesión no impone un mínimo ni muestra los requisitos", () => {
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>,
    )

    const password = screen.getByPlaceholderText("Tu contraseña")
    expect(password.getAttribute("minlength")).toBeNull()
    expect(screen.queryByText("Al menos 8 caracteres")).toBeNull()
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

  it("tiene una X (y el logo) para volver a la página de presentación", () => {
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>,
    )

    expect(screen.getByRole("link", { name: "Cerrar y volver a la página de inicio" }).getAttribute("href")).toBe("/")
    expect(screen.getByRole("link", { name: "Plenum, página de inicio" }).getAttribute("href")).toBe("/")
  })

  describe("continuar con Google", () => {
    it("con el client id del backend muestra el botón y entra con el ID token de Google", async () => {
      const initialized = fakeGoogle()
      const posted: unknown[] = []
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/providers")) return json({ google_client_id: "abc.apps.googleusercontent.com" })
        if (url.endsWith("/auth/google")) {
          posted.push(JSON.parse(String(init?.body)))
          return json({ access_token: "plenum-token", token_type: "bearer" })
        }
        if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "ana@gmail.com" })
        throw new Error(`Petición inesperada: ${url}`)
      })
      render(
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>,
      )

      fireEvent.click(await screen.findByText("Continuar con Google"))

      await waitFor(() => expect(getAuthToken()).toBe("plenum-token"))
      expect(posted).toEqual([{ id_token: "google-id-token" }])
      expect(initialized).toEqual([{ client_id: "abc.apps.googleusercontent.com" }])
    })

    it("si Google no está configurado (null) o el backend no lo conoce (404), no hay botón", async () => {
      for (const providers of [json({ google_client_id: null }), json({ detail: "Not Found" }, 404)]) {
        const fetchMock = vi.fn(async () => providers)
        vi.stubGlobal("fetch", fetchMock)
        render(
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>,
        )
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(screen.queryByTestId("google-button")).toBeNull()
        cleanup()
      }
    })

    it("si el backend rechaza el token de Google, lo dice sin entrar", async () => {
      fakeGoogle()
      vi.stubGlobal("fetch", async (url: string) => {
        if (url.endsWith("/auth/providers")) return json({ google_client_id: "abc.apps.googleusercontent.com" })
        if (url.endsWith("/auth/google")) return json({ detail: "Invalid token" }, 401)
        throw new Error(`Petición inesperada: ${url}`)
      })
      render(
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>,
      )

      fireEvent.click(await screen.findByText("Continuar con Google"))

      expect((await screen.findByRole("alert")).textContent).toBe("Google no pudo confirmar tu cuenta. Prueba de nuevo.")
      expect(getAuthToken()).toBeNull()
    })
  })

  it("demasiados intentos de login: muestra el aviso del backend (espera de 15 minutos)", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/auth/token"))
        return json({ detail: "Demasiados intentos para esta cuenta. Espera 15 minutos y vuelve a intentarlo." }, 429)
      return json({ google_client_id: null })
    })
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>,
    )
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), { target: { value: "ana@example.com" } })
    fireEvent.change(screen.getByPlaceholderText("Tu contraseña"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }))

    expect((await screen.findByRole("alert")).textContent).toBe("Demasiados intentos para esta cuenta. Espera 15 minutos y vuelve a intentarlo.")
  })
})
