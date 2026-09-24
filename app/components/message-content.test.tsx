import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { MessageContent } from "./message-content"

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
})
