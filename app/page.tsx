import type { Metadata } from "next"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"
import { ArrowRight } from "lucide-react"
import { NEW_CHAT_HREF, SIGN_UP_HREF } from "@/lib/routes"
import { LandingHeader } from "./components/landing/landing-header"
import { LandingMotion, Marker, Reveal } from "./components/landing/motion"
import { ChatDemo } from "./components/landing/chat-demo"
import { demoAnswer } from "./components/landing/chat-demo-content"
import { ProfileMock, QuizMock, UploadMock } from "./components/landing/mocks"

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
})

export const metadata: Metadata = {
  title: { absolute: "LARIA · Sube tus apuntes y pregunta lo que no entiendas" },
  description:
    "LARIA lee tus PDF, diapositivas o código, te explica lo que no entiendes con fórmulas bien escritas y te pone quizzes para comprobar qué te sabes.",
}

const STEPS = [
  {
    title: "Sube el material",
    text: "PDF, Word, PowerPoint, Excel, texto o código. LARIA lo analiza y a partir de ahí responde basándose en ese contenido.",
    mock: <UploadMock />,
  },
  {
    title: "Pregunta como te salga",
    text: "Escribe la duda tal cual, o díctala si tienes el libro en las manos. Según lo que preguntes, puede contestarte con una pista o con otra pregunta antes de darte la solución.",
    mock: <ChatSnippet />,
  },
  {
    title: "Comprueba si lo sabes",
    text: "Pide un quiz sobre el documento del chat: 5, 10, 20 preguntas o las que quieras hasta 50. Al terminar ves qué fallaste y cuál era la respuesta correcta.",
    mock: <QuizMock />,
  },
]

const HONEST_NOTES = [
  {
    title: "Se puede equivocar",
    text: "Es una IA. Si una respuesta no cuadra con lo que dijo tu profesor, fíate del profesor y pregúntale a LARIA por qué no coincide.",
  },
  {
    title: "Tus documentos son tuyos",
    text: "Solo los ves tú, desde tu cuenta. No aparecen en los chats de nadie más.",
  },
  {
    title: "El examen lo haces tú",
    text: "Te explica y te pregunta, pero rinde mucho más si la usas para entender que para copiar respuestas.",
  },
]

const FAQ = [
  {
    q: "¿Qué archivos puedo subir?",
    a: "PDF, Word (.docx, .doc), PowerPoint (.pptx, .ppt), Excel (.xlsx, .xls), documentos de OpenDocument, ePub, RTF, Markdown, texto plano, CSV y código: Python, Java, C, C++, C#, JavaScript, TypeScript, PHP, Ruby, SQL, HTML, CSS, JSON y XML.",
  },
  {
    q: "¿Sirve para matemáticas y física?",
    a: "Sí. Escribe las fórmulas como puedas; las respuestas se muestran con notación matemática de verdad, con fracciones, integrales y matrices.",
  },
  {
    q: "¿Puedo usarla desde el móvil?",
    a: "Sí, desde el navegador. No hace falta instalar nada.",
  },
  {
    q: "¿Puedo dictar en vez de escribir?",
    a: "En Chrome, Edge y Safari, sí: el texto aparece mientras hablas. En Firefox el botón no sale porque el navegador no lo permite.",
  },
  {
    q: "¿Tiene modo oscuro?",
    a: "Sí. Sigue el de tu sistema, o lo eliges desde el menú de tu cuenta.",
  },
]

