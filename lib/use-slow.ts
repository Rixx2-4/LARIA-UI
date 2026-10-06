"use client"

import { useEffect, useState } from "react"

// true si algo lleva más de `ms` en marcha: para explicar una espera larga en vez de
// dejar un spinner mudo (p. ej. abrir un tramo nuevo, que investiga en internet)
export function useSlow(active: boolean, ms = 5000): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setSlow(true), ms)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [active, ms])
  return active && slow
}
