import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { MathText, MessageContent } from "./message-content"

afterEach(cleanup)

describe("MessageContent", () => {
  it("pinta Markdown: negritas, listas y tablas", () => {
    const { container } = render(
      <MessageContent content={"La **mitocondria** produce energía:\n\n- ATP\n- Calor\n\n| Orgánulo | Función |\n|---|---|\n| Núcleo | ADN |"} />,
    )

    expect(container.querySelector("strong")?.textContent).toBe("mitocondria")
    expect(container.querySelectorAll("li")).toHaveLength(2)
    expect(container.querySelector("table td")?.textContent).toBe("Núcleo")
  })

  it("pinta fórmulas LaTeX en línea y en bloque", () => {
    const { container } = render(<MessageContent content={"Energía: $E=mc^2$\n\n$$\\frac{a}{b}$$"} />)

    expect(container.querySelectorAll(".katex")).toHaveLength(2)
    expect(container.querySelector(".katex-display")).not.toBeNull()
  })

  it("acepta también la notación \\( \\) y \\[ \\] que usan muchos modelos", () => {
    const { container } = render(<MessageContent content={"Sea \\(x^2\\):\n\n\\[\\int_0^1 x\\,dx\\]"} />)

    expect(container.querySelectorAll(".katex")).toHaveLength(2)
    expect(container.querySelector(".katex-display")).not.toBeNull()
  })

  it("no toca los $ dentro de un bloque de código", () => {
    const { container } = render(<MessageContent content={"```bash\necho $$HOME$$\n```"} />)

    expect(container.querySelector(".katex")).toBeNull()
    expect(container.querySelector("pre code")?.textContent).toContain("echo $$HOME$$")
  })

  it("pinta los bloques de código con su lenguaje", () => {
    const { container } = render(<MessageContent content={"```python\nprint('hola')\n```"} />)

    const code = container.querySelector("pre code")
    expect(code?.textContent).toContain("print('hola')")
    expect(code?.className).toContain("language-python")
  })

  it("no ejecuta HTML que venga en la respuesta", () => {
    const { container } = render(<MessageContent content={'<img src=x onerror="alert(1)"> hola'} />)

    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("hola")
  })

  it("las cantidades de dinero no se confunden con fórmulas", () => {
    const { container } = render(<MessageContent content={"El libro cuesta $5 y el cuaderno $10. Área: $x^2$"} />)

    expect(container.textContent).toContain("cuesta $5 y el cuaderno $10")
    expect(container.querySelectorAll(".katex")).toHaveLength(1)
  })

  it("una fórmula que empieza por número sí se pinta (respuesta real del tutor)", () => {
    const { container } = render(
      <MessageContent content={"Por ejemplo, en la ecuación $2x + 3 = 7$ despejas x. Otra: $3x+1$. Y un número suelto: $2$."} />,
    )

    expect(container.querySelectorAll(".katex")).toHaveLength(3)
    expect(container.querySelector(".katex-error")).toBeNull()
  })

  it("dinero y fórmulas en la misma línea", () => {
    const { container } = render(<MessageContent content={"Con $20 compras 4, así que cada uno vale $\\frac{20}{4} = 5$"} />)

    expect(container.textContent).toContain("Con $20 compras")
    expect(container.querySelectorAll(".katex")).toHaveLength(1)
  })

  it("no toca la notación LaTeX escrita dentro de código en línea", () => {
    const { container } = render(<MessageContent content={"Escribe `\\(x\\)` para una fórmula"} />)

    expect(container.querySelector("code")?.textContent).toBe("\\(x\\)")
    expect(container.querySelector(".katex")).toBeNull()
  })
})

describe("MathText (enunciados y opciones de los quizzes)", () => {
  it("dibuja las fórmulas \\( … \\) con KaTeX, sin párrafos alrededor", () => {
    const { container } = render(
      <button>
        <MathText text={"¿Cuánto es \\( \\frac{3}{4} + \\frac{1}{4} \\)?"} />
      </button>,
    )
    expect(container.querySelector(".katex")).toBeTruthy()
    expect(container.querySelector("p")).toBeNull()
    expect(container.textContent).toContain("¿Cuánto es")
    // Ni los delimitadores sin procesar (la fórmula original solo queda en la anotación MathML de KaTeX)
    expect(container.querySelector(".katex-html")).toBeTruthy()
    expect(container.textContent).not.toContain("\\(")
  })

  it("sin fórmulas deja el texto tal cual: un «1.» o un «*» no se vuelven markdown", () => {
    const { container } = render(
      <p>
        <MathText text="1. Multiplica 3 * 4 * 5" />
      </p>,
    )
    expect(container.textContent).toBe("1. Multiplica 3 * 4 * 5")
    expect(container.querySelector("ol, em")).toBeNull()
  })
})
