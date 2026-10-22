import Link from "next/link"
import { LEGAL_DOCUMENTS, legalHref } from "@/lib/routes"

// Términos, privacidad y cookies, en pequeño: al crear la cuenta y en la cuenta
export function LegalLinks() {
  return (
    <nav aria-label="Documentos legales" className="flex flex-wrap justify-center gap-x-4 md:gap-y-1 text-xs text-muted-foreground">
      {LEGAL_DOCUMENTS.map((item) => (
        <Link key={item.slug} href={legalHref(item.slug)} prefetch={false} className="py-2 hover:text-foreground md:py-0">
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
