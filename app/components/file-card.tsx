"use client"

import { Loader2, X } from "lucide-react"
import { FileTypeIcon } from "./file-type-icon"
import { useDocumentStatus } from "@/hooks/use-document-status"

interface FileCardProps {
  filename: string
  size?: number
  mimeType: string
  documentId?: string
  // Estado del documento al subirlo; la tarjeta sigue su análisis hasta que termina
  documentStatus?: string
  previewDataUrl?: string
  onClick: () => void
  onRemove?: () => void
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Imagen"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return "Hoja de cálculo"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "Presentación"
  if (mimeType.includes("word") || mimeType.includes("document")) return "Documento"
  if (mimeType.startsWith("text/")) return "Texto"
  if (mimeType.includes("json")) return "JSON"
  if (mimeType.includes("xml")) return "XML"
  if (mimeType.includes("javascript")) return "JavaScript"
  if (mimeType.includes("typescript")) return "TypeScript"
  if (mimeType.includes("python")) return "Python"
  return "Archivo"
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileCard({ filename, size, mimeType, documentId, documentStatus, previewDataUrl, onClick, onRemove }: FileCardProps) {
  const isImage = mimeType.startsWith("image/")
  const { status, errorMessage } = useDocumentStatus(documentId, documentStatus)

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="flex items-center gap-3 w-full max-w-[320px] rounded-xl border border-border bg-background p-3 text-left transition-all hover:bg-accent/50 hover:border-ring/40 cursor-pointer"
      >
        {isImage && previewDataUrl ? (
          <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-muted">
            {/* Vista previa local (data URL): next/image no aporta nada aquí */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewDataUrl}
              alt={filename}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileTypeIcon mimeType={mimeType} className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{filename}</p>
          <p className="text-xs text-muted-foreground">
            {getFileTypeLabel(mimeType)}{size !== undefined && ` · ${formatSize(size)}`}
          </p>
          {status === "analyzing" && (
            <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden />
              Analizando… puede tardar hasta un minuto
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="text-xs text-destructive">
              {errorMessage || "No se pudo analizar el documento"}
            </p>
          )}
        </div>
      </button>
      {onRemove && (
        <button
          aria-label="Quitar archivo"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
