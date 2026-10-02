import type { Ref } from "react"
import { cn } from "@/lib/utils"

// LARIA, la mascota: el astronauta del logo de Plenum redibujado con sus partes por
// separado (cuerpo, brazos, casco, ojos, boca) para poder animarlas. Solo SVG y CSS:
// lo anima la tarjeta gráfica y no pesa nada. Con «reducir movimiento», quieta.
//   idle: flota y parpadea · thinking: inclina la cabeza y mira arriba ·
//   speaking: habla (la boca se abre) y señala la pizarra con el brazo izquierdo

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
      viewBox="0 0 200 230"
      role="img"
      aria-label={STATE_LABEL[state]}
      data-state={state}
      className={cn("laria-mascot text-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="mascot-float">
        {/* Cuerpo y brazos, detrás de la cabeza */}
        <g className="mascot-body">
          <path d="M66 162 C58 186 60 214 82 222 C96 227 112 227 124 222 C144 213 146 186 136 162" className="fill-background" />
          <path d="M72 205 C88 196 114 196 132 206" strokeWidth={3.5} />
        </g>
        <g className="mascot-arm-left">
          <path d="M66 170 C52 176 46 196 50 212 C52 220 62 220 64 212 C66 200 68 188 72 178" className="fill-background" />
        </g>
        <g className="mascot-arm-right">
          <path d="M136 170 C150 176 156 196 152 212 C150 220 140 220 138 212 C136 200 134 188 130 178" className="fill-background" />
        </g>

        <g className="mascot-head">
          {/* Auriculares del casco */}
          <path d="M34 78 C22 80 20 112 32 116 C40 118 44 112 44 98 C44 86 42 77 34 78 Z" className="fill-background" />
          <path d="M168 80 C176 82 177 108 169 112" />
          {/* Casco y visor */}
          <circle cx="102" cy="92" r="70" className="fill-background" />
          <ellipse cx="108" cy="98" rx="52" ry="47" strokeWidth={4} />
          {/* Cara */}
          <g className="mascot-eyes" stroke="none" fill="currentColor">
            <ellipse cx="88" cy="96" rx="5" ry="6.5" />
            <ellipse cx="126" cy="96" rx="5" ry="6.5" />
          </g>
          <g className="mascot-mouth">
            <path className="mascot-mouth-closed" d="M100 118 L114 118" strokeWidth={3.5} />
            <ellipse className="mascot-mouth-open" cx="107" cy="119" rx="6" ry="4.5" strokeWidth={3} />
          </g>
        </g>
      </g>
    </svg>
  )
}
