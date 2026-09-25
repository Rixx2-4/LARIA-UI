import { vi } from "vitest"

// Simula la preferencia del sistema "reducir movimiento" (se deshace con vi.restoreAllMocks)
export function preferReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        // "(prefers-reduced-motion)" a secas también coincide, como en los navegadores
        matches: query.includes("prefers-reduced-motion") && !query.includes("no-preference"),
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
}