// Un momento del chat, para el paso 2 (el hero ya enseña la conversación entera)
function ChatSnippet() {
  return (
    <div
      aria-hidden
      className="space-y-2.5 rounded-lg border border-foreground/15 bg-background p-4 text-[13px] shadow-[6px_6px_0_0] shadow-foreground/10"
    >
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-primary-foreground">
        ¿Por qué en el ejemplo multiplica por 3 al final?
      </div>
      <div className="w-fit max-w-[90%] rounded-2xl bg-muted px-3.5 py-2.5 leading-relaxed">
        Fíjate en lo que hay dentro del paréntesis: 3x + 1. ¿Cuánto vale su derivada?
        <div className="mt-2 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
          <span className="rounded bg-secondary/60 px-1.5">Pista</span>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <LandingMotion>
      <div className={`${display.variable} min-h-dvh bg-paper text-foreground`}>
        <LandingHeader />

        <main>
          {/* Hero */}
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28">
            <div>
              <Reveal>
                <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.25rem]">
                  Sube los apuntes de clase y <Marker>pregunta</Marker> lo que no entendiste.
                </h1>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  LARIA lee tu PDF, tus diapositivas o tu código y te responde a partir de ellos. Las fórmulas se
                  ven como en el libro. Y cuando crees que ya lo tienes, te pone un quiz para comprobarlo.
                </p>
              </Reveal>
              <Reveal delay={0.3}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={SIGN_UP_HREF}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href={NEW_CHAT_HREF}
                    className="rounded-md px-5 py-3 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Ya tengo cuenta
                  </Link>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Funciona en el navegador, también desde el móvil.</p>
              </Reveal>
            </div>

            <Reveal delay={0.2}>
              <ChatDemo answer={demoAnswer()} />
            </Reveal>
          </section>

          {/* Cómo funciona */}
          <section id="como-funciona" className="scroll-mt-16 border-t border-foreground/10">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
              <Reveal>
                <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Así se estudia con LARIA</h2>
              </Reveal>

              <ol className="mt-14 space-y-20 lg:space-y-28">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                    <Reveal className={i % 2 === 1 ? "md:order-2" : undefined}>
                      <p className="font-display text-5xl text-muted-foreground/60" aria-hidden>
                        {String(i + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight">{step.title}</h3>
                      <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">{step.text}</p>
                    </Reveal>
                    <Reveal delay={0.1}>{step.mock}</Reveal>
                  </li>
                ))}
              </ol>

              <div className="mt-24 grid items-center gap-8 rounded-lg border border-foreground/15 bg-background/60 p-6 sm:p-10 md:grid-cols-2 md:gap-14">
                <Reveal>
                  <h3 className="font-display text-3xl tracking-tight sm:text-4xl">
                    Y tu perfil va <Marker delay={0.2}>tomando nota</Marker>
                  </h3>
                  <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                    Cada quiz actualiza cuánto dominas cada concepto. Si fallas varias veces seguidas en lo mismo,
                    aparece en tu perfil para que sepas qué repasar antes del examen.
                  </p>
                </Reveal>
                <Reveal delay={0.1}>
                  <ProfileMock />
                </Reveal>
              </div>
            </div>
          </section>

          {/* Lo que conviene saber */}
          <section id="antes-de-empezar" className="scroll-mt-16 border-t border-foreground/10">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
              <Reveal>
                <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Antes de empezar</h2>
              </Reveal>
              <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
                {HONEST_NOTES.map((note, i) => (
                  <Reveal key={note.title} delay={i * 0.1} className="border-t-2 border-foreground pt-5">
                    <h3 className="text-lg font-semibold">{note.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{note.text}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* Preguntas */}
          <section id="preguntas" className="scroll-mt-16 border-t border-foreground/10">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr] lg:py-28">
              <Reveal>
                <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Preguntas</h2>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="divide-y divide-foreground/10 border-y border-foreground/10">
                  {FAQ.map((item) => (
                    <details key={item.q} className="group py-1">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span
                          aria-hidden
                          className="text-xl leading-none text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="pb-5 pr-8 leading-relaxed text-muted-foreground">{item.a}</p>
                    </details>
                  ))}
                </div>
              </Reveal>
            </div>
          </section>

          {/* Cierre */}
          <section className="border-t border-foreground/10">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
              <Reveal>
                <h2 className="max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-6xl">
                  ¿Tienes un tema que no termina de entrar? <Marker delay={0.3}>Súbelo</Marker> y pregunta.
                </h2>
                <Link
                  href={SIGN_UP_HREF}
                  className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Reveal>
            </div>
          </section>
        </main>

        <footer className="border-t border-foreground/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
            <span>© {new Date().getFullYear()} LARIA</span>
            <div className="flex gap-5">
              <Link href={NEW_CHAT_HREF} className="hover:text-foreground">
                Entrar
              </Link>
              <Link href={SIGN_UP_HREF} className="hover:text-foreground">
                Crear cuenta
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </LandingMotion>
  )
}
