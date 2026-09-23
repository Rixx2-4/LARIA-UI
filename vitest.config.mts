import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "jsdom",
    exclude: ["node_modules/**", ".next/**"],
  },
})
