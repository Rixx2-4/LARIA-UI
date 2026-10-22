import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import QuizPage from "./page"
import { setAuthToken } from "@/lib/laria-api"

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => "/quiz",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const quiz = {
  id: "q-77",
  document_id: "d1",
  total_points: 2,
  created_at: "",
  questions: [
    { index: 1, text: "¿Dónde ocurre la fotosíntesis?", options: { A: "Mitocondria", B: "Cloroplasto" }, difficulty: "easy" },
    { index: 2, text: "¿Qué gas se libera?", options: { A: "Oxígeno", B: "Nitrógeno" }, difficulty: "medium" },
  ],
}

// Servidor de quizzes: registra las peticiones de generar y enviar
function stubServer(served = quiz) {
  const requests: { url: string; method: string; body?: unknown }[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/"))
      return json({
        chats: [
          { id: "c1", title: "Fotosíntesis", document_id: "d1" },
          { id: "c2", title: "Células", document_id: "d2" },
          { id: "c3", title: "Charla sin documento", document_id: null },
        ],
      })
    if (url.includes("/quiz?")) {
      // Como el backend: generar un quiz es un POST; otro método da 405
      if (method !== "POST") return json({ detail: "Method Not Allowed" }, 405)
      requests.push({ url, method })
      return json(served)
    }
    if (url.includes("/attempts")) {
      const body = JSON.parse(String(init?.body))
      requests.push({ url, method, body })
      return json({
        attempt_id: "a1", quiz_id: "q-77", score: 1, total_points: 2, completed_at: "",
        questions: [
          { index: 1, text: quiz.questions[0].text, selected: "B", correct_answer: "B", is_correct: true },
          { index: 2, text: quiz.questions[1].text, selected: "B", correct_answer: "A", is_correct: false },
        ],
      })
    }
    throw new Error(`Petición inesperada: ${url}`)
  })
  return requests
}

