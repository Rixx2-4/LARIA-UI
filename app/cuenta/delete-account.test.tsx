import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { setAuthToken } from "@/lib/laria-api"

// Clerk de mentira: useReverification, si el intento pide verificar la identidad,
// «verifica» (o cancela) y lo repite, como el modal de Clerk
const clerk = vi.hoisted(() => ({ signOut: vi.fn(async () => {}), verifications: 0, cancel: false }))
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut: clerk.signOut }),
  useReverification:
    (fetcher: () => Promise<unknown>) =>
    async () => {
      const first = await fetcher()
      const hint = first as { clerk_error?: { reason?: string } }
      if (hint?.clerk_error?.reason !== "reverification-error") return first
      clerk.verifications++
      if (clerk.cancel) throw Object.assign(new Error("cancelado"), { code: "reverification_cancelled" })
      return fetcher()
    },
}))

import { DeleteAccount } from "./delete-account"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let replace: ReturnType<typeof vi.fn>

beforeEach(() => {
  setAuthToken("token")
  clerk.signOut.mockClear()
  clerk.verifications = 0
  clerk.cancel = false
  replace = vi.fn()
  vi.stubGlobal("location", { ...window.location, replace })
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

function stubDelete(...responses: Response[]) {
  const calls: unknown[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/users/me") && init?.method === "DELETE") {
      calls.push(JSON.parse(String(init.body)))
      return responses.shift() ?? new Response(null, { status: 204 })
    }
    throw new Error(`Petición inesperada: ${url}`)
  })
  return calls
}

function confirmAndDelete() {
  fireEvent.click(screen.getByRole("button", { name: "Borrar mi cuenta" }))
  const button = screen.getByRole("button", { name: "Borrar definitivamente" }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText(/Para confirmar, escribe/), { target: { value: "borrar" } })
  fireEvent.click(button)
}

describe("Borrar mi cuenta", () => {
  it("con la identidad verificada hace un DELETE vacío, cierra la sesión y va a la portada", async () => {
    const calls = stubDelete(new Response(null, { status: 204 }))
    render(<DeleteAccount />)

    confirmAndDelete()

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/?cuenta=borrada"))
    expect(calls).toEqual([{}])
    expect(clerk.signOut).toHaveBeenCalledOnce()
    expect(clerk.verifications).toBe(0)
  })

  it("si hace falta verificar la identidad (403 reverification_required), Clerk la pide y se reintenta", async () => {
    const calls = stubDelete(json({ detail: "Verifica tu identidad.", reason: "reverification_required" }, 403), new Response(null, { status: 204 }))
    render(<DeleteAccount />)

    confirmAndDelete()

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/?cuenta=borrada"))
    expect(clerk.verifications).toBe(1)
    expect(calls).toHaveLength(2)
  })

  it("si se cancela la verificación, no borra nada ni muestra error", async () => {
    clerk.cancel = true
    stubDelete(json({ detail: "Verifica tu identidad.", reason: "reverification_required" }, 403))
    render(<DeleteAccount />)

    confirmAndDelete()

    await waitFor(() => expect(clerk.verifications).toBe(1))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it("con un 503 explica que no se borró nada y deja reintentar", async () => {
    stubDelete(json({ detail: "No pudimos cerrar tu cuenta ahora mismo. No se borró nada: vuelve a intentarlo." }, 503))
    render(<DeleteAccount />)

    confirmAndDelete()

    expect((await screen.findByRole("alert")).textContent).toContain("No se borró nada")
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy()
    expect(clerk.signOut).not.toHaveBeenCalled()
  })
})
