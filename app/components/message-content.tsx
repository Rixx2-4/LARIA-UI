"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

// Dentro de una burbuja de chat, los títulos grandes quedan desproporcionados
function SectionHeading({ children }: { children?: React.ReactNode }) {
  return <h3 className="mt-3 mb-1 text-base font-semibold">{children}</h3>
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
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-foreground/[0.06] p-3 text-[13px] leading-relaxed">{children}</pre>
  ),
  code: ({ children, className }) => (
    <code className={className ?? "rounded bg-foreground/[0.08] px-1 py-0.5 text-[13px]"}>{children}</code>
  ),
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
            // "$5" es dinero, no el inicio de una fórmula (a cambio, $2x$ no se pinta)
            .replace(/(?<![\\$])\$(?=\d)/g, "\\$"),
    )
    .join("")
}

export function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
      {normalizeMath(content)}
    </ReactMarkdown>
  )
}
