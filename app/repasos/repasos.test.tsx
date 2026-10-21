import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, renderHook, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { AuthProvider } from "@/app/contexts/auth-context"
import { ChatProvider } from "@/app/contexts/chat-context"
import RepasosPage from "./page"
import { ForgettingCurve } from "./forgetting-curve"
import { lariaAPI, setAuthToken, type RetentionCurve, type ReviewAgenda } from "@/lib/laria-api"
import { dueCount, percent, whenLabel } from "@/lib/reviews"
import { useReviewAgenda } from "@/hooks/use-review-agenda"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/repasos",
  useParams: () => ({}),
}))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const DAY = 24 * 60 * 60 * 1000
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString()

// La forma del contrato (ADR-051)
const item = (concept: string, label: string, status: "overdue" | "today" | "upcoming", days: number, path_id: string | null) => ({
  concept, label, status, estimated_retention: status === "upcoming" ? 0.95 : 0.84, next_review_at: iso(days),
  last_reviewed_at: iso(-10), half_life_days: 14, reviews: 2, mastery: 0.6, path_id,
})
const agenda: ReviewAgenda = {
  generated_at: iso(0),
  desired_retention: 0.9,
  counts: { overdue: 1, today: 1, upcoming: 1 },
  items: [
    item("ecuacion", "Qué es una ecuación", "overdue", -2, "p1"),
    item("fotosintesis", "Fotosíntesis", "today", 0, null),
    item("despejar", "Despejar la x", "upcoming", 5, "p1"),
  ],
}
const curve: RetentionCurve = {
  concept: "ecuacion", label: "Qué es una ecuación", desired_retention: 0.9, half_life_days: 14, next_review_at: iso(-2),
  measured: [{ at: iso(-20), score_ratio: 0.8 }, { at: iso(-10), score_ratio: 1 }],
  estimated: [{ at: iso(-20), retention: 1 }, { at: iso(-10), retention: 0.6 }, { at: iso(-10), retention: 1 }, { at: iso(0), retention: 0.6 }],
  note: "Es una estimación del modelo, no una medición: los puntos son tus repasos reales.",
}

function stub(body: ReviewAgenda = agenda) {
  const calls: { method: string; url: string; body?: string }[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", url, body: init?.body ? String(init.body) : undefined })
    if (url.endsWith("/users/me")) return json({ id: "u1", username: "ana", email: "a@a.a" })
    if (url.endsWith("/chats/")) return json({ chats: [] })
    if (url.includes("/learning/me/reviews/curve?concept=ecuacion")) return json(curve)
    if (url.includes("/learning/me/reviews?")) return json(body)
    if (url.endsWith("/quizzes/practice"))
      return json({ id: "z1", document_id: null, questions: [{ index: 0, text: "¿Qué gas se libera?", options: { A: "Oxígeno", B: "Nitrógeno" }, difficulty: "easy" }] })
    if (url.endsWith("/quizzes/z1/attempts")) return json({ questions: [] })
    return json({ detail: "Not Found" }, 404)
  })
  return calls
}

const page = () =>
  render(
    <AuthProvider>
      <ChatProvider>
        <RepasosPage />
      </ChatProvider>
    </AuthProvider>,
  )

beforeEach(() => setAuthToken("token"))
afterEach(() => {
  cleanup()
  setAuthToken(null)
  vi.unstubAllGlobals()
})

describe("lib/reviews", () => {
  it("dice cuándo toca en días de calendario y redondea la estimación", () => {
    const now = new Date(2026, 9, 20, 23, 0)
    expect(whenLabel(new Date(2026, 9, 21, 1, 0).toISOString(), now)).toBe("Mañana")
    expect(whenLabel(new Date(2026, 9, 20, 8, 0).toISOString(), now)).toBe("Hoy")
    expect(whenLabel(new Date(2026, 9, 17).toISOString(), now)).toBe("Hace 3 días")
    expect(whenLabel(new Date(2026, 9, 25).toISOString(), now)).toBe("En 5 días")
    expect(percent(0.724)).toBe("72 %")
    expect(dueCount(agenda)).toBe(2)
  })
})

