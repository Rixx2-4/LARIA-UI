import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { ApiError, isServerUnavailable, type QuizAttemptQuestion, type QuizQuestion } from "@/lib/laria-api"
import { QuestionStep, ResultsList, scoreLine, scorePercentage, submitErrorMessage, toResults } from "./quiz-parts"

afterEach(cleanup)

// Forma tomada de una captura real del backend (ADR-052, nivelación de fotosíntesis)
const open: QuizQuestion = {
  index: 0,
  text: "Explica el proceso de la fotosíntesis en tus propias palabras.",
  options: {},
  difficulty: "easy",
  kind: "open",
  max_chars: 2000,
}
const choice: QuizQuestion = { index: 1, text: "¿Qué gas se libera?", options: { A: "Oxígeno", B: "Nitrógeno" }, difficulty: "medium" }

const graded: QuizAttemptQuestion[] = [
  {
    index: 0,
    text: open.text,
    selected: "Las plantas usan la luz del sol para hacer su alimento.",
    correct_answer: "",
    is_correct: false,
    kind: "open",
    score: 0.667,
    verdict: "partial",
    feedback: "Explicaste bien cómo usan la luz. Te faltó decir por qué importa en los ecosistemas.",
    key_points: [
      { text: "Ocurre en las plantas y otros organismos fotosintéticos.", covered: true },
      { text: "Convierte dióxido de carbono y agua en glucosa y oxígeno.", covered: true },
      { text: "Es esencial para la energía de los ecosistemas.", covered: false },
    ],
    model_answer: "La fotosíntesis es el proceso mediante el cual las plantas…",
  },
  { index: 1, text: choice.text, selected: "A", correct_answer: "A", is_correct: true, kind: "choice", score: 1 },
]

function step(props: Partial<Parameters<typeof QuestionStep>[0]> = {}) {
  const onAnswer = vi.fn()
  const onNext = vi.fn()
  const view = render(
    <QuestionStep
      questions={[open, choice]}
      current={0}
      answers={{}}
      onAnswer={onAnswer}
      onPrev={() => {}}
      onNext={onNext}
      isSubmitting={false}
      error={null}
      {...props}
    />,
  )
  return { ...view, onAnswer, onNext }
}

describe("preguntas abiertas", () => {
  it("se responden por escrito, con el límite del servidor, y en blanco no se puede seguir", () => {
    const { onAnswer } = step()
    const field = screen.getByLabelText("Tu respuesta") as HTMLTextAreaElement
    expect(field.maxLength).toBe(2000)
    expect((screen.getByRole("button", { name: /Siguiente/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: "Las plantas usan la luz" } })
    expect(onAnswer).toHaveBeenCalledWith(open, "Las plantas usan la luz")
  })

  it("solo espacios no cuentan como respuesta", () => {
    step({ answers: { 0: "   " } })
    expect((screen.getByRole("button", { name: /Siguiente/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("Ctrl + Enter pasa a la siguiente; las teclas de número se escriben, no eligen", () => {
    const { onNext, onAnswer } = step({ answers: { 0: "Una idea" } })
    const field = screen.getByLabelText("Tu respuesta")
    fireEvent.keyDown(field, { key: "1" })
    expect(onAnswer).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: "Enter" })
    expect(onNext).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("al enviar con abiertas avisa de que tarda un poco más", () => {
    step({ current: 1, answers: { 0: "Una idea", 1: "A" }, isSubmitting: true })
    expect(screen.getByRole("status").textContent).toMatch(/las escritas tardan unos segundos/)
  })

  it("el resultado de una abierta da el veredicto, las ideas clave y una respuesta de ejemplo, sin ✓/✗", () => {
    render(<ResultsList results={toResults([open, choice], graded)} />)
    expect(screen.getByText("En parte")).toBeTruthy()
    expect(screen.getByText("Cubriste 2 de 3 ideas clave")).toBeTruthy()
    expect(screen.getByText(/Te faltó decir por qué importa/)).toBeTruthy()
    expect(screen.getByText("Las plantas usan la luz del sol para hacer su alimento.")).toBeTruthy()
    expect(screen.getByText(/Te faltó:/).parentElement?.textContent).toMatch(/esencial para la energía/)
    expect(screen.getByText("Ver una respuesta de ejemplo")).toBeTruthy()
    // La de opción sigue como siempre
    expect(screen.getAllByLabelText("Correcta")).toHaveLength(1)
    expect(screen.queryByLabelText("Incorrecta")).toBeNull()
  })

  it("la puntuación cuenta el crédito parcial", () => {
    const results = toResults([open, choice], graded)
    expect(scoreLine(results)).toBe("Sacaste 1,7 de 2")
    expect(scorePercentage(results)).toBe(83)
    // Sin abiertas, como siempre
    expect(scoreLine(toResults([choice], [graded[1]]))).toBe("Acertaste 1 de 1")
  })

  it("una respuesta de un backend anterior (sin kind ni score) se lee como antes", () => {
    const [result] = toResults([choice], [{ index: 1, text: choice.text, selected: "B", correct_answer: "A", is_correct: false }])
    expect(result.score).toBe(0)
    expect(result.open).toBeUndefined()
  })

  it("los fallos del corrector se explican sin perder lo escrito", () => {
    expect(submitErrorMessage(new ApiError("x", 502, "grader_unavailable"), "")).toMatch(/No se ha perdido nada/)
    expect(submitErrorMessage(new ApiError("x", 429, "grade_rate_limited"), "")).toMatch(/Espera un minuto/)
    expect(submitErrorMessage(new ApiError("x", 422, "answer_too_long"), "")).toMatch(/demasiado larga/)
    expect(submitErrorMessage(new ApiError("Otro motivo", 400), "")).toBe("Otro motivo")
  })

  it("un corrector caído no es «el servidor no responde»", () => {
    expect(isServerUnavailable(new ApiError("x", 502, "grader_unavailable"))).toBe(false)
    expect(isServerUnavailable(new ApiError("x", 502))).toBe(true)
  })
})
