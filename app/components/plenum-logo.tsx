import { cn } from "@/lib/utils"

// Marca de la plataforma: Plenum. (LARIA es el tutor con IA dentro de Plenum.)
// El dibujo se usa como máscara y se pinta con el color del texto: un solo archivo
// que se ve oscuro en el tema claro y blanco en el oscuro, sin caja de fondo.

const mask = (file: string) =>
  ({
    WebkitMaskImage: `url(${file})`,
    maskImage: `url(${file})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  }) as const

// Logo horizontal: el robot y la palabra "Plenum". Usa la versión con el encuadre
// ajustado al dibujo (el SVG original tiene mucho margen y el texto quedaba diminuto)
export function PlenumLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Plenum"
      className={cn("inline-block aspect-[1270/550] h-10 bg-current", className)}
      style={mask("/brand/plenum-logo-web.svg")}
    />
  )
}

// Solo el robot, para espacios cuadrados (la barra lateral)
export function PlenumMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Plenum"
      className={cn("inline-block aspect-square h-9 bg-current", className)}
      style={mask("/brand/plenum-isotipo.svg")}
    />
  )
}
