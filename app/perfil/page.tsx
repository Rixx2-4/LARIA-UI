"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "../components/sidebar"
import { useAuth } from "@/app/contexts/auth-context"
import { lariaAPI, User, StudentProfile, LearningHistory, Document } from "@/lib/laria-api"

interface MasteryItem {
  concepto: string
  valor: number
  tendencia: "up" | "down" | "flat"
}

interface StruggleItem {
  concepto: string
  detalle: string
  fecha: string
}

interface FortalezaItem {
  texto: string
}

interface IntentoItem {
  fecha: string
  tema: string
  pctScore: number
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "hace instantes"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} día${days > 1 ? "s" : ""}`
  const months = Math.floor(days / 30)
  return `hace ${months} mes${months > 1 ? "es" : ""}`
}

function trendArrow(t: string) {
  if (t === "up") return <span className="text-green-600 text-xs">↑ subiendo</span>
  if (t === "down") return <span className="text-red-500 text-xs">↓ bajando</span>
  return <span className="text-muted-foreground text-xs">→ estable</span>
}

function masteryColor(v: number) {
  if (v < 50) return "var(--destructive)"
  if (v < 75) return "var(--chart-4)"
  return "var(--primary)"
}

export default function PerfilPage() {
  const { isAuthenticated, isLoading: authLoading, user: authUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userData, setUserData] = useState<User | null>(null)
  const [learningProfile, setLearningProfile] = useState<StudentProfile | null>(null)
  const [history, setHistory] = useState<LearningHistory | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])

  const [struggle, setStruggle] = useState<StruggleItem[]>([])
  const [fortalezas, setFortalezas] = useState<FortalezaItem[]>([])
  const [recomendaciones, setRecomendaciones] = useState<string[]>([])

  const loadProfileData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [me, lp, lh, docs] = await Promise.allSettled([
        lariaAPI.auth.me(),
        lariaAPI.learning.profile(),
        lariaAPI.learning.history(),
        lariaAPI.documents.list(),
      ])

      if (me.status === "fulfilled") setUserData(me.value)

      const profile = lp.status === "fulfilled" ? lp.value : null
      const hist = lh.status === "fulfilled" ? lh.value : null
      const docList = docs.status === "fulfilled" ? docs.value : []

      setLearningProfile(profile)
      setHistory(hist)
      setDocuments(docList)

      const struggleItems: StruggleItem[] = []
      const strengthItems: FortalezaItem[] = []

      if (profile) {
        profile.mastery_by_concept
          .filter((c) => c.mastery < 60 || c.error_streak >= 2)
          .slice(0, 5)
          .forEach((c) => {
            struggleItems.push({
              concepto: c.concept_key,
              detalle: c.error_streak >= 2
                ? `${c.error_streak} errores seguidos · ${c.help_requests} solicitudes de ayuda`
                : `Dominio bajo (${Math.round(c.mastery)}%) en ${c.attempts} intento(s)`,
              fecha: c.last_practiced_at ? timeAgo(c.last_practiced_at) : "reciente",
            })
          })

        profile.mastery_by_concept
          .filter((c) => c.mastery >= 75)
          .slice(0, 4)
          .forEach((c) => {
            strengthItems.push({
              texto: `Dominio sólido de "${c.concept_key}" (${Math.round(c.mastery)}% de mastery)`,
            })
          })

        if (profile.frequent_errors.length > 0) {
          profile.frequent_errors.slice(0, 3).forEach((e) => {
            struggleItems.push({
              concepto: "Error frecuente",
              detalle: e,
              fecha: "recurrente",
            })
          })
        }

        if (profile.total_attempts > 0) {
          strengthItems.push({ texto: `${profile.total_attempts} intentos de quiz completados` })
        }
        if (profile.pedagogical_memory?.successful_examples?.length) {
          strengthItems.push({
            texto: `Ejemplos que funcionan: ${profile.pedagogical_memory.successful_examples[0]}`,
          })
        }
      }

      setStruggle(struggleItems)
      setFortalezas(strengthItems)

      const recs = hist?.recommendations?.map((r) => r.message) || []
      setRecomendaciones(recs)
    } catch (err) {
      console.error("Error loading profile:", err)
      setError("No se pudieron cargar los datos del perfil")
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadProfileData()
  }, [loadProfileData])

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Inicia sesión para ver tu perfil de aprendizaje.</p>
            <a href="/">
              <Button variant="outline" className="gap-2">
                <LogIn className="h-4 w-4" />
                Ir a iniciar sesión
              </Button>
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const username = userData?.username || authUser?.username || "Usuario"
  const email = userData?.email || authUser?.email || ""

  const concepts = learningProfile?.mastery_by_concept || []
  const conceptsTotal = concepts.length
  const conceptsCompleted = concepts.filter((c) => c.mastery >= 70).length
  const progresoRuta = conceptsTotal > 0 ? concepts.reduce((a, c) => a + c.mastery, 0) / (conceptsTotal * 100) : 0
  const pct = Math.round(progresoRuta * 100)

  const mastery: MasteryItem[] = concepts
    .slice(0, 8)
    .map((c) => {
      const prev = c.effective_mastery
      let tendencia: "up" | "down" | "flat" = "flat"
      if (c.mastery > prev + 2) tendencia = "up"
      else if (c.mastery < prev - 2) tendencia = "down"
      return {
        concepto: c.concept_key,
        valor: Math.round(c.mastery),
        tendencia,
      }
    })

  const attempts = history?.attempts || []
  const docNameMap: Record<string, string> = {}
  documents.forEach((d) => {
    docNameMap[d.id] = d.filename
  })

  const intentos: IntentoItem[] = attempts.slice(0, 10).map((a) => {
    const pctScore = a.total_points > 0 ? Math.round((a.score / a.total_points) * 100) : 0
    return {
      fecha: formatDate(a.completed_at),
      tema: docNameMap[a.document_id] || "Documento",
      pctScore,
    }
  })

  const lastActivity = attempts.length > 0
    ? timeAgo(attempts[0].completed_at)
    : learningProfile?.updated_at
      ? timeAgo(learningProfile.updated_at)
      : "nunca"

  const ritmo = learningProfile ? Math.min(100, Math.round((learningProfile.learning_velocity || 0) * 100)) : 0
  const nivel = learningProfile?.pace
    ? (learningProfile.pace === "fast" ? "Avanzado" : learningProfile.pace === "slow" ? "Principiante" : "Intermedio")
    : "Sin datos"

  const totalAttempts = learningProfile?.total_attempts || 0
  const errors = learningProfile?.frequent_errors || []
  const memory = learningProfile?.pedagogical_memory

  const strongConcepts = concepts.filter((c) => c.mastery >= 75)
  const struggleConcepts = concepts.filter((c) => c.mastery < 60)

  const struggleList: StruggleItem[] = struggle.length > 0
    ? struggle
    : struggleConcepts.slice(0, 3).map((c) => ({
        concepto: c.concept_key,
        detalle: `Dominio bajo (${Math.round(c.mastery)}%) · ${c.help_requests} ayudas solicitadas`,
        fecha: c.last_practiced_at ? formatDate(c.last_practiced_at) : "reciente",
      }))

  const fortalezasList: FortalezaItem[] = fortalezas.length > 0
    ? fortalezas
    : [
        ...(totalAttempts > 0 ? [{ texto: `${totalAttempts} intentos de quiz completados` }] : []),
        ...strongConcepts.slice(0, 3).map((c) => ({ texto: `Buen dominio de "${c.concept_key}" (${Math.round(c.mastery)}%)` })),
      ]

  const r = 56
  const circ = 2 * Math.PI * r
  const ringOffset = circ - progresoRuta * circ

  const iniciales = username
    .split(/[\s._-]/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const struggleSameConcept: Record<string, number> = {}
  struggleList.forEach((s) => {
    struggleSameConcept[s.concepto] = (struggleSameConcept[s.concepto] || 0) + 1
  })
  const repeated = Object.entries(struggleSameConcept).find(([, n]) => n >= 2)

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tracking-tight">LARIA</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">IA</span>
              <span className="text-sm text-muted-foreground pl-2 border-l border-border ml-1">Apartado — Perfil</span>
            </div>
          </div>
        </header>

        <div className="max-w-[980px] mx-auto pb-16">
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="w-[52px] h-[52px] rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg shrink-0">
            {iniciales}
          </div>
          <div>
            <h1 className="text-xl font-medium mb-1">{username}</h1>
            <p className="text-xs text-muted-foreground mb-1.5">{email}</p>
            <div className="flex gap-2.5 items-center flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">Nivel: {nivel}</span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">Ritmo: {ritmo}%</span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">Última actividad: {lastActivity}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-5 p-3 px-4 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive">
            {error}
          </div>
        )}

        {repeated && repeated.length > 0 && (
          <div className="mx-6 mb-5 p-3 px-4 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive flex gap-2.5 items-start leading-relaxed">
            <span className="text-[15px] mt-px">⚠️</span>
            <span>
              Muestras dificultad repetida en <strong className="font-bold">{repeated[0][0]}</strong>. Podrías beneficiarte de apoyo adicional además de LARIA.
            </span>
          </div>
        )}

        <div className="grid grid-cols-[230px_1fr] gap-4 px-6 mb-4">
          <div className="bg-card border border-border rounded-xl p-[18px] flex flex-col items-center justify-center text-center">
            <h3 className="text-[13px] font-semibold mb-0.5">Progreso de dominio</h3>
            <div className="relative w-[132px] h-[132px] my-1">
              <svg width="132" height="132" viewBox="0 0 132 132" className="transform -rotate-90">
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--muted)" strokeWidth="12" />
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--primary)" strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={ringOffset} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold">{pct}%</div>
            </div>
            <div className="text-[12.5px] text-muted-foreground leading-relaxed">{conceptsCompleted} de {conceptsTotal} conceptos con dominio ≥70%</div>
          </div>

          <div className="bg-card border border-border rounded-xl p-[18px]">
            <h3 className="text-[13px] font-semibold mb-0.5">Mastery por concepto</h3>
            <p className="text-xs text-muted-foreground mb-3.5">Nivel de dominio actual sobre cada tema trabajado.</p>
            <div className="space-y-3.5">
              {mastery.length > 0 ? (
                mastery.map((m) => (
                  <div key={m.concepto}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[13px] font-medium">{m.concepto}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">{m.valor}% {trendArrow(m.tendencia)}</span>
                    </div>
                    <div className="h-[7px] bg-muted rounded-full border border-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.valor}%`, background: masteryColor(m.valor) }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay datos de mastery. Realiza quizzes sobre tus documentos para generarlos.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-6 mb-4">
          <div className="bg-card border border-border rounded-xl p-[18px]">
            <h3 className="text-[13px] font-semibold mb-0.5">Señales de struggle</h3>
            <p className="text-xs text-muted-foreground mb-3.5">Patrones que indican dificultad reciente.</p>
            <div className="space-y-2.5">
              {struggleList.length > 0 ? (
                struggleList.map((s, i) => (
                  <div key={i} className="flex gap-2.5 items-start text-[12.5px] leading-relaxed">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive mt-1.5" />
                    <span>
                      {s.concepto}: {s.detalle}
                      <span className="text-[11.5px] text-muted-foreground block mt-px">{s.fecha}</span>
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex gap-2.5 items-start text-[12.5px]">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Sin señales de struggle activas.</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-[18px]">
            <h3 className="text-[13px] font-semibold mb-0.5">Fortalezas</h3>
            <p className="text-xs text-muted-foreground mb-3.5">Lo que ya viene funcionando bien.</p>
            <div className="space-y-2.5">
              {fortalezasList.length > 0 ? (
                fortalezasList.map((f, i) => (
                  <div key={i} className="flex gap-2.5 items-start text-[12.5px]">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>{f.texto}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay fortalezas identificadas.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-6 mb-4 bg-card border border-border rounded-xl p-[18px]">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="text-[13px] font-semibold">Recomendaciones de LARIA</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadProfileData}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Actualizar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3.5">Siguientes pasos sugeridos por LARIA a partir del progreso actual.</p>
          <div className="space-y-2">
            {recomendaciones.length > 0 ? (
              recomendaciones.map((r, i) => (
                <div key={i} className="flex gap-2.5 items-center p-2.5 px-3 bg-muted rounded-lg text-[12.5px]">
                  <span className="text-primary font-bold shrink-0">→</span>
                  <span>{r}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {attempts.length === 0
                  ? "Realiza quizzes sobre tus documentos para recibir recomendaciones personalizadas."
                  : "Sin recomendaciones pendientes. ¡Buen trabajo!"}
              </p>
            )}
          </div>
        </div>

        <div className="mx-6 mb-4 bg-card border border-border rounded-xl p-[18px]">
          <h3 className="text-[13px] font-semibold mb-0.5">Intentos de quiz</h3>
          <p className="text-xs text-muted-foreground mb-3.5">Historial de evaluaciones realizadas sobre los documentos.</p>
          {intentos.length > 0 ? (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-muted-foreground text-[11.5px] pb-2 border-b border-border pr-2.5">Fecha</th>
                  <th className="text-left font-semibold text-muted-foreground text-[11.5px] pb-2 border-b border-border pr-2.5">Documento</th>
                  <th className="text-left font-semibold text-muted-foreground text-[11.5px] pb-2 border-b border-border">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {intentos.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-2.5 border-b border-border">{a.fecha}</td>
                    <td className="py-2.5 pr-2.5 border-b border-border">{a.tema}</td>
                    <td className="py-2.5 border-b border-border">
                      <span className="font-semibold text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${a.pctScore < 50 ? "var(--destructive)" : a.pctScore < 80 ? "var(--chart-4)" : "var(--primary)"} 15%, transparent)`, color: a.pctScore < 50 ? "var(--destructive)" : a.pctScore < 80 ? "var(--chart-4)" : "var(--primary)" }}>
                        {a.pctScore}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay intentos de quiz registrados.</p>
          )}
        </div>

        <div className="mx-6 bg-card border border-border rounded-xl p-[18px]">
          <h3 className="text-[13px] font-semibold mb-0.5">Memoria pedagógica</h3>
          <p className="text-xs text-muted-foreground mb-4">Lo que LARIA recuerda sobre cómo prefieres aprender.</p>
          {memory ? (
            <div className="grid grid-cols-2 gap-[18px]">
              <div>
                <h4 className="text-[11.5px] text-muted-foreground mb-2 font-semibold">Estilo de explicación preferido</h4>
                <span className="inline-block text-sm px-3 py-1.5 rounded-lg bg-muted border border-border">
                  {memory.preferred_explanation_style || "Sin datos aún"}
                </span>
              </div>

              <div>
                <h4 className="text-[11.5px] text-muted-foreground mb-2 font-semibold">Errores frecuentes</h4>
                <div className="space-y-2.5">
                  {errors.length > 0 ? (
                    errors.slice(0, 4).map((e, i) => (
                      <div key={i} className="flex gap-2.5 items-start text-[12.5px]">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive mt-1.5" />
                        <span>{e}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12.5px] text-muted-foreground">Sin errores registrados.</p>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <h4 className="text-[11.5px] text-muted-foreground mb-2 font-semibold">Estrategias efectivas recientes</h4>
                {memory.last_effective_strategies?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {memory.last_effective_strategies.map((s, i) => (
                      <span key={i} className="text-[11.5px] px-2 py-1 rounded-full bg-primary/10 text-primary">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground">Sin estrategias registradas aún.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              La memoria pedagógica se construye a medida que usas el tutor y realizas quizzes.
            </p>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}