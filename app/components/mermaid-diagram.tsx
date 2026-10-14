"use client"

import { createContext, useContext, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTheme } from "next-themes"
import { Loader2, Maximize2, X } from "lucide-react"
import { diagramLabel, diagramName } from "@/lib/diagrams"

// Fuerza el tema de los esquemas: la pizarra es verde oscuro aunque la app esté en claro
export const DiagramThemeContext = createContext<"dark" | null>(null)

// Mermaid pesa: solo se baja cuando una respuesta trae un esquema, y una sola vez
let mermaidModule: Promise<typeof import("mermaid").default> | null = null
const loadMermaid = () => (mermaidModule ??= import("mermaid").then((m) => m.default))

// Mermaid se configura de forma global: los dibujos van de uno en uno, cada uno con su tema
let queue: Promise<unknown> = Promise.resolve()

async function renderDiagram(id: string, source: string, dark: boolean): Promise<string> {
  const mermaid = await loadMermaid()
  const run = queue.then(async () => {
    mermaid.initialize({
      startOnLoad: false,
      // Sin HTML, scripts ni clics dentro del esquema, aunque el servidor ya lo valida
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
      fontFamily: "inherit",
      suppressErrorRendering: true,
    })
    try {
      return (await mermaid.render(id, source)).svg
    } finally {
      // Si falla, Mermaid puede dejar su borrador en el body
      document.getElementById(`d${id}`)?.remove()
    }
  })
  queue = run.catch(() => {})
  return run
}

// Un esquema del tutor, dibujado. Si Mermaid no puede, un aviso discreto: nunca el
// código ni el error. En el móvil se desplaza dentro de su caja y se puede ampliar
export function MermaidDiagram({ source }: { source: string }) {
  const forced = useContext(DiagramThemeContext)
  const { resolvedTheme } = useTheme()
  const dark = forced === "dark" || resolvedTheme === "dark"
  const id = `esquema-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`
  const [result, setResult] = useState<{ svg: string; label: string } | "error" | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    renderDiagram(id, source, dark)
      .then((svg) => {
        if (cancelled) return
        // Las etiquetas de los nodos, para el lector de pantalla
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
        const labels = [...doc.querySelectorAll(".nodeLabel, .label, text")].map((node) => node.textContent ?? "")
        setResult({ svg, label: diagramLabel(source, labels) })
      })
      .catch(() => !cancelled && setResult("error"))
    return () => {
      cancelled = true
    }
  }, [id, source, dark])

  if (result === "error") {
    return <p className="my-2 text-sm italic opacity-70">No se pudo dibujar el esquema.</p>
  }
  if (!result) return <DrawingDiagram />

  return (
    <>
      <figure className="group relative my-3">
        <div
          role="img"
          aria-label={result.label}
          className="mermaid-diagram overflow-x-auto rounded-lg bg-foreground/[0.03] p-2"
          dangerouslySetInnerHTML={{ __html: result.svg }}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Ampliar: ${diagramName(source)}`}
          className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1.5 text-foreground opacity-70 shadow-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </figure>
      {expanded && <ExpandedDiagram svg={result.svg} label={result.label} dark={dark} onClose={() => setExpanded(false)} />}
    </>
  )
}

// Mientras el bloque aún llega: no se enseña el código a medias
export function DrawingDiagram() {
  return (
    <p role="status" className="my-3 flex items-center gap-2 rounded-lg border border-dashed border-current/25 px-3 py-4 text-sm opacity-75">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
      Dibujando el esquema…
    </p>
  )
}

// A pantalla completa y a su tamaño real, con desplazamiento: para leerlo en el móvil
function ExpandedDiagram({ svg, label, dark, onClose }: { svg: string; label: string; dark: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    // Si es más ancho que la pantalla, se abre por el centro
    const body = bodyRef.current
    if (body) body.scrollLeft = (body.scrollWidth - body.clientWidth) / 2
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Esquema ampliado"
      className={`fixed inset-0 z-[90] flex flex-col ${dark ? "bg-[#1b1b1f] text-white" : "bg-white text-black"}`}
    >
      <div className="flex justify-end p-2">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-2 hover:bg-current/10">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div
        ref={bodyRef}
        role="img"
        aria-label={label}
        className="mermaid-diagram mermaid-diagram-expanded flex-1 overflow-auto p-4"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>,
    document.body,
  )
}
