import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ModuleSources } from "./module-sources"

afterEach(cleanup)

describe("ModuleSources", () => {
  it("enlaza las fuentes en otra pestaña; sin título, muestra el dominio", () => {
    render(
      <ModuleSources
        sources={[
          { title: "Khan Academy: ecuaciones", url: "https://es.khanacademy.org/math/ecuaciones" },
          { title: "", url: "https://www.unam.mx/temario" },
        ]}
      />,
    )
    const khan = screen.getByRole("link", { name: /Khan Academy: ecuaciones/ })
    expect(khan.getAttribute("href")).toBe("https://es.khanacademy.org/math/ecuaciones")
    expect(khan.getAttribute("target")).toBe("_blank")
    expect(khan.getAttribute("rel")).toBe("noopener noreferrer")
    expect(screen.getByRole("link", { name: /unam\.mx/ })).toBeTruthy()
  })

  it("no enlaza nada que no sea una web (javascript:, datos raros); sin fuentes, no se muestra", () => {
    const { container } = render(
      <ModuleSources sources={[{ title: "Malo", url: "javascript:alert(1)" }, { title: "Roto", url: "no es una url" }]} />,
    )
    expect(container.textContent).toBe("")
    cleanup()
    expect(render(<ModuleSources sources={[]} />).container.textContent).toBe("")
  })
})
