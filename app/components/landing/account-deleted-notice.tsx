"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

// Tras borrar la cuenta se llega aquí con ?cuenta=borrada: se avisa una vez y se
// limpia la URL (recargar no vuelve a mostrarlo)
export function AccountDeletedNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("cuenta") !== "borrada") return
    // Solo existe en el navegador: se lee al montar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)
    window.history.replaceState(null, "", window.location.pathname)
  }, [])
  if (!show) return null
  return (
    <div role="status" className="mx-auto mt-4 flex max-w-6xl items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm sm:mx-6 lg:mx-auto">
      <p>Tu cuenta y tus datos se borraron. Gracias por haber estudiado con LARIA.</p>
      <button type="button" onClick={() => setShow(false)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
