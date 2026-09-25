"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sonner"

// Los avisos siguen el tema de la app, no solo el del sistema
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="top-center"
      richColors
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      style={{ fontFamily: "inherit" }}
    />
  )
}
