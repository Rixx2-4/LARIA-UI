"use client"

import { lazy, Suspense } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { DrawingDiagram, MermaidDiagram } from "./mermaid-diagram"
import { openDiagramAt } from "@/lib/diagrams"

// KaTeX y su CSS solo se bajan cuando un texto trae fórmulas
const MathMarkdown = lazy(() => import("./math-markdown"))

// Dentro de una burbuja de chat, los títulos grandes quedan desproporcionados
function SectionHeading({ children }: { children?: React.ReactNode }) {
  return <h3 className="mt-3 mb-1 text-base font-semibold">{children}</h3>
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  return <pre className="my-2 overflow-x-auto rounded-lg bg-foreground/[0.06] p-3 text-[13px] leading-relaxed">{children}</pre>
}

// Sin rehype-raw a propósito: el HTML que venga en la respuesta se muestra como texto
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>,
  h1: SectionHeading,
  h2: SectionHeading,
  h3: ({ children }) => <h4 className="mt-3 mb-1 font-semibold">{children}</h4>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  pre: ({ children, node }) => {
    // Un bloque ```mermaid es un esquema (ADR-048 del backend): se dibuja, no se enseña el código
    const code = node?.children[0]
    if (code?.type === "element" && code.tagName === "code" && /\blanguage-mermaid\b/i.test(String(code.properties.className ?? ""))) {
      const source = code.children.map((child) => (child.type === "text" ? child.value : "")).join("")
      return <MermaidDiagram source={source.trimEnd()} />
    }
    return <CodeBlock>{children}</CodeBlock>
  },
  // Fotos con licencia de Wikimedia (ADR-048 del backend): el servidor solo deja pasar
  // las suyas. Sin referer, para no contarle a Wikimedia en qué página se vio
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="my-2 block max-h-80 max-w-full rounded-lg object-contain"
    />
  ),
  code: ({ children, className }) => (
    <code className={className ?? "rounded bg-foreground/[0.08] px-1 py-0.5 text-[13px]"}>{children}</code>
  ),
}

// Un "$" seguido de número puede abrir una fórmula ("$2x + 3 = 7$") o ser dinero
// ("cuesta $5 y el otro $10"). Es fórmula si se cierra en la misma línea y lo de
// dentro no lleva espacios ("$3x+1$") o lleva algún símbolo matemático
const MONEY_OR_MATH = /(?<![\\$])\$(?=\d)([^$\n]*)/g
const MATH_SYMBOL = /[=+\-*/^_\\{}()<>]/

function keepMathEscapeMoney(match: string, inside: string, offset: number, text: string): string {
  const closed = text[offset + match.length] === "$"
  const isMath = closed && (!/\s/.test(inside) || MATH_SYMBOL.test(inside))
  return isMath ? match : "\\$" + inside
}

// Los modelos escriben las fórmulas de varias formas; remark-math solo entiende
// $…$ y $$ en líneas propias. El código (en bloque o en línea) se deja tal cual.
function normalizeMath(content: string): string {
  return content
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => `\n$$\n${tex.trim()}\n$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => `$${tex.trim()}$`)
            .replace(/^[ \t]*\$\$(.+?)\$\$[ \t]*$/gm, (_, tex) => `$$\n${tex.trim()}\n$$`)
            .replace(MONEY_OR_MATH, keepMathEscapeMoney),
    )
    .join("")
}

// ¿Puede llevar fórmulas? $…$, $$…$$, \(…\) o \[…\]
const HAS_MATH = /\\\(|\\\[|\$/

export function MessageContent({ content }: { content: string }) {
  // Mientras llega un esquema, su código a medias no se enseña: se dibuja al cerrarse.
  // La forma del árbol es siempre la misma (texto y, si hace falta, el aviso): así lo
  // ya pintado, esquemas incluidos, no se desmonta cada vez que llega otro trozo
  const drawingAt = openDiagramAt(content)
  const shown = drawingAt === null ? content : content.slice(0, drawingAt)
  return (
    <>
      {shown.trim() && <Markdown content={shown} />}
      {drawingAt !== null && <DrawingDiagram />}
    </>
  )
}

function Markdown({ content }: { content: string }) {
  const plain = <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
  if (!HAS_MATH.test(content)) return plain
  // Mientras llega KaTeX se ve el texto tal cual; las fórmulas se dibujan al cargar
  return (
    <Suspense fallback={plain}>
      <MathMarkdown content={normalizeMath(content)} components={components} />
    </Suspense>
  )
}

// Texto corto que puede llevar fórmulas (enunciados y opciones de los quizzes): sin
// párrafos, para que quepa en una línea, un botón o un título. Sin fórmulas se deja
// como texto plano: así un «1.» o un «*» del enunciado no se convierten en markdown
const inlineComponents: Components = { ...components, p: ({ children }) => <>{children}</> }

export function MathText({ text }: { text: string }) {
  if (!HAS_MATH.test(text)) return <>{text}</>
  return (
    <Suspense fallback={text}>
      <MathMarkdown content={normalizeMath(text)} components={inlineComponents} gfm={false} />
    </Suspense>
  )
}
