import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import LandingPage from "./page"

const nav = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => "/",
}))
// next/font solo funciona dentro de Next
vi.mock("next/font/google", () => ({ Instrument_Serif: () => ({ variable: "font-display-test" }) }))

beforeEach(() => nav.replace.mockReset())
afterEach(() => {
  cleanup()
  document.cookie = "__client_uat=0; path=/"
  document.cookie = "__client_uat_abc123=0; path=/"
})

describe("Página de presentación", () => {
  it("cuenta qué es LARIA y lleva a crear cuenta o a entrar", () => {
    render(<LandingPage />)

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Un tutor que se adapta a cómo aprendes")
    // La plataforma es Plenum; LARIA es su tutor
    expect(screen.getByRole("link", { name: "Plenum, inicio" })).toBeTruthy()
    expect(screen.getAllByText(/LARIA/).length).toBeGreaterThan(0)
    // Los dos caminos: con material y sin material
    expect(screen.getByRole("heading", { name: "Con tu material" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Sin material" })).toBeTruthy()
    const signUp = screen.getAllByRole("link", { name: /Crear cuenta/ })
    expect(signUp.length).toBeGreaterThan(0)
    // Crear cuenta y entrar: las pantallas de Clerk
    signUp.forEach((link) => expect(link.getAttribute("href")).toBe("/sign-up"))
    expect(screen.getByRole("link", { name: "Ya tengo cuenta" }).getAttribute("href")).toBe("/sign-in")
    screen.getAllByRole("link", { name: "Entrar" }).forEach((link) => expect(link.getAttribute("href")).toBe("/sign-in"))
  })

  it("quien ya tiene sesión (cookie de Clerk) va directo a la app", async () => {
    document.cookie = "__client_uat_abc123=1790000000; path=/"
    render(<LandingPage />)

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/chat"))
  })

  it("sin sesión se queda en la presentación", async () => {
    render(<LandingPage />)
    await new Promise((r) => setTimeout(r, 50))

    expect(nav.replace).not.toHaveBeenCalled()
  })
})

describe("Página de presentación tal como sale del servidor", () => {
  it("no esconde nada: sin JS, con JS lento o al imprimir se lee entera", async () => {
    const { renderToString } = await import("react-dom/server")
    const html = renderToString(<LandingPage />)

    expect(html).toContain("Antes de empezar")
    expect(html).toContain("¿Tienes un tema que no termina de entrar?")
    // Ningún bloque transparente ni subrayado sin pintar a la espera de que llegue el JS
    expect(html).not.toMatch(/opacity:\s*0[;"]/)
    expect(html).not.toMatch(/scaleX\(0\)/)
  })

  it("tras borrar la cuenta (?cuenta=borrada) lo confirma una vez y limpia la URL", async () => {
    window.history.pushState(null, "", "/?cuenta=borrada")
    render(<LandingPage />)

    expect(await screen.findByText(/Tu cuenta y tus datos se borraron/)).toBeTruthy()
    expect(window.location.search).toBe("")
  })
})
