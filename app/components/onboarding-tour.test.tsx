import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { OnboardingTour, ONBOARDING_STEPS } from "./onboarding-tour"
import { setAuthToken } from "@/lib/laria-api"
import { replayOnboarding } from "@/lib/onboarding"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let completed: number

function stubServer(onboarding: boolean | undefined) {
  completed = 0
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/users/me/onboarding") && init?.method === "POST") {
      completed++
      return json({ id: "u1", username: "ana", email: "a@a.a", onboarding_completed: true })
    }
    if (url.endsWith("/users/me")) {
      const user: Record<string, unknown> = { id: "u1", username: "ana", email: "a@a.a" }
      if (onboarding !== undefined) user.onboarding_completed = onboarding
      return json(user)
    }
    throw new Error(`Petición inesperada: ${url}`)
  })
}

function renderTour() {
  return render(
    <AuthProvider>
      <OnboardingTour />
    </AuthProvider>,
  )
}

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("Tutorial de bienvenida", () => {
  it("una cuenta nueva lo ve; «Siguiente» recorre los pasos y al terminar queda visto en la cuenta", async () => {
    stubServer(false)
    renderTour()

    expect(await screen.findByRole("dialog", { name: "¡Hola! Soy LARIA" })).toBeTruthy()
    expect(screen.getByText(`1/${ONBOARDING_STEPS.length}`)).toBeTruthy()
    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))
      expect(screen.getByText(`${i + 1}/${ONBOARDING_STEPS.length}`)).toBeTruthy()
    }
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }))
    expect(screen.getByText(`${ONBOARDING_STEPS.length - 1}/${ONBOARDING_STEPS.length}`)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))
    fireEvent.click(screen.getByRole("button", { name: "¡Empezar!" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(completed).toBe(1))
  })

  it.each([
    ["Saltar", () => fireEvent.click(screen.getByRole("button", { name: "Saltar" }))],
    ["Esc", () => fireEvent.keyDown(document, { key: "Escape" })],
  ])("«%s» lo cierra y también lo marca como visto", async (_name, skip) => {
    stubServer(false)
    renderTour()
    await screen.findByRole("dialog")

    skip()

    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(completed).toBe(1))
  })

  it.each([
    ["ya visto", true],
    ["backend sin el campo", undefined],
  ])("%s: no se muestra", async (_name, onboarding) => {
    stubServer(onboarding)
    renderTour()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("«Ver el tutorial de nuevo» lo abre desde el principio, sin tocar la cuenta", async () => {
    stubServer(true)
    renderTour()
    await new Promise((r) => setTimeout(r, 30))

    act(() => replayOnboarding())
    expect(screen.getByRole("dialog", { name: "¡Hola! Soy LARIA" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(completed).toBe(0)
  })

  it("resalta el elemento real de la pantalla cuando se ve", async () => {
    stubServer(false)
    const target = document.createElement("textarea")
    target.dataset.tour = "chat"
    target.getBoundingClientRect = () => ({ left: 10, top: 500, width: 300, height: 40, right: 310, bottom: 540, x: 10, y: 500, toJSON: () => ({}) })
    document.body.appendChild(target)
    const { container } = renderTour()

    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))

    const spotlight = container.querySelector<HTMLElement>(".ring-primary")
    expect(spotlight?.style.left).toBe("4px")
    expect(spotlight?.style.width).toBe("312px")
    target.remove()
  })
})
