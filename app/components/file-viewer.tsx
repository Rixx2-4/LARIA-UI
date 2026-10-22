"use client"

import { useState, useEffect, useRef } from "react"
import { X, Download, ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lariaAPI } from "@/lib/laria-api"
import { previewKind } from "@/lib/file-types"
import { FilePreviewSkeleton } from "./skeletons"
import { FileTypeIcon } from "./file-type-icon"

interface FileViewerProps {
  filename: string
  mimeType: string
  documentId?: string
  previewDataUrl?: string
  onClose: () => void
}

function ImageViewer({ src, filename }: { src: string; filename: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  return (
    <div className="flex flex-col items-center gap-4 h-full">
      <div className="flex items-center gap-2">
        <Button
          aria-label="Alejar"
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          disabled={zoom <= 0.25}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground min-w-[60px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          aria-label="Acercar"
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
          disabled={zoom >= 4}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Girar"
          variant="outline"
          size="sm"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Descargar"
          variant="outline"
          size="sm"
          onClick={() => {
            const link = document.createElement("a")
            link.href = src
            link.download = filename
            link.click()
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/30 rounded-xl w-full">
        {/* Imagen del usuario, local o de la API: next/image no aporta nada aquí */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={filename}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        />
      </div>
    </div>
  )
}

function PdfViewer({ src }: { src: string }) {
  return (
    <div className="w-full h-full">
      <iframe
        src={src}
        className="w-full h-full border-0 rounded-xl"
        title="Visor de PDF"
      />
    </div>
  )
}

// Un texto enorme (hasta 25 MB) pintado entero bloquearía la página: se enseña el principio
const MAX_PREVIEW_CHARS = 200_000

function TextViewer({ content }: { content: string; filename: string }) {
  const cut = content.length > MAX_PREVIEW_CHARS
  return (
    <div className="w-full h-full overflow-auto bg-muted/30 rounded-xl p-4">
      <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
        {cut ? content.slice(0, MAX_PREVIEW_CHARS) : content}
      </pre>
      {cut && <p className="mt-4 text-sm text-muted-foreground">Vista previa recortada: el archivo es más largo.</p>}
    </div>
  )
}

// Baja el archivo original (con el token en la cabecera, nunca en la URL)
async function downloadDocument(documentId: string, filename: string) {
  const url = URL.createObjectURL(await lariaAPI.documents.content(documentId))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Sin vista previa (Word, PowerPoint, Excel…): al menos se puede descargar
function GenericViewer({ filename, mimeType, documentId }: { filename: string; mimeType: string; documentId?: string }) {
  const [downloading, setDownloading] = useState(false)
  const [failed, setFailed] = useState(false)
  const download = async () => {
    if (!documentId) return
    setDownloading(true)
    setFailed(false)
    try {
      await downloadDocument(documentId, filename)
    } catch {
      setFailed(true)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <FileTypeIcon mimeType={mimeType} className="h-8 w-8" />
      <p className="text-lg font-medium">{filename}</p>
      <p className="text-sm">Vista previa no disponible</p>
      {documentId && (
        <Button variant="outline" size="sm" onClick={download} disabled={downloading} className="gap-2">
          <Download className="h-4 w-4" aria-hidden />
          Descargar
        </Button>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo descargar el archivo
        </p>
      )}
    </div>
  )
}

export function FileViewer({ filename, mimeType, documentId, previewDataUrl, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Es un diálogo modal: el foco entra al abrir, Tab no sale de él y, al cerrarlo,
  // vuelve a donde estaba (la tarjeta del archivo)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose()
      if (e.key !== "Tab" || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], iframe")]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const kind = previewKind(mimeType)

  useEffect(() => {
    if (!documentId || previewDataUrl || !kind) return

    // Se descarga con la cabecera Authorization: el token nunca va en la URL
    let cancelled = false
    let objectUrl: string | null = null

    const fetchContent = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const blob = await lariaAPI.documents.content(documentId)
        if (cancelled) return
        if (kind === "text") {
          setContent(await blob.text())
        } else {
          // El iframe comparte el origen de la app: se fuerza el tipo PDF para que
          // un archivo que en realidad sea HTML nunca se ejecute como página
          objectUrl = URL.createObjectURL(kind === "pdf" ? new Blob([blob], { type: "application/pdf" }) : blob)
          setBlobUrl(objectUrl)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el archivo")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchContent()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setBlobUrl(null)
      setContent(null)
    }
  }, [documentId, kind, previewDataUrl])

  // Un archivo recién adjuntado se previsualiza con lo que leyó el navegador
  // (data URL si es imagen, el texto tal cual si es texto); si no, con lo descargado
  const sourceUrl = previewDataUrl || blobUrl || ""
  const text = kind === "text" ? (previewDataUrl ?? content) : null

  const renderContent = () => {
    const needsSource = kind === "image" || kind === "pdf"
    if (isLoading || (needsSource && documentId && !sourceUrl && !error)) {
      return (
        <FilePreviewSkeleton />
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )
    }

    if (kind === "image") {
      return <ImageViewer src={sourceUrl} filename={filename} />
    }

    if (kind === "pdf") {
      return <PdfViewer src={sourceUrl} />
    }

    if (text !== null) {
      return <TextViewer content={text} filename={filename} />
    }

    return <GenericViewer filename={filename} mimeType={mimeType} documentId={documentId} />
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={filename}
        tabIndex={-1}
        className="relative w-full max-w-4xl h-[80vh] mx-4 bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{filename}</p>
          </div>
          <Button
            aria-label="Cerrar"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden p-4">{renderContent()}</div>
      </div>
    </div>
  )
}