describe("Repasos", () => {
  it("separa lo de hoy (vencido incluido) de lo próximo, con la estimación como tal", async () => {
    stub()
    page()
    const today = await screen.findByRole("region", { name: /Para hoy/ })
    expect(within(today).getByText("Qué es una ecuación")).toBeTruthy()
    expect(within(today).getByText("Tocaba hace 2 días")).toBeTruthy()
    expect(within(today).getByText("Fotosíntesis")).toBeTruthy()
    expect(within(today).getAllByText(/Recuerdo estimado: 84 %/)).toHaveLength(2)
    const next = screen.getByRole("region", { name: /Próximos/ })
    expect(within(next).getByText("Próximo repaso: en 5 días")).toBeTruthy()
  })

  it("con ruta, repasar es volver a su clase; sin ruta, unas preguntas aquí mismo con su nombre", async () => {
    const calls = stub()
    page()
    const today = await screen.findByRole("region", { name: /Para hoy/ })
    const [withPath, withoutPath] = within(today).getAllByRole("listitem")
    expect(within(withPath).getByRole("link", { name: "Repasar" }).getAttribute("href")).toBe("/clase/p1")
    fireEvent.click(within(withoutPath).getByRole("button", { name: "Repasar" }))
    expect(await screen.findByText("¿Qué gas se libera?")).toBeTruthy()
    const practice = calls.find((c) => c.method === "POST" && c.url.endsWith("/quizzes/practice"))
    expect(JSON.parse(practice!.body!).topic).toBe("Fotosíntesis")
  })

  it("la curva se pide al abrirla y explica que es una estimación", async () => {
    const calls = stub()
    page()
    await screen.findByText("Qué es una ecuación")
    expect(calls.some((c) => c.url.includes("/curve"))).toBe(false)
    fireEvent.click(screen.getAllByRole("button", { name: /Curva del olvido/ })[0])
    expect(await screen.findByText(/Es una estimación del modelo/)).toBeTruthy()
    expect(screen.getByRole("img", { name: /Recuerdo estimado de Qué es una ecuación/ }).getAttribute("aria-label")).toMatch(/2 repasos con nota/)
  })

  it("sin evidencia todavía, lo explica y lleva a las clases", async () => {
    stub({ ...agenda, counts: { overdue: 0, today: 0, upcoming: 0 }, items: [] })
    page()
    expect(await screen.findByText("Aún no hay nada que repasar")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Ir a mis clases" }).getAttribute("href")).toBe("/clases")
  })
})

describe("ForgettingCurve", () => {
  it("dibuja la estimación discontinua, un punto por repaso real y la tabla de datos", () => {
    const { container } = render(<ForgettingCurve curve={curve} now={Date.now()} />)
    const svg = container.querySelector("svg[role=img]")!
    expect(svg.querySelector("path")?.getAttribute("stroke-dasharray")).toBeTruthy()
    expect(svg.querySelectorAll("circle")).toHaveLength(2)
    expect(screen.getByText("Ver tus repasos")).toBeTruthy()
    expect(screen.getAllByText(/^(80|100) %$/)).toHaveLength(2)
  })
})

describe("useReviewAgenda", () => {
  it("se vuelve a pedir unos segundos después de calificarse un intento", async () => {
    const calls = stub()
    const { result } = renderHook(() => useReviewAgenda())
    await waitFor(() => expect(result.current.agenda).not.toBeNull())
    const agendaRequests = () => calls.filter((c) => c.url.includes("/reviews?")).length
    const before = agendaRequests()
    await lariaAPI.quizzes.submitAttempt("z1", { "0": "A" })
    expect(agendaRequests()).toBe(before)
    await waitFor(() => expect(agendaRequests()).toBe(before + 1), { timeout: 4000 })
  })
})
