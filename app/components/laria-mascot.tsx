import { useId, type Ref } from "react"
import { cn } from "@/lib/utils"
import { MASCOT_PATHS } from "./laria-mascot-paths"

// LARIA, la mascota: el astronauta del logo de Plenum con sus trazos originales
// (laria-mascot-paths.ts), con los ojos y la boca aparte para poder animarlos.
// El casco y el cuerpo son una sola línea en el dibujo, así que se mueven juntos.
// Solo SVG y CSS: lo anima la tarjeta gráfica. Con «reducir movimiento», quieta.
//
// state, lo que está haciendo:
//   idle: flota y parpadea · thinking: mira arriba, ceja levantada y burbuja «…» ·
//   speaking: habla (la boca se abre) y se inclina hacia la pizarra
// emotion, cómo se siente (las del tutor del backend, más «surprised»):
//   calm · encouraging (sonríe) · patient (cejas amables y sonrisa suave) ·
//   celebratory (ojos sonrientes, gran sonrisa, destellos y saltitos) ·
//   surprised (cejas arriba, ojos grandes: «¡fíjate en esto!»)
// pointing: levanta el brazo y señala la pizarra (está a su izquierda)

export type MascotState = "idle" | "thinking" | "speaking"
export type MascotEmotion = "calm" | "encouraging" | "patient" | "celebratory" | "surprised"

const STATE_LABEL: Record<MascotState, string> = {
  idle: "LARIA",
  thinking: "LARIA está pensando",
  speaking: "LARIA está explicando",
}

const EMOTION_LABEL: Partial<Record<MascotEmotion, string>> = {
  encouraging: "contenta",
  patient: "paciente",
  celebratory: "celebrándolo",
  surprised: "sorprendida",
}

// Trazos añadidos, en coordenadas del logo y con su grosor de línea
const STROKE = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const

export function LariaMascot({
  state = "idle",
  emotion = "calm",
  pointing = false,
  className,
  ref,
}: {
  state?: MascotState
  emotion?: MascotEmotion
  pointing?: boolean
  className?: string
  ref?: Ref<SVGSVGElement>
}) {
  const id = useId().replace(/:/g, "")
  const noArm = `${id}-sin-brazo`
  const armZone = `${id}-zona-brazo`
  const mood = EMOTION_LABEL[emotion]
  const label = `${STATE_LABEL[state]}${mood ? `, ${mood}` : ""}${pointing ? ", señalando la pizarra" : ""}`
  const armMask = pointing ? `url(#${noArm})` : undefined

  return (
    <svg
      ref={ref}
      viewBox="60 60 410 540"
      role="img"
      aria-label={label}
      data-state={state}
      data-emotion={emotion}
      data-pointing={pointing || undefined}
      className={cn("laria-mascot text-foreground", className)}
      fill="currentColor"
    >
      {pointing && (
        <defs>
          {/* Para señalar, el brazo del dibujo se tapa y se pone uno que gira desde el hombro */}
          <mask id={noArm} maskUnits="userSpaceOnUse" x="60" y="60" width="410" height="540">
            <rect x="60" y="60" width="410" height="540" fill="white" />
            <path d={MASCOT_PATHS.armInner} fill="black" stroke="black" strokeWidth="18" />
          </mask>
          <mask id={armZone} maskUnits="userSpaceOnUse" x="60" y="60" width="410" height="540">
            <path d={MASCOT_PATHS.armInner} fill="white" stroke="white" strokeWidth="18" />
          </mask>
        </defs>
      )}
      <g className="mascot-float">
        <g className="mascot-head">
          {/* Relleno detrás de las líneas: así se ve igual sobre la pizarra oscura */}
          <path d={MASCOT_PATHS.silhouette} className="fill-background" mask={armMask} />
          <path d={MASCOT_PATHS.rest} fillRule="evenodd" mask={armMask} />
          {/* Con el brazo levantado, la línea del cuerpo que tapaba */}
          {pointing && <path d={MASCOT_PATHS.bodyInner} {...STROKE} strokeWidth="7" mask={`url(#${armZone})`} />}

          <g className="mascot-eyes">
            <path className="mascot-eye-dot" d={MASCOT_PATHS.eyeLeft} />
            <path className="mascot-eye-dot" d={MASCOT_PATHS.eyeRight} />
            <path className="mascot-eye-happy" d="M248 287 Q261 264 274 287 M354 282 Q366 259 378 282" {...STROKE} strokeWidth="7" />
          </g>
          <g className="mascot-brows" {...STROKE} strokeWidth="6">
            <path className="mascot-brows-patient" d="M243 250 Q257 241 272 247 M354 243 Q369 238 382 246" />
            <path className="mascot-brows-surprised" d="M242 240 Q258 226 274 236 M353 232 Q369 220 384 232" />
            <path className="mascot-brows-thinking" d="M352 236 Q368 224 384 236" />
          </g>
          <g className="mascot-mouth">
            <path className="mascot-mouth-closed" d={MASCOT_PATHS.mouth} />
            <path className="mascot-mouth-smile" d="M297 324 Q319 344 341 324" {...STROKE} strokeWidth="6" />
            <path className="mascot-mouth-grin" d="M294 320 Q319 358 344 320 Z" {...STROKE} fill="currentColor" strokeWidth="6" />
            <ellipse className="mascot-mouth-o" cx="319" cy="330" rx="8" ry="11" {...STROKE} strokeWidth="5" />
            {/* Al hablar: la boca abierta, con el mismo grosor que el trazo del dibujo */}
            <ellipse className="mascot-mouth-open" cx="319" cy="330" rx="13" ry="9" {...STROKE} strokeWidth="4.5" />
          </g>

          {/* Pensando: burbuja de puntos junto al casco */}
          <g className="mascot-thought">
            <circle cx="420" cy="132" r="6" />
            <circle cx="437" cy="112" r="8" />
            <circle cx="452" cy="88" r="10" />
          </g>
          {/* Celebrando: destellos alrededor del casco */}
          <g className="mascot-sparkles" {...STROKE} strokeWidth="6">
            <path d="M100 96 v26 M87 109 h26" />
            <path d="M438 150 v22 M427 161 h22" />
            <path d="M84 360 v18 M75 369 h18" />
          </g>
        </g>

        {pointing && (
          <g className="mascot-arm">
            <path d={MASCOT_PATHS.armInner} className="fill-background" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" />
          </g>
        )}
      </g>
    </svg>
  )
}
