import { useState } from "react"
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/app/contexts/auth-context"
import { ThemeProvider } from "next-themes"
import { AccountMenu } from "./account-menu"
import { getAuthToken, setAuthToken } from "@/lib/laria-api"

function SessionState() {
  const { isAuthenticated } = useAuth()
  return <p>{isAuthenticated ? "con sesión" : "sin sesión"}</p>
}

beforeEach(() => {
  setAuthToken("token")
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ id: "u1", username: "ana", email: "ana@example.com" }), { status: 200 }),
  )
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("AccountMenu", () => {
  it("muestra la cuenta real, enlaza al perfil y permite cerrar sesión", async () => {
    const onClose = vi.fn()
    render(
      <AuthProvider>
        <SessionState />
        <AccountMenu isOpen onClose={onClose} />
      </AuthProvider>,
    )

    expect(await screen.findByText("ana")).toBeTruthy()
    expect(screen.getByText("ana@example.com")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Perfil de aprendizaje" }).getAttribute("href")).toBe("/perfil")
    expect(screen.queryByText("pro")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }))

    expect(screen.getByText("sin sesión")).toBeTruthy()
    expect(getAuthToken()).toBeNull()
    expect(onClose).toHaveBeenCalled()
  })

  it("permite elegir el tema y lo aplica a toda la página", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <AccountMenu isOpen onClose={() => {}} />
        </AuthProvider>
      </ThemeProvider>,
    )

    const dark = await screen.findByRole("button", { name: "Oscuro" })
    expect(screen.getByRole("button", { name: "Sistema" }).getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(dark)

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(dark.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Claro" }))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("al abrirse lleva el foco al menú y al cerrarse lo devuelve", async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Cuenta</button>
          <AccountMenu isOpen={open} onClose={() => setOpen(false)} />
        </>
      )
    }
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )
    const trigger = screen.getByRole("button", { name: "Cuenta" })
    trigger.focus()

    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Perfil de aprendizaje" }))

    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.activeElement).toBe(trigger)
  })
})
