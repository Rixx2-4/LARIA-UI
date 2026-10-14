import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ClerkSlot } from "./clerk-slot"

afterEach(cleanup)

describe("ClerkSlot", () => {
  it("mientras llega Clerk, enseña la tarjeta de entrar con sus mismos textos y avisa de que carga", () => {
    render(
      <ClerkSlot form="sign-in">
        <div data-testid="clerk" />
      </ClerkSlot>,
    )
    expect(screen.getByRole("status").textContent).toContain("Cargando el formulario para entrar")
    expect(screen.getByText("Entrar")).toBeTruthy()
    expect(screen.getByText("para seguir estudiando con LARIA")).toBeTruthy()
    expect(screen.getByTestId("clerk")).toBeTruthy()
  })

  it("la de crear cuenta tiene sus propios textos", () => {
    render(
      <ClerkSlot form="sign-up">
        <div />
      </ClerkSlot>,
    )
    expect(screen.getByRole("status").textContent).toContain("Cargando el formulario para crear tu cuenta")
    expect(screen.getByText("Crea tu cuenta")).toBeTruthy()
    expect(screen.getByText("para estudiar con LARIA en Plenum")).toBeTruthy()
  })
})
