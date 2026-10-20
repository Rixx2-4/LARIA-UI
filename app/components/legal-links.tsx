import Link from "next/link"
import { LEGAL_DOCUMENTS, legalHref } from "@/lib/routes"

// Términos, privacidad y cookies, en pequeño: al crear la cuenta y en la cuenta
export function LegalLinks() {
  return (
    <nav aria-label="Documentos legales" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {LEGAL_DOCUMENTS.map((item) => (
        <Link key={item.slug} href={legalHref(item.slug)} prefetch={false} className="hover:text-foreground">
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
