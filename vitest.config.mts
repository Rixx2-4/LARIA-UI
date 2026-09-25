import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Con todos los archivos en paralelo, jsdom va lento y los 5 s por defecto no bastan
    testTimeout: 15000,
    // Un test que se pasa de tiempo con la máquina cargada se reintenta una vez;
    // uno roto de verdad falla las dos y el push sigue bloqueado
    retry: 1,
  },
})
