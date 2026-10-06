"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

// Markdown con fórmulas (KaTeX). Pesa ~300 KB: message-content solo lo carga cuando
// un texto trae fórmulas, así el chat abre sin él
export default function MathMarkdown({ content, components, gfm = true }: { content: string; components: Components; gfm?: boolean }) {
  return (
    <ReactMarkdown remarkPlugins={gfm ? [remarkGfm, remarkMath] : [remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
