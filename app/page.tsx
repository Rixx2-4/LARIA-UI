import type { Metadata } from "next"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"
import { ArrowRight } from "lucide-react"
import { SIGN_IN_HREF, SIGN_UP_HREF } from "@/lib/routes"
import { LandingHeader } from "./components/landing/landing-header"
import { LandingMotion, Marker, Reveal } from "./components/landing/motion"
import { ChatDemo } from "./components/landing/chat-demo"
import { demoAnswer } from "./components/landing/chat-demo-content"
import { PlacementMock, ProfileMock, QuizMock, UploadMock } from "./components/landing/mocks"

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
})

export const metadata: Metadata = {
  title: { absolute: "Plenum · Un tutor con IA que se adapta a cómo aprendes" },
  description:
    "En Plenum estudias con LARIA, un tutor con IA que convierte tus libros, artículos y apuntes en una clase adaptada a ti. Sin material, te evalúa para saber tu nivel en el tema que quieras.",
}

// Las dos formas de empezar. Todo lo que se afirma aquí está validado contra el
// backend desplegado (sesión del backend, 29-sep): no se anuncia nada que no exista
const PATHS = [
  {
    title: "Con tu material",
    intro: "Libros, artículos, apuntes, diapositivas o código.",
    steps: [
      "Súbelo al chat. LARIA lo analiza y saca los conceptos clave.",
      "Pregúntale lo que no entiendas: te enseña a partir de tu material, con las fórmulas bien escritas.",
      "Cuando creas que lo tienes, pídele un cuestionario sobre ese material y te lo corrige al momento.",
    ],
    mock: <UploadMock />,
  },
  {
    title: "Sin material",
    intro: "Solo dile qué quieres aprender.",
    steps: [
      "LARIA te evalúa por rondas para saber si estás en básico, intermedio o avanzado.",
      "Tu nivel en ese tema queda guardado en tu perfil.",
      "Pide cuestionarios de práctica sobre el tema cuando quieras.",
    ],
    mock: <PlacementMock />,
  },
]

// Cómo se adapta (con material, que es donde decide el motor pedagógico)
const ADAPTS = [
  { title: "Si un concepto te cuesta", text: "te guía con pistas en vez de soltarte la respuesta." },
  { title: "Si ya lo dominas", text: "te reta con preguntas antes de darte la solución." },
  { title: "Cuando toca practicar", text: "te lo propone, sin obligarte." },
  { title: "Si lo pides de otra forma", text: "paso a paso, con un ejemplo o con un esquema, te lo explica así." },
  { title: "Y cuando se adapta", text: "te dice por qué te habla de esa manera." },
]

const HONEST_NOTES = [
  {
    title: "Se puede equivocar",
    text: "Es una IA. Si una respuesta no cuadra con lo que dijo tu profesor, fíate del profesor y pregúntale a LARIA por qué no coincide.",
  },
  {
    title: "Tus documentos son tuyos",
    text: "Solo los ves tú, desde tu cuenta. No aparecen en los chats de nadie más. Para responderte, su texto se procesa con OpenAI.",
  },
  {
    title: "El examen lo haces tú",
    text: "Te explica y te pregunta, pero rinde mucho más si la usas para entender que para copiar respuestas.",
  },
]

const FAQ = [
  {
    q: "¿Qué archivos puedo subir?",
    a: "PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), texto (.txt, .md, .csv, .json…) y código (Python, JavaScript, TypeScript, Java, C/C++, C#, Go, Rust, SQL, HTML, CSS…), hasta 25 MB. Los formatos antiguos (.doc, .ppt, .xls) no: guárdalos antes como .docx, .pptx o .xlsx. Los PDF escaneados, que son solo imagen, tampoco se pueden leer.",
  },
  {
    q: "¿Y si no tengo apuntes?",
    a: "Dile a LARIA qué quieres aprender. Te evalúa con unas preguntas por rondas para saber si estás en básico, intermedio o avanzado, guarda tu nivel y te lo explica. También puedes pedirle cuestionarios de práctica sobre el tema.",
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

// Un momento del chat en el que LARIA guía con una pista (el hero enseña la conversación entera)
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
                  Un tutor que se <Marker>adapta</Marker> a cómo aprendes.
                </h1>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  En Plenum estudias con LARIA. Súbele tus libros, artículos o apuntes y los convierte en una clase:
                  te explica, te pregunta y ajusta cada respuesta a lo que ya dominas y a lo que te cuesta. ¿No tienes
                  material? Dile qué quieres aprender y te evalúa para saber tu nivel.
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
                    href={SIGN_IN_HREF}
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

          {/* Dos formas de empezar */}
          <section id="como-funciona" className="scroll-mt-16 border-t border-foreground/10">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
              <Reveal>
                <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Dos formas de empezar</h2>
              </Reveal>

              <div className="mt-14 space-y-20 lg:space-y-28">
                {PATHS.map((path, i) => (
                  <div key={path.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                    <Reveal className={i % 2 === 1 ? "md:order-2" : undefined}>
                      <h3 className="text-2xl font-semibold tracking-tight">{path.title}</h3>
                      <p className="mt-1 text-muted-foreground">{path.intro}</p>
                      <ol className="mt-5 space-y-3">
                        {path.steps.map((step, n) => (
                          <li key={step} className="flex gap-3 leading-relaxed">
                            <span className="font-display text-2xl leading-none text-muted-foreground/70" aria-hidden>
                              {n + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </Reveal>
                    <Reveal delay={0.1}>{path.mock}</Reveal>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Cómo se adapta */}
          <section id="como-se-adapta" className="scroll-mt-16 border-t border-foreground/10">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
              <div className="grid items-start gap-10 md:grid-cols-2 md:gap-14">
                <Reveal>
                  <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
                    No responde igual a <Marker delay={0.2}>todos</Marker>
                  </h2>
                  <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                    Con tu material, LARIA decide cómo enseñarte según lo que ya dominas y lo que te cuesta. No es la
                    IA quien lo improvisa: lo decide a partir de cómo te va en cada concepto.
                  </p>
                  <ul className="mt-8 space-y-4">
                    {ADAPTS.map((item) => (
                      <li key={item.title} className="border-l-2 border-foreground pl-4">
                        <span className="font-semibold">{item.title}</span>, {item.text}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <div className="space-y-6">
                  <Reveal delay={0.1}>
                    <ChatSnippet />
                  </Reveal>
                  <Reveal delay={0.2}>
                    <QuizMock />
                  </Reveal>
                </div>
              </div>

              <div className="mt-24 grid items-center gap-8 rounded-lg border border-foreground/15 bg-background/60 p-6 sm:p-10 md:grid-cols-2 md:gap-14">
                <Reveal>
                  <h3 className="font-display text-3xl tracking-tight sm:text-4xl">
                    Y tu perfil va <Marker delay={0.2}>tomando nota</Marker>
                  </h3>
                  <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                    Registra cuánto dominas cada concepto, lo que se te va olvidando con el tiempo y qué te conviene
                    repasar. Si algo te cuesta varias veces seguidas, porque lo fallas en un cuestionario o le dices
                    que no lo entiendes, aparece ahí.
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
                  ¿Tienes un tema que no termina de entrar? <Marker delay={0.3}>Súbelo</Marker>, o simplemente dile cuál es.
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
            <span>© {new Date().getFullYear()} Plenum</span>
            <div className="flex gap-5">
              <Link href={SIGN_IN_HREF} className="hover:text-foreground">
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
