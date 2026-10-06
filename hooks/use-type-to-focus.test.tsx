import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup, fireEvent } from "@testing-library/react"
import { useRef } from "react"
import { useTypeToFocus } from "./use-type-to-focus"

function Page({ enabled = true, disabled = false }: { enabled?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useTypeToFocus(ref, enabled)
  return (
    <>
      <input ref={ref} aria-label="Mensaje" disabled={disabled} />
      <input aria-label="Otro campo" />
      <button>Botón</button>
      <div role="dialog" aria-label="Menú" hidden>
        <button>Dentro</button>
      </div>
    </>
  )
}

const chat = (c: ReturnType<typeof render>) => c.getByLabelText("Mensaje")

afterEach(cleanup)

describe("useTypeToFocus", () => {
  it("al escribir una letra desde cualquier parte, lleva el foco al chat", () => {
    const c = render(<Page />)
    fireEvent.keyDown(document.body, { key: "h" })
    expect(document.activeElement).toBe(chat(c))
  })

  it("no roba el foco a otro campo de texto", () => {
    const c = render(<Page />)
    const other = c.getByLabelText("Otro campo")
    other.focus()
    fireEvent.keyDown(other, { key: "h" })
    expect(document.activeElement).toBe(other)
  })

  it("ignora atajos, teclas sin carácter y la composición de un IME", () => {
    const c = render(<Page />)
    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true })
    fireEvent.keyDown(document.body, { key: "k", metaKey: true })
    fireEvent.keyDown(document.body, { key: "x", altKey: true })
    fireEvent.keyDown(document.body, { key: "Tab" })
    fireEvent.keyDown(document.body, { key: "ArrowDown" })
    fireEvent.keyDown(document.body, { key: "a", isComposing: true })
    expect(document.activeElement).not.toBe(chat(c))
  })

  it("el espacio sobre un botón lo pulsa en vez de escribir", () => {
    const c = render(<Page />)
    const button = c.getByText("Botón")
    button.focus()
    fireEvent.keyDown(button, { key: " " })
    expect(document.activeElement).toBe(button)
  })

  it("una letra sobre un botón sí lleva al chat", () => {
    const c = render(<Page />)
    const button = c.getByText("Botón")
    button.focus()
    fireEvent.keyDown(button, { key: "h" })
    expect(document.activeElement).toBe(chat(c))
  })

  it("no actúa dentro de un diálogo abierto", () => {
    const c = render(<Page />)
    const inside = c.getByText("Dentro")
    inside.focus()
    fireEvent.keyDown(inside, { key: "h" })
    expect(document.activeElement).not.toBe(chat(c))
  })

  it("con un diálogo modal abierto (el tutorial) no actúa, aunque el foco no esté en él", () => {
    const c = render(<Page />)
    const modal = document.createElement("div")
    modal.setAttribute("aria-modal", "true")
    document.body.appendChild(modal)
    fireEvent.keyDown(document.body, { key: "h" })
    expect(document.activeElement).not.toBe(chat(c))
    modal.remove()
  })

  it("no hace nada si está desactivado o el campo está deshabilitado", () => {
    const off = render(<Page enabled={false} />)
    fireEvent.keyDown(document.body, { key: "h" })
    expect(document.activeElement).not.toBe(chat(off))
    cleanup()

    const disabled = render(<Page disabled />)
    fireEvent.keyDown(document.body, { key: "h" })
    expect(document.activeElement).not.toBe(chat(disabled))
  })

  it("respeta a quien ya gestionó la tecla", () => {
    const c = render(<Page />)
    const event = new KeyboardEvent("keydown", { key: "h", bubbles: true, cancelable: true })
    event.preventDefault()
    document.body.dispatchEvent(event)
    expect(document.activeElement).not.toBe(chat(c))
  })
})
