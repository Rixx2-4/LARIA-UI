"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { guessTopic, markPlacementOffered, wasPlacementOffered } from "@/lib/placement"
import { placementHref } from "@/lib/routes"

// Cuando el tutor detecta "quiero aprender X", se ofrece (no se impone) una
// nivelación rápida. Una sola vez por chat: aceptarla o decir "ahora no" la cierra.
export function PlacementOffer({ chatId, userQuestion }: { chatId: string; userQuestion: string }) {
  const [hidden, setHidden] = useState(() => wasPlacementOffered(chatId))
  const [topic, setTopic] = useState(() => guessTopic(userQuestion))

  if (hidden) return null

  const close = () => {
    markPlacementOffered(chatId)
    setHidden(true)
  }
  const ready = topic.trim().length >= 2

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl border border-border px-4 py-3 text-[14px]">
        <p>
          ¿Te hago unas preguntas rápidas para ver por dónde empezar con{" "}
          <input
            aria-label="Tema de la nivelación"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="el tema"
            maxLength={120}
            size={Math.max(8, topic.length + 1)}
            className="max-w-full rounded border-b border-dashed border-foreground/40 bg-transparent px-1 font-medium focus:outline-none focus-visible:border-solid"
          />
          ?
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Son 6 preguntas. No es un examen.</p>
        <div className="mt-3 flex gap-2">
          {ready ? (
            <Button asChild size="sm" onClick={close}>
              <Link href={placementHref(topic.trim(), chatId)}>Empezar</Link>
            </Button>
          ) : (
            <Button size="sm" disabled>
              Empezar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={close}>
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  )
}
