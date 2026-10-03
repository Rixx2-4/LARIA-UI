import type { Ref } from "react"
import { cn } from "@/lib/utils"
import { MASCOT_PATHS } from "./laria-mascot-paths"

// LARIA, la mascota: el astronauta del logo de Plenum con sus trazos originales
// (laria-mascot-paths.ts), con los ojos y la boca aparte para poder animarlos.
// El casco y el cuerpo son una sola línea en el dibujo, así que se mueven juntos.
// Solo SVG y CSS: lo anima la tarjeta gráfica. Con «reducir movimiento», quieta.
//   idle: flota y parpadea · thinking: inclina la cabeza y mira arriba ·
//   speaking: habla (la boca se abre) y se inclina hacia la pizarra

export type MascotState = "idle" | "thinking" | "speaking"

const STATE_LABEL: Record<MascotState, string> = {
  idle: "LARIA",
  thinking: "LARIA está pensando",
  speaking: "LARIA está explicando",
}

// Con `ref`, quien tenga el volumen del audio puede mover la boca: pone en el SVG
// data-lipsync y la variable --mouth (de 0 a 1), y la boca deja el bucle
export function LariaMascot({ state = "idle", className, ref }: { state?: MascotState; className?: string; ref?: Ref<SVGSVGElement> }) {
  return (
    <svg
      ref={ref}
      viewBox="60 60 410 540"
      role="img"
      aria-label={STATE_LABEL[state]}
      data-state={state}
      className={cn("laria-mascot text-foreground", className)}
      fill="currentColor"
    >
      <g className="mascot-float">
        <g className="mascot-head">
          {/* Relleno detrás de las líneas: así se ve igual sobre la pizarra oscura */}
          <path d={MASCOT_PATHS.silhouette} className="fill-background" />
          <path d={MASCOT_PATHS.rest} fillRule="evenodd" />
          <g className="mascot-eyes">
            <path d={MASCOT_PATHS.eyeLeft} />
            <path d={MASCOT_PATHS.eyeRight} />
          </g>
          <g className="mascot-mouth">
            <path className="mascot-mouth-closed" d={MASCOT_PATHS.mouth} />
            {/* Al hablar: la boca abierta, con el mismo grosor que el trazo del dibujo */}
            <ellipse className="mascot-mouth-open" cx="319" cy="330" rx="13" ry="9" fill="none" stroke="currentColor" strokeWidth="4.5" />
          </g>
        </g>
      </g>
    </svg>
  )
}
