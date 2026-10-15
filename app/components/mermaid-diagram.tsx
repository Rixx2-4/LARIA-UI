"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTheme } from "next-themes"
import { Loader2, Maximize2, X } from "lucide-react"
import { diagramLabel, diagramName, diagramOutline, MAX_DIAGRAM_CHARS, prepareDiagram } from "@/lib/diagrams"

// Fuerza el tema de los esquemas: la pizarra es verde oscuro aunque la app esté en claro
export const DiagramThemeContext = createContext<"dark" | null>(null)

// Mermaid pesa: solo se baja cuando una respuesta trae un esquema, y una sola vez
let mermaidModule: Promise<typeof import("mermaid").default> | null = null
const loadMermaid = () => (mermaidModule ??= import("mermaid").then((m) => m.default))

// Los tipos que sirven para explicar (procesos, secuencias, estados, conceptos,
// cronologías, proporciones, relaciones). Los demás (arquitectura con iconos,
// kanban con imágenes, C4, ZenUML…) no se dibujan: menos superficie para el
// código que escribe el modelo
const ALLOWED_TYPES = new Set([
  "flowchart", "flowchart-v2", "graph",
  "sequence",
  "stateDiagram", "state",
  "classDiagram", "class",
  "er",
  "mindmap",
  "timeline",
  "pie",
  "xychart",
])

type Drawn = { svg: string; name: string; label: string; minWidth: number | null }
type Outcome = Drawn | { error: "invalid" | "too-large" }

// Cada esquema se dibuja una vez por tema: si el mensaje se vuelve a pintar (llega
// otro trozo, otro esquema, el texto final del envelope), se reutiliza al momento,
// sin parpadeo ni otra pasada de Mermaid. Los que se están dibujando se comparten
const drawn = new Map<string, Outcome>()
const drawing = new Map<string, Promise<Outcome>>()
const MAX_REMEMBERED = 40
// Un id por dibujo, único en toda la página aunque haya muchos mensajes con esquemas
let drawCount = 0

// Para los tests: empezar sin esquemas recordados
export function forgetDiagrams() {
  drawn.clear()
  drawing.clear()
}

function remember(key: string, outcome: Outcome): Outcome {
  drawn.set(key, outcome)
  if (drawn.size > MAX_REMEMBERED) drawn.delete(drawn.keys().next().value!)
  return outcome
}

const keyOf = (source: string, dark: boolean) => `${dark ? "oscuro" : "claro"}\n${source}`

// Lo ya decidido sin Mermaid (vacío, demasiado grande) o ya dibujado antes
function known(raw: string, dark: boolean): Outcome | null {
  const prepared = prepareDiagram(raw)
  if (!prepared.ok) return { error: prepared.reason === "too-large" ? "too-large" : "invalid" }
  return drawn.get(keyOf(prepared.source, dark)) ?? null
}

// Mermaid se configura de forma global: los dibujos van de uno en uno, cada uno con su tema
let queue: Promise<unknown> = Promise.resolve()

function draw(raw: string, dark: boolean): Promise<Outcome> {
  const prepared = prepareDiagram(raw)
  if (!prepared.ok) return Promise.resolve({ error: prepared.reason === "too-large" ? "too-large" : "invalid" })
  const source = prepared.source
  const key = keyOf(source, dark)
  const done = drawn.get(key)
  if (done) return Promise.resolve(done)
  const inFlight = drawing.get(key)
  if (inFlight) return inFlight

  const run = loadMermaid()
    .then((mermaid) => {
      const turn = queue.then(async (): Promise<Outcome> => {
        mermaid.initialize({
          startOnLoad: false,
          // Sin HTML, scripts ni clics dentro del esquema. Estas opciones están en la
          // lista "secure" de Mermaid: ninguna directiva del esquema puede cambiarlas
          securityLevel: "strict",
          maxTextSize: MAX_DIAGRAM_CHARS,
          maxEdges: 200,
          theme: dark ? "dark" : "default",
          fontFamily: "inherit",
          suppressErrorRendering: true,
        })
        // Primero la sintaxis y el tipo; solo lo válido y permitido se dibuja
        const parsed = await mermaid.parse(source, { suppressErrors: true })
        if (!parsed || !ALLOWED_TYPES.has(parsed.diagramType)) return { error: "invalid" }
        const id = `esquema-${++drawCount}`
        try {
          const svg = cleanSvg((await mermaid.render(id, source)).svg)
          return { svg, name: diagramName(source), label: diagramLabel(source, svgLabels(svg)), minWidth: legibleWidth(svg) }
        } finally {
          // Si falla, Mermaid puede dejar su borrador en el body
          document.getElementById(`d${id}`)?.remove()
        }
      })
      queue = turn.catch(() => {})
      return turn
    })
    .catch((): Outcome => ({ error: "invalid" }))
    .then((outcome) => {
      drawing.delete(key)
      return remember(key, outcome)
    })
  drawing.set(key, run)
  return run
}