function renderQuiz(search = "") {
  nav.search = search
  return render(
    <AuthProvider>
      <ChatProvider>
        <QuizPage />
      </ChatProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  setAuthToken("token")
  nav.replace.mockReset()
  nav.push.mockReset()
})
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("QuizPage", () => {
  it("genera el quiz del chat de la URL y envía las respuestas a ese quiz", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    // Por texto y no por rol: getByRole recorre el árbol de accesibilidad de toda
    // la página en cada búsqueda y hacía este test lento (se pasaba de tiempo)
    fireEvent.click(await screen.findByText("Empezar quiz"))
    fireEvent.click(await screen.findByText(/Cloroplasto/))
    expect(screen.getByText(/Cloroplasto/).closest("button")?.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByText(/Siguiente/))
    fireEvent.click(await screen.findByText(/Nitrógeno/))
    fireEvent.click(screen.getByText(/Finalizar/))

    expect(await screen.findByText("Acertaste 1 de 2")).toBeTruthy()
    // Con el texto de la opción, no solo la letra
    expect(screen.getByText("B. Nitrógeno")).toBeTruthy()
    expect(screen.getByText("A. Oxígeno")).toBeTruthy()
    expect(requests[0]).toMatchObject({ method: "POST", url: expect.stringMatching(/\/chats\/c1\/quiz\?num_questions=5$/) })
    expect(requests[1].url).toMatch(/\/quizzes\/q-77\/attempts$/)
    expect(requests[1].body).toEqual({ answers: { "1": "B", "2": "B" } })
  })

  it("con un chat sin documento en la URL (p. ej. desde la barra lateral) no deja generar y dice por qué", async () => {
    const requests = stubServer()
    renderQuiz("chat=c3")

    expect(await screen.findByText("Este chat no tiene un documento. Sube uno en el chat, o nivélate en un tema aquí abajo.")).toBeTruthy()
    const generate = screen.getByText("Empezar quiz").closest("button")!
    expect(generate.disabled).toBe(true)
    fireEvent.click(generate)
    expect(requests).toEqual([])
  })

  it("las fórmulas del enunciado y de las opciones se dibujan con KaTeX", async () => {
    stubServer({
      ...quiz,
      questions: [{ index: 0, text: "¿Cuánto es \\( \\frac{3}{4} + \\frac{1}{4} \\)?", options: { A: "\\( 1 \\)", B: "\\( \\frac{4}{8} \\)" }, difficulty: "easy" }],
    })
    const { container } = renderQuiz("chat=c1")

    fireEvent.click(await screen.findByText("Empezar quiz"))
    await screen.findByText(/¿Cuánto es/)
    // Una fórmula en el enunciado y una en cada opción (KaTeX llega un instante después)
    await waitFor(() => expect(container.querySelectorAll(".katex-html")).toHaveLength(3))
    expect(container.textContent).not.toContain("\\(")
  })

  it("Personalizar permite pedir otro número de preguntas", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }))
    fireEvent.change(screen.getByLabelText("Cantidad personalizada"), { target: { value: "7" } })
    fireEvent.click(screen.getByRole("button", { name: "Empezar quiz" }))

    await waitFor(() => expect(requests[0]?.url).toMatch(/num_questions=7$/))
  })

  it("sin chat en la URL deja elegir uno y lo pone en la URL", async () => {
    stubServer()
    renderQuiz("")

    expect(((await screen.findByRole("button", { name: "Empezar quiz" })) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(await screen.findByRole("radio", { name: /Células/ }))

    expect(nav.replace).toHaveBeenCalledWith("/quiz?chat=c2")
  })

  it("no deja pedir más de 20 preguntas, que es el máximo que acepta el backend", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }))
    fireEvent.change(screen.getByLabelText("Cantidad personalizada"), { target: { value: "21" } })
    fireEvent.click(screen.getByRole("button", { name: "Empezar quiz" }))

    expect(await screen.findByText("Elige entre 1 y 20 preguntas.")).toBeTruthy()
    expect(requests).toEqual([])
  })

  it("la cantidad personalizada se puede borrar y reescribir con normalidad", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }))
    const input = screen.getByLabelText("Cantidad personalizada") as HTMLInputElement
    fireEvent.change(input, { target: { value: "" } })
    expect(input.value).toBe("")
    fireEvent.change(input, { target: { value: "8" } })
    fireEvent.click(screen.getByRole("button", { name: "Empezar quiz" }))

    await waitFor(() => expect(requests[0]?.url).toMatch(/num_questions=8$/))
  })

  it("solo se pueden elegir chats con un documento vinculado", async () => {
    stubServer()
    renderQuiz("")

    const option = (await screen.findByRole("radio", { name: /Charla sin documento/ })) as HTMLInputElement
    expect(option.disabled).toBe(true)
    expect(((await screen.findByRole("radio", { name: /Fotosíntesis/ })) as HTMLInputElement).disabled).toBe(false)
  })

  it("cambiar de chat en la URL empieza de cero, sin el quiz del chat anterior", async () => {
    stubServer()
    const view = renderQuiz("chat=c1")
    fireEvent.click(await screen.findByRole("button", { name: "Empezar quiz" }))
    await screen.findByText("¿Dónde ocurre la fotosíntesis?")

    nav.search = "chat=c2"
    view.rerender(
      <AuthProvider>
        <ChatProvider>
          <QuizPage />
        </ChatProvider>
      </AuthProvider>,
    )

    expect(await screen.findByRole("button", { name: "Empezar quiz" })).toBeTruthy()
    expect(screen.queryByText("¿Dónde ocurre la fotosíntesis?")).toBeNull()
  })

  it("con el teclado: un número elige la opción y Enter pasa a la siguiente", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByText("Empezar quiz"))
    await screen.findByText("¿Dónde ocurre la fotosíntesis?")
    fireEvent.keyDown(window, { key: "2" })
    expect(screen.getByText(/Cloroplasto/).closest("button")?.getAttribute("aria-pressed")).toBe("true")
    fireEvent.keyDown(window, { key: "Enter" })
    await screen.findByText("¿Qué gas se libera?")
    // También con la letra
    fireEvent.keyDown(window, { key: "b" })
    fireEvent.keyDown(window, { key: "Enter" })

    await screen.findByText("Acertaste 1 de 2")
    expect(requests[1].body).toEqual({ answers: { "1": "B", "2": "B" } })
  })

  it("escribiendo en un campo, las teclas no eligen opciones", async () => {
    stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByText("Empezar quiz"))
    await screen.findByText("¿Dónde ocurre la fotosíntesis?")
    const input = document.createElement("input")
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: "2" })
    expect(screen.getByText(/Cloroplasto/).closest("button")?.getAttribute("aria-pressed")).toBe("false")
    input.remove()
  })

  it("en los resultados se pueden ver solo las falladas y pedir otro quiz igual", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByText("Empezar quiz"))
    fireEvent.click(await screen.findByText(/Cloroplasto/))
    fireEvent.click(screen.getByText(/Siguiente/))
    fireEvent.click(await screen.findByText(/Nitrógeno/))
    fireEvent.click(screen.getByText(/Finalizar/))
    await screen.findByText("Acertaste 1 de 2")
    expect(screen.getByText("Vas bien")).toBeTruthy()

    fireEvent.click(screen.getByText("Para repasar (1)"))
    expect(screen.queryByText("¿Dónde ocurre la fotosíntesis?")).toBeNull()
    expect(screen.getByText("¿Qué gas se libera?")).toBeTruthy()

    fireEvent.click(screen.getByText("Otro quiz igual"))
    // Con el mismo chat y el mismo número de preguntas
    await screen.findByText("Pregunta 1 de 2")
    expect(requests[2]).toMatchObject({ method: "POST", url: expect.stringMatching(/\/chats\/c1\/quiz\?num_questions=5$/) })
  })

  it("mientras se envían las respuestas no se pueden cambiar, y si sale, el resultado tardío no aparece", async () => {
    stubServer()
    const serve = globalThis.fetch as (url: string, init?: RequestInit) => Promise<Response>
    let release: () => void = () => {}
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.includes("/attempts")) await new Promise<void>((resolve) => (release = resolve))
      return serve(url, init)
    })
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByText("Empezar quiz"))
    fireEvent.click(await screen.findByText(/Cloroplasto/))
    fireEvent.click(screen.getByText(/Siguiente/))
    fireEvent.click(await screen.findByText(/Nitrógeno/))
    fireEvent.click(screen.getByText(/Finalizar/))

    // Enviando: ni otra opción ni volver atrás
    fireEvent.click(screen.getByText(/Oxígeno/))
    expect(screen.getByText(/Nitrógeno/).closest("button")?.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByText(/Anterior/))
    expect(screen.getByText("¿Qué gas se libera?")).toBeTruthy()

    fireEvent.click(screen.getByText("Salir"))
    await screen.findByText("Ponte a prueba")
    release()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(screen.queryByText("Acertaste 1 de 2")).toBeNull()
    expect(screen.getByText("Ponte a prueba")).toBeTruthy()
  })
})
