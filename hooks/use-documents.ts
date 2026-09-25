"use client"

import { useEffect, useState } from "react"
import { lariaAPI, ApiError, type Document } from "@/lib/laria-api"

const POLL_MS = 3000
const MAX_RETRY_MS = 30000
// Un estado que el backend nunca cierra no debe consultarse para siempre (~10 min)
const MAX_POLLS = 200

export type DocumentState = "ready" | "failed" | "processing"

export function documentState(doc: Document): DocumentState {
  if (doc.status === "analysis_failed") return "failed"
  if (doc.status === "analyzed" || doc.has_analysis) return "ready"
  return "processing"
}

// Los documentos del usuario; mientras alguno se procesa, se vuelve a consultar
export function useDocuments(enabled: boolean) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  // false hasta la primera respuesta, buena o mala
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let polls = 0
    let retryMs = POLL_MS

    const load = async () => {
      polls++
      try {
        const docs = await lariaAPI.documents.list()
        if (cancelled) return
        setDocuments(docs)
        setLoadFailed(false)
        setLoaded(true)
        retryMs = POLL_MS
        if (docs.some((d) => documentState(d) === "processing") && polls < MAX_POLLS) {
          timer = setTimeout(load, POLL_MS)
        }
      } catch (error) {
        if (cancelled) return
        // Se conserva la última lista; con un 401 la sesión ya se está cerrando
        setLoadFailed(true)
        setLoaded(true)
        if (!(error instanceof ApiError && error.status === 401) && polls < MAX_POLLS) {
          timer = setTimeout(load, retryMs)
          retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
        }
      }
    }

    load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled])

  return { documents, loadFailed, loaded }
}
