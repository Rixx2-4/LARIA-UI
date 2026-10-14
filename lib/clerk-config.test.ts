import { describe, it, expect } from "vitest"
import { frontendApiFromKey } from "./clerk-config"

const key = (host: string, env = "test") => `pk_${env}_${btoa(`${host}$`)}`

describe("frontendApiFromKey", () => {
  it("saca el dominio de Clerk de la clave publicable (para abrir la conexión antes)", () => {
    expect(frontendApiFromKey(key("glorious-bluejay-3695.clerk.accounts.dev"))).toBe("glorious-bluejay-3695.clerk.accounts.dev")
    expect(frontendApiFromKey(key("clerk.plenum.app", "live"))).toBe("clerk.plenum.app")
  })

  it("sin clave o con una que no se entiende, nada (sin preconnect)", () => {
    expect(frontendApiFromKey("")).toBeNull()
    expect(frontendApiFromKey("pk_test_%%%")).toBeNull()
    expect(frontendApiFromKey(`pk_test_${btoa("sin-dolar.example")}`)).toBeNull()
    expect(frontendApiFromKey(`pk_test_${btoa("evil.example/x$")}`)).toBeNull()
  })
})
