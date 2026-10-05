import { ExternalLink } from "lucide-react"
import type { PathModule } from "@/lib/laria-api"

// Solo enlaces web de verdad (nada de javascript: ni otros esquemas)
function safeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null
  } catch {
    return null
  }
}

// Las fuentes del concepto (tramos intermedio y avanzado): discretas, al pie
export function ModuleSources({ sources }: { sources: PathModule["sources"] }) {
  const links = (sources ?? []).flatMap((source) => {
    const url = safeUrl(source.url)
    return url ? [{ url, title: source.title.trim() || url.hostname.replace(/^www\./, "") }] : []
  })
  if (!links.length) return null
  return (
    <section aria-label="Fuentes" className="space-y-1.5 text-sm">
      <h2 className="text-xs font-medium text-muted-foreground">Fuentes</h2>
      <ul className="space-y-1">
        {links.map(({ url, title }) => (
          <li key={url.href}>
            <a href={url.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {title}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
