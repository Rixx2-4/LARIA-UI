import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { FileViewer } from "./file-viewer"
import { setAuthToken } from "@/lib/laria-api"

beforeEach(() => {
  setAuthToken("token")
  URL.createObjectURL = vi.fn(() => "blob:archivo")
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("FileViewer", () => {
  it("es un diálogo modal: el foco entra, Tab no sale y al cerrar vuelve a donde estaba", () => {
    const opener = document.createElement("button")
    document.body.appendChild(opener)
    opener.focus()
    const onClose = vi.fn()
    const { unmount } = render(<FileViewer filename="tema.docx" mimeType="application/msword" onClose={onClose} />)

    const dialog = screen.getByRole("dialog", { name: "tema.docx" })
    expect(document.activeElement).toBe(dialog)
    const close = screen.getByRole("button", { name: "Cerrar" })
    close.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(dialog.contains(document.activeElement)).toBe(true)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it("un archivo sin vista previa (Word) se puede descargar", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url)
      return new Response(new Blob(["docx"]))
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    render(<FileViewer filename="tema.docx" mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document" documentId="d1" onClose={() => {}} />)

    expect(screen.getByText("Vista previa no disponible")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Descargar" }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(urls[0]).toMatch(/\/documents\/d1\/content$/)
  })

  it("un texto enorme se enseña recortado para no bloquear la página", () => {
    const huge = "a".repeat(300_000)
    render(<FileViewer filename="datos.txt" mimeType="text/plain" previewDataUrl={huge} onClose={() => {}} />)

    expect(screen.getByText("Vista previa recortada: el archivo es más largo.")).toBeTruthy()
    expect(document.querySelector("pre")?.textContent?.length).toBe(200_000)
  })
})
