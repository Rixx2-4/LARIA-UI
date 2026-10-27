"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MathText } from "@/app/components/message-content"
import type { WorkedExample as WorkedExampleData } from "@/lib/laria-api"

// Ejemplos resueltos (ADR-055): el ejemplo paso a paso, con los últimos pasos como
// huecos que el alumno intenta y luego destapa. Es práctica guiada: no se califica ni
// deja evidencia (la nota sigue siendo la comprobación). Con cada acierto en el mismo
// concepto, el backend oculta un paso más

export function WorkedExample({ example }: { example: WorkedExampleData }) {
  // Los huecos destapados y lo que el alumno escribió en cada uno
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [attempts, setAttempts] = useState<Record<number, string>>({})
  const gaps = example.steps.filter((step) => step.hidden).length

  return (
    <section aria-labelledby="ejemplo-resuelto" className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 id="ejemplo-resuelto" className="text-base font-semibold">
          Ejemplo resuelto
        </h2>
        <p className="text-sm text-muted-foreground">
          {gaps === 0
            ? "Sigue el ejemplo paso a paso."
            : gaps === 1
              ? "Falta el último paso: intenta completarlo antes de verlo. No cuenta para la nota."
              : `Faltan ${gaps} pasos: intenta completarlos antes de verlos. No cuentan para la nota.`}
        </p>
      </div>
      <ol className="space-y-2">
        {example.steps.map((step, index) => {
          const shown = !step.hidden || revealed[index]
          return (
            <li key={index} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <span className="sr-only">Paso {index + 1}: </span>
                {shown ? (
                  <>
                    {step.hidden && attempts[index]?.trim() && (
                      <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                        <span className="font-medium text-foreground">Tú: </span>
                        {attempts[index]}
                      </p>
                    )}
                    <p className={step.hidden ? "rounded-lg border border-border px-3 py-2" : ""}>
                      <MathText text={step.text} />
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="sr-only" htmlFor={`paso-${index}`}>
                      Tu paso {index + 1}
                    </label>
                    <textarea
                      id={`paso-${index}`}
                      rows={2}
                      value={attempts[index] ?? ""}
                      onChange={(e) => setAttempts((prev) => ({ ...prev, [index]: e.target.value }))}
                      placeholder="¿Cuál es este paso? Escríbelo aquí (opcional)"
                      className="w-full resize-y rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRevealed((prev) => ({ ...prev, [index]: true }))}>
                      <Eye className="h-4 w-4" aria-hidden />
                      Ver el paso {index + 1}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