// El SVG sale de contenido no confiable: aunque Mermaid en modo estricto ya limpia
// las etiquetas, aquí se quita además todo lo que pueda ejecutar código o pedir algo
// fuera de la página (imágenes, enlaces, url() del CSS). Las referencias internas
// (#marcador de las flechas) se quedan
const EXTERNAL_URL = /url\(\s*['"]?(?!#)[^)]*\)/gi
function cleanSvg(svg: string): string {
  const template = document.createElement("template")
  template.innerHTML = svg
  const root = template.content
  root.querySelectorAll("script, image, img, iframe, object, embed, audio, video, link, meta, use").forEach((node) => node.remove())
  for (const element of root.querySelectorAll("*")) {
    for (const { name, value } of [...element.attributes]) {
      const attribute = name.toLowerCase()
      const reference = attribute === "href" || attribute.endsWith(":href") || attribute === "src"
      if (attribute.startsWith("on") || (reference && !value.trim().startsWith("#")) || /url\(\s*['"]?(?!#)/i.test(value)) {
        element.removeAttribute(name)
      }
    }
  }
  for (const style of root.querySelectorAll("style")) {
    style.textContent = (style.textContent ?? "").replace(/@import[^;]*;?/gi, "").replace(EXTERNAL_URL, "none")
  }
  return template.innerHTML
}

// Las etiquetas de los nodos, para el lector de pantalla
function svgLabels(svg: string): string[] {
  const template = document.createElement("template")
  template.innerHTML = svg
  return [...template.content.querySelectorAll(".nodeLabel, .label, text")].map((node) => node.textContent ?? "")
}

// En el móvil, un esquema ancho (LR, líneas de tiempo) se encogería hasta dejar las
// letras diminutas: por debajo del 60 % de su tamaño ya no se encoge, se desplaza
// dentro de su caja. Los que caben en cualquier pantalla no necesitan mínimo
function legibleWidth(svg: string): number | null {
  const width = Number(/viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)/.exec(svg)?.[1])
  const min = Math.round(width * 0.6)
  return Number.isFinite(min) && min > 320 ? min : null
}

// Un esquema del tutor, dibujado. Si Mermaid no puede (o el esquema no es válido o es
// demasiado grande), un aviso discreto y su contenido en texto; nunca el código ni el
// error. En el móvil se desplaza dentro de su caja y se puede ampliar
export function MermaidDiagram({ source }: { source: string }) {
  const forced = useContext(DiagramThemeContext)
  const { resolvedTheme } = useTheme()
  const dark = forced === "dark" || resolvedTheme === "dark"
  const key = keyOf(source, dark)
  const [latest, setLatest] = useState<{ key: string; outcome: Outcome } | null>(null)
  const outcome = latest?.key === key ? latest.outcome : known(source, dark)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (known(source, dark)) return
    let cancelled = false
    draw(source, dark).then((result) => !cancelled && setLatest({ key: keyOf(source, dark), outcome: result }))
    return () => {
      cancelled = true
    }
  }, [source, dark])

  if (!outcome) return <DrawingDiagram />
  if ("error" in outcome) return <DiagramFallback source={source} tooLarge={outcome.error === "too-large"} />

  return (
    <>
      <figure className="group relative my-3">
        <div
          role="img"
          aria-label={outcome.label}
          className="mermaid-diagram overflow-x-auto rounded-lg bg-foreground/[0.03] p-2"
          style={outcome.minWidth ? ({ "--diagram-min-width": `${outcome.minWidth}px` } as React.CSSProperties) : undefined}
          dangerouslySetInnerHTML={{ __html: outcome.svg }}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Ampliar: ${outcome.name}`}
          className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1.5 text-foreground opacity-70 shadow-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </figure>
      {expanded && <ExpandedDiagram svg={outcome.svg} label={outcome.label} dark={dark} onClose={() => setExpanded(false)} />}
    </>
  )
}

// Cuando no se puede dibujar: el resto de la respuesta sigue igual y lo que decía el
// esquema se puede leer como lista (pasos con flechas, ramas, fechas)
function DiagramFallback({ source, tooLarge }: { source: string; tooLarge: boolean }) {
  const outline = diagramOutline(source)
  return (
    <div className="my-2 text-sm">
      <p className="italic opacity-70">
        {tooLarge ? "El esquema es demasiado grande para dibujarlo." : "No se pudo dibujar el esquema."}
      </p>
      {outline.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer underline-offset-2 opacity-80 hover:underline">Ver el esquema en texto</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {outline.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
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
