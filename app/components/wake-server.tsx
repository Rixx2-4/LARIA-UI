"use client"

import { useEffect } from "react"
import { wakeServer } from "@/lib/laria-api"

// Al abrir la portada o entrar, despierta el servidor (Render lo duerme sin uso) sin
// esperar su respuesta: cuando la persona entra, ya está arrancado o casi
export function WakeServer() {
  useEffect(() => wakeServer(), [])
  return null
}
