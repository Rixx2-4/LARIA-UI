"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Play, Square } from "lucide-react"
import { toast } from "sonner"
import { lariaAPI, type TutorVoice, type VoicesResponse } from "@/lib/laria-api"

// La frase de ejemplo viene en femenino («tu tutora»); con una voz masculina se dice
// en masculino. Si el backend manda una frase por género (sample_texts), se usa esa
export function sampleFor(data: VoicesResponse, gender: TutorVoice["gender"] | undefined): string {
  const own = gender ? data.sample_texts?.[gender] : undefined
  if (own) return own
  if (gender !== "masculina") return data.sample_text
  return data.sample_text.replace(/\btutora\b/gi, (word) => word.slice(0, -1))
}

// La voz con la que LARIA lee en voz alta: 3 masculinas y 3 femeninas. La elección
// se guarda en el perfil (vale en cualquier dispositivo); cada voz se puede escuchar
// antes con una frase de ejemplo, sin cambiar la elegida. Sin voces en el backend
// (endpoint ausente o voz apagada) no se muestra nada
export function VoicePicker({ className = "" }: { className?: string }) {
  const [data, setData] = useState<VoicesResponse | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ id: string; loading: boolean } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    lariaAPI.speech
      .voices()
      .then((voices) => {
        if (cancelled) return
        setData(voices)
        setSelected(voices.selected)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const stopPreview = () => {
    audioRef.current?.pause()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setPreview(null)
  }
  useEffect(() => stopPreview, [])

  if (!data?.voices.length) return null

  const current = selected ?? data.default

  const listen = async (id: string) => {
    if (preview?.id === id) return stopPreview()
    stopPreview()
    setPreview({ id, loading: true })
    // Dentro del clic: así el navegador deja sonar el audio cuando llegue
    audioRef.current ??= new Audio()
    try {
      const voice = data.voices.find((v) => v.id === id)
      const blob = await lariaAPI.speech.synthesize(sampleFor(data, voice?.gender), "calm", undefined, id)
      if (!blob) return setPreview(null)
      urlRef.current = URL.createObjectURL(blob)
      const audio = audioRef.current
      audio.src = urlRef.current
      audio.onended = () => setPreview(null)
      setPreview({ id, loading: false })
      await audio.play()
    } catch (error) {
      setPreview(null)
      toast.error("No se pudo reproducir la voz", { description: error instanceof Error ? error.message : undefined })
    }
  }

  const choose = async (id: string) => {
    const previous = selected
    // La de por defecto se guarda como null: si cambia la del sistema, se sigue
    const value = id === data.default ? null : id
    setSelected(value)
    setSaving(true)
    try {
      await lariaAPI.speech.setVoice(value)
    } catch (error) {
      setSelected(previous)
      toast.error("No se pudo guardar la voz", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const groups = [
    { title: "Femeninas", voices: data.voices.filter((v) => v.gender === "femenina") },
    { title: "Masculinas", voices: data.voices.filter((v) => v.gender === "masculina") },
  ].filter((group) => group.voices.length)

  return (
    <section aria-labelledby="voz-de-laria" className={`space-y-4 rounded-xl border border-border p-4 ${className}`}>
      <div>
        <h2 id="voz-de-laria" className="text-sm font-semibold">La voz de LARIA</h2>
        <p className="text-xs text-muted-foreground">
          La que usará al leerte en voz alta, en el chat y en tus clases. Pulsa ▶ para escucharla antes de elegir.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.title} role="group" aria-label={`Voces ${group.title.toLowerCase()}`} className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
          <ul className="grid gap-2 sm:grid-cols-3">
            {group.voices.map((voice) => {
              const isCurrent = voice.id === current
              const playing = preview?.id === voice.id
              return (
                <li
                  key={voice.id}
                  className={`flex items-start gap-2 rounded-lg border p-2 ${isCurrent ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <button
                    type="button"
                    onClick={() => listen(voice.id)}
                    aria-label={playing ? `Detener ${voice.label}` : `Escuchar ${voice.label}`}
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
                  >
                    {playing && preview?.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : playing ? (
                      <Square className="h-3 w-3" aria-hidden />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => choose(voice.id)}
                    disabled={saving}
                    aria-pressed={isCurrent}
                    className="min-w-0 flex-1 text-left disabled:opacity-60"
                  >
                    <span className="flex items-center gap-1 text-[13.5px] font-medium">
                      {voice.label}
                      {isCurrent && <Check className="h-3.5 w-3.5" aria-hidden />}
                    </span>
                    <span className="block text-xs text-muted-foreground">{voice.description}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {/* Obligatorio por las políticas de OpenAI */}
      <p className="text-xs text-muted-foreground">Las voces son generadas por IA.</p>
    </section>
  )
}
