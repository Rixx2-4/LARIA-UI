// Los documentos legales del backend (ADR-019) traen huecos sin rellenar
// ([[COMPLETAR: responsable]]) mientras son borradores: cada uno se ve como tal,
// nunca como si fuera el texto definitivo
const GAP = /\[\[COMPLETAR:\s*([^\]]*?)\s*\]\]/g

export function markGaps(markdown: string): string {
  return markdown.replace(GAP, (_, what: string) => `**[Pendiente: ${what}]**`)
}

// "2026-10-02" → "2 de octubre de 2026"; si no es una fecha, tal cual
export function formatVersion(version: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) return version
  const date = new Date(`${version}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? version
    : new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

// El texto empieza por "# Título", que la página ya muestra como su encabezado
export function withoutTitle(markdown: string): string {
  return markdown.replace(/^\s*#\s[^\n]*\n+/, "")
}
