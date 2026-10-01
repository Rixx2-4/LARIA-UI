import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import NotFound from "./not-found"

afterEach(cleanup)

describe("Página no encontrada", () => {
  it("lo dice en español, con la mascota de LARIA y una salida al inicio", () => {
    const { container } = render(<NotFound />)

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("No encontramos esta página")
    expect(container.querySelector('img[src*="laria-mascota"]')).toBeTruthy()
    expect(screen.getByRole("link", { name: /Volver al inicio/ }).getAttribute("href")).toBe("/")
    expect(container.textContent).not.toMatch(/could not be found/i)
  })
})
