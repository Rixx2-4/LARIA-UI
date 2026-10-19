import { describe, it, expect } from "vitest"
import { backendOrigin, backendRewrites } from "./backend-proxy.mjs"
import { healthUrl } from "./laria-api"

describe("proxy hacia la API", () => {
  it("sin variable no hay proxy", () => {
    expect(backendRewrites(undefined)).toEqual([])
    expect(backendRewrites("  ")).toEqual([])
  })

  it("reenvía /backend a /api/v1 y /backend/health a /health, siempre al mismo origen", () => {
    expect(backendRewrites("https://api.example.com")).toEqual([
      { source: "/backend/health", destination: "https://api.example.com/health" },
      { source: "/backend/:path(.*)", destination: "https://api.example.com/api/v1/:path" },
    ])
  })

  it("normaliza la barra final del origen", () => {
    expect(backendOrigin("https://api.example.com/")).toBe("https://api.example.com")
  })

  it.each([
    ["http://api.example.com", "https"],
    ["https://api.example.com/api/v1", "solo el origen"],
    ["https://api.example.com?x=1", "solo el origen"],
    ["https://user:pass@api.example.com", "solo el origen"],
    ["ftp://api.example.com", "https"],
  ])("rechaza %s", (raw, message) => {
    expect(() => backendRewrites(raw)).toThrow(message)
  })

  it("rechaza lo que no es una URL", () => {
    expect(() => backendRewrites("api.example.com")).toThrow()
  })

  it("acepta http solo en local", () => {
    expect(backendOrigin("http://localhost:8000")).toBe("http://localhost:8000")
    expect(backendOrigin("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000")
  })
})

describe("healthUrl", () => {
  it("tras el proxy, /backend/health", () => {
    expect(healthUrl("/backend")).toBe("/backend/health")
  })

  it("con la URL completa, /health en la raíz del servidor", () => {
    expect(healthUrl("https://api.example.com/api/v1")).toBe("https://api.example.com/health")
  })
})
