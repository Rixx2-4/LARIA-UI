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
function stubServer() {
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
      return json(quiz)
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
    fireEvent.click(await screen.findByText("Generar Quiz"))
    fireEvent.click(await screen.findByText(/Cloroplasto/))
    expect(screen.getByText(/Cloroplasto/).closest("button")?.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByText(/Siguiente/))
    fireEvent.click(await screen.findByText(/Nitrógeno/))
    fireEvent.click(screen.getByText(/Finalizar/))

    expect(await screen.findByText("1 de 2 respuestas correctas")).toBeTruthy()
    // Con el texto de la opción, no solo la letra
    expect(screen.getByText("B. Nitrógeno")).toBeTruthy()
    expect(screen.getByText("A. Oxígeno")).toBeTruthy()
    expect(requests[0]).toMatchObject({ method: "POST", url: expect.stringMatching(/\/chats\/c1\/quiz\?num_questions=5$/) })
    expect(requests[1].url).toMatch(/\/quizzes\/q-77\/attempts$/)
    expect(requests[1].body).toEqual({ answers: { "1": "B", "2": "B" } })
  })

  it("Personalizar permite pedir otro número de preguntas", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }))
    fireEvent.change(screen.getByLabelText("Cantidad personalizada"), { target: { value: "7" } })
    fireEvent.click(screen.getByRole("button", { name: "Generar Quiz" }))

    await waitFor(() => expect(requests[0]?.url).toMatch(/num_questions=7$/))
  })

  it("sin chat en la URL deja elegir uno y lo pone en la URL", async () => {
    stubServer()
    renderQuiz("")

    expect(((await screen.findByRole("button", { name: "Generar Quiz" })) as HTMLButtonElement).disabled).toBe(true)
    const select = await screen.findByLabelText("Chat")
    await screen.findByRole("option", { name: "Células" })
    fireEvent.change(select, { target: { value: "c2" } })

    expect(nav.replace).toHaveBeenCalledWith("/quiz?chat=c2")
  })

  it("no deja pedir más de 20 preguntas, que es el máximo que acepta el backend", async () => {
    const requests = stubServer()
    renderQuiz("chat=c1")

    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }))
    fireEvent.change(screen.getByLabelText("Cantidad personalizada"), { target: { value: "21" } })
    fireEvent.click(screen.getByRole("button", { name: "Generar Quiz" }))

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
    fireEvent.click(screen.getByRole("button", { name: "Generar Quiz" }))

    await waitFor(() => expect(requests[0]?.url).toMatch(/num_questions=8$/))
  })

  it("solo se pueden elegir chats con un documento vinculado", async () => {
    stubServer()
    renderQuiz("")

    const option = (await screen.findByRole("option", { name: /Charla sin documento/ })) as HTMLOptionElement
    expect(option.disabled).toBe(true)
  })

  it("cambiar de chat en la URL empieza de cero, sin el quiz del chat anterior", async () => {
    stubServer()
    const view = renderQuiz("chat=c1")
    fireEvent.click(await screen.findByRole("button", { name: "Generar Quiz" }))
    await screen.findByText("¿Dónde ocurre la fotosíntesis?")

    nav.search = "chat=c2"
    view.rerender(
      <AuthProvider>
        <ChatProvider>
          <QuizPage />
        </ChatProvider>
      </AuthProvider>,
    )

    expect(await screen.findByRole("button", { name: "Generar Quiz" })).toBeTruthy()
    expect(screen.queryByText("¿Dónde ocurre la fotosíntesis?")).toBeNull()
  })
})
