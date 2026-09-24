import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/app/contexts/auth-context"
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
})
