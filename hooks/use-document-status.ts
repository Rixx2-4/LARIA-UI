"use client"

import { useEffect, useState } from "react"
import { lariaAPI } from "@/lib/laria-api"

// El backend analiza cada documento en segundo plano al subirlo: "uploaded" →
// "analyzing" → "analyzed", o "error" con su motivo. Mientras no termina se consulta
// cada pocos segundos; con un tope, por si el backend no llega a analizarlo nunca
const POLL_MS = 5000
const MAX_POLLS = 36 // 3 minutos
const PENDING = new Set(["uploaded", "analyzing"])

export interface DocumentStatus {
  status: string | null
  errorMessage: string | null
}

export function useDocumentStatus(documentId: string | undefined, initialStatus: string | undefined): DocumentStatus {
  const [state, setState] = useState<DocumentStatus>({ status: initialStatus ?? null, errorMessage: null })

  useEffect(() => {
    if (!documentId || !PENDING.has(initialStatus ?? "")) return
    let cancelled = false
    let polls = 0
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      polls++
      try {
        const doc = await lariaAPI.documents.get(documentId)
        if (cancelled) return
        setState({ status: doc.status, errorMessage: doc.error_message })
        if (!PENDING.has(doc.status)) return
      } catch {
        // Un fallo suelto no corta la consulta: se reintenta en la siguiente
        if (cancelled) return
      }
      if (polls < MAX_POLLS) timer = setTimeout(poll, POLL_MS)
    }
    timer = setTimeout(poll, POLL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [documentId, initialStatus])

  return state
}
