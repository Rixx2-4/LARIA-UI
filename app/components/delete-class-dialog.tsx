"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { lariaAPI } from "@/lib/laria-api"

// Confirmar antes de borrar una clase: no se puede deshacer. Es un diálogo modal:
// el foco empieza en «Cancelar» (lo seguro), no sale del diálogo con Tab, Escape
// lo cierra y, al cerrarse, vuelve a donde estaba
export function DeleteClassDialog({
  pathId,
  title,
  onClose,
  onDeleted,
}: {
  pathId: string
  title: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab" || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [deleting, onClose])

  const confirm = async () => {
    setDeleting(true)
    setError(null)
    try {
      await lariaAPI.paths.delete(pathId)
      toast.success(`Clase «${title}» borrada`)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la clase")
      setDeleting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-150" onClick={() => !deleting && onClose()} />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-2">
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              ¿Borrar la clase «{title}»?
            </h2>
            <p id={descriptionId} className="text-sm text-muted-foreground">
              Se borrará la clase y su progreso en el temario. Lo que ya aprendiste se queda en tu perfil, y si vuelves a
              crear una clase del mismo tema no tendrás que repetir la nivelación.
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting} className="gap-2">
            {deleting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
            {deleting ? "Borrando…" : "Borrar clase"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
