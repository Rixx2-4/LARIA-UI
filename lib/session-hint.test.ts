import { describe, it, expect } from "vitest"
import { looksSignedIn } from "./session-hint"

describe("looksSignedIn", () => {
  it("con la cookie de Clerk a una hora, hay sesión; a 0 o sin ella, no", () => {
    expect(looksSignedIn("__client_uat=1790000000")).toBe(true)
    expect(looksSignedIn("theme=dark; __client_uat_Xy9=1790000000")).toBe(true)
    expect(looksSignedIn("__client_uat=0; __client_uat_Xy9=0")).toBe(false)
    expect(looksSignedIn("theme=dark")).toBe(false)
    expect(looksSignedIn("my__client_uat=123")).toBe(false)
  })
})
