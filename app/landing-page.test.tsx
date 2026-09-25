import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import LandingPage from "./page"
import { setAuthToken } from "@/lib/laria-api"

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
  setAuthToken(null)
})

describe("Página de presentación", () => {
  it("cuenta qué es LARIA y lleva a crear cuenta o a entrar", () => {
    render(<LandingPage />)

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("pregunta lo que no entendiste")
    const signUp = screen.getAllByRole("link", { name: /Crear cuenta/ })
    expect(signUp.length).toBeGreaterThan(0)
    signUp.forEach((link) => expect(link.getAttribute("href")).toBe("/chat?modo=registro"))
    expect(screen.getByRole("link", { name: "Ya tengo cuenta" }).getAttribute("href")).toBe("/chat")
  })

  it("quien ya tiene sesión va directo a la app", async () => {
    setAuthToken("token")
    render(<LandingPage />)

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/chat"))
  })

  it("sin sesión se queda en la presentación", async () => {
    render(<LandingPage />)
    await new Promise((r) => setTimeout(r, 50))

    expect(nav.replace).not.toHaveBeenCalled()
  })
})
