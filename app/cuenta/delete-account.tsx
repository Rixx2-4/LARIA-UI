"use client"

import { useState } from "react"
import { useClerk, useReverification } from "@clerk/nextjs"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiError, lariaAPI } from "@/lib/laria-api"

// Borrar la cuenta: se escribe BORRAR para confirmar. Si hace más de 10 minutos que
// no se verificó la identidad, el backend responde 403 (reason
// "reverification_required") y Clerk la pide (contraseña o código) antes de
// reintentar. Al terminar, se cierra la sesión y se va a la portada

const CONFIRM_WORD = "BORRAR"

// El aviso con el formato que reconoce useReverification de Clerk
const REVERIFICATION_HINT = {
  clerk_error: { type: "forbidden", reason: "reverification-error", metadata: { reverification: { level: "first_factor", afterMinutes: 10 } } },
}

export function DeleteAccount() {
  const clerk = useClerk()
  const [confirming, setConfirming] = useState(false)
  const [word, setWord] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteWithReverification = useReverification(async () => {
    try {
      await lariaAPI.auth.deleteAccount()
      return "deleted" as const
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.reason === "reverification_required") return REVERIFICATION_HINT
      throw err
    }
  })

  const remove = async () => {
    setDeleting(true)
    setError(null)
    try {
      const result = await deleteWithReverification()
      if (result !== "deleted") return setDeleting(false)
      // La cuenta ya no existe: se cierra la sesión sin más peticiones
      await clerk.signOut().catch(() => {})
      window.location.replace("/?cuenta=borrada")
    } catch (err) {
      setDeleting(false)
      // Si se cancela la verificación de identidad, no es un error
      if (err && typeof err === "object" && "code" in err && err.code === "reverification_cancelled") return
      setError(err instanceof Error ? err.message : "No se pudo borrar la cuenta. Vuelve a intentarlo.")
    }
  }

  return (
    <section aria-labelledby="borrar-cuenta" className="w-full max-w-[880px] rounded-xl border border-destructive/30 p-5">
      <h2 id="borrar-cuenta" className="font-semibold">
        Borrar mi cuenta
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Se borran tu cuenta, tus chats, tus documentos, tus clases y tu progreso. No se puede deshacer.
      </p>
      {!confirming ? (
        <Button variant="outline" className="mt-4 gap-2 text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Borrar mi cuenta
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Para confirmar, escribe <span className="font-semibold">{CONFIRM_WORD}</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={word.trim().toUpperCase() !== CONFIRM_WORD || deleting} onClick={remove} className="gap-2">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {error ? "Reintentar" : "Borrar definitivamente"}
            </Button>
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => {
                setConfirming(false)
                setWord("")
                setError(null)
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
