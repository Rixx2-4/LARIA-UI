"use client"

import { useState, type PointerEvent } from "react"
import type { RetentionCurve } from "@/lib/laria-api"
import { percent, shortDate } from "@/lib/reviews"

// La curva del olvido de un concepto (ADR-051): la estimación del modelo (línea
// discontinua) y la nota real de cada repaso (puntos), siempre distinguibles. La línea
// del objetivo marca cuándo toca repasar. Al pasar el ratón se lee el valor estimado

const W = 600
const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 40 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

// now: el instante de «Hoy» (por defecto, al abrirla)
export function ForgettingCurve({ curve, now: fixedNow }: { curve: RetentionCurve; now?: number }) {
  const [openedAt] = useState(() => Date.now())
  const now = fixedNow ?? openedAt
  const [hover, setHover] = useState<number | null>(null)
  const times = [
    ...curve.estimated.map((p) => Date.parse(p.at)),
    ...curve.measured.map((p) => Date.parse(p.at)),
    Date.parse(curve.next_review_at),
    now,
  ]
  const start = Math.min(...times)
  const end = Math.max(...times)
  const span = Math.max(end - start, 1)
  const x = (t: number) => PAD.left + ((t - start) / span) * PLOT_W
  const y = (ratio: number) => PAD.top + (1 - Math.max(0, Math.min(1, ratio))) * PLOT_H

  const line = curve.estimated.map((p, i) => `${i ? "L" : "M"}${x(Date.parse(p.at)).toFixed(1)},${y(p.retention).toFixed(1)}`).join(" ")
  const next = x(Date.parse(curve.next_review_at))
  const today = x(now)
  const hovered = hover === null ? null : curve.estimated[hover]

  // El punto estimado más cercano al puntero
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!curve.estimated.length) return
    const box = e.currentTarget.getBoundingClientRect()
    const t = start + ((((e.clientX - box.left) / box.width) * W - PAD.left) / PLOT_W) * span
    let best = 0
    curve.estimated.forEach((p, i) => {
      if (Math.abs(Date.parse(p.at) - t) < Math.abs(Date.parse(curve.estimated[best].at) - t)) best = i
    })
    setHover(best)
  }

  const summary = `Recuerdo estimado de ${curve.label}. Próximo repaso el ${shortDate(curve.next_review_at)}, cuando la estimación baja del ${percent(curve.desired_retention)}. ${
    curve.measured.length ? `${curve.measured.length} repasos con nota.` : "Aún sin repasos con nota."
  }`

  return (
    <figure className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <li className="flex items-center gap-1.5">
          <svg width="20" height="8" className="shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke="var(--chart-1)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Recuerdo estimado (modelo)
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="10" height="10" className="shrink-0">
            <circle cx="5" cy="5" r="4" fill="var(--foreground)" />
          </svg>
          Nota en cada repaso
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="20" height="8" className="shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="2 3" />
          </svg>
          Objetivo ({percent(curve.desired_retention)})
        </li>
      </ul>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={summary}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Rejilla discreta: 0, 50 y 100 % */}
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}

        {/* Objetivo: por debajo, toca repasar */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(curve.desired_retention)}
          y2={y(curve.desired_retention)}
          stroke="var(--muted-foreground)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />

        {/* Hoy y el próximo repaso */}
        <line x1={today} x2={today} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--border)" strokeWidth="1" />
        <text x={today} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          Hoy
        </text>
        {Math.abs(next - today) > 40 && (
          <>
            <line x1={next} x2={next} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--chart-1)" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
            <text x={next} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              Repaso · {shortDate(curve.next_review_at)}
            </text>
          </>
        )}

        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />

        {curve.measured.map((point) => (
          <circle
            key={point.at}
            cx={x(Date.parse(point.at))}
            cy={y(point.score_ratio)}
            r="5"
            fill="var(--foreground)"
            stroke="var(--background)"
            strokeWidth="2"
          >
            <title>{`${shortDate(point.at)}: nota ${percent(point.score_ratio)}`}</title>
          </circle>
        ))}

        {hovered && (
          <g pointerEvents="none">
            <line x1={x(Date.parse(hovered.at))} x2={x(Date.parse(hovered.at))} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--muted-foreground)" strokeWidth="1" />
            <circle cx={x(Date.parse(hovered.at))} cy={y(hovered.retention)} r="4" fill="var(--chart-1)" stroke="var(--background)" strokeWidth="2" />
            <text
              x={Math.min(Math.max(x(Date.parse(hovered.at)), PAD.left + 70), W - PAD.right - 70)}
              y={PAD.top + 12}
              textAnchor="middle"
              className="fill-foreground text-[12px] font-medium"
            >
              {shortDate(hovered.at)} · {percent(hovered.retention)} estimado
            </text>
          </g>
        )}
      </svg>

      <figcaption className="text-xs text-muted-foreground">{curve.note}</figcaption>

      {curve.measured.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver tus repasos</summary>
          <table className="mt-2 w-full max-w-xs text-left">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 font-medium">Fecha</th>
                <th className="py-1 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {curve.measured.map((point) => (
                <tr key={point.at} className="border-t border-border">
                  <td className="py-1">{shortDate(point.at)}</td>
                  <td className="py-1 tabular-nums">{percent(point.score_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  )
}
