import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import LandingPage from "./page"
import { preferReducedMotion } from "@/test/media"

// Archivo aparte: Motion lee "reducir movimiento" una sola vez por proceso,
// así que este caso necesita un entorno en el que nadie lo haya leído antes
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/" }))
vi.mock("next/font/google", () => ({ Instrument_Serif: () => ({ variable: "font-display-test" }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Página de presentación con «reducir movimiento»", () => {
  it("la demo del chat se ve completa desde el principio, con las fórmulas ya pintadas", () => {
    preferReducedMotion()
    render(<LandingPage />)

    const demo = screen.getByRole("img", { name: /Ejemplo de conversación/ })
    expect(demo.textContent).toContain("Cuando una función va dentro de otra")
    expect(demo.textContent).toContain("Tutoría")
    expect(demo.querySelectorAll(".katex").length).toBe(5)
    // Ningún $ suelto a la vista: todas las fórmulas salen pintadas
    demo.querySelectorAll(".katex-html").forEach((math) => expect(math.textContent).not.toContain("$"))
  })
})
