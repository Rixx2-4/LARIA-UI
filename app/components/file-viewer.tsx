"use client"

import { useState, useEffect, useRef } from "react"
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, FileCode, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lariaAPI } from "@/lib/laria-api"

interface FileViewerProps {
  filename: string
  mimeType: string
  documentId?: string
  previewDataUrl?: string
  onClose: () => void
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText className="h-8 w-8" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-8 w-8" />
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("python")
  )
    return <FileCode className="h-8 w-8" />
  return <FileText className="h-8 w-8" />
}

function ImageViewer({ src, filename }: { src: string; filename: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  return (
    <div className="flex flex-col items-center gap-4 h-full">
      <div className="flex items-center gap-2">
        <Button
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
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
          disabled={zoom >= 4}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
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
        title="PDF Viewer"
      />
    </div>
  )
}

function TextViewer({ content }: { content: string; filename: string }) {
  return (
    <div className="w-full h-full overflow-auto bg-muted/30 rounded-xl p-4">
      <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  )
}

function GenericViewer({ filename, mimeType }: { filename: string; mimeType: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      {getFileIcon(mimeType)}
      <p className="text-lg font-medium">{filename}</p>
      <p className="text-sm">Vista previa no disponible</p>
    </div>
  )
}

// Qué vista previa admite cada tipo de archivo; null si ninguna
function previewKind(mimeType: string): "image" | "pdf" | "text" | null {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("python")
  )
    return "text"
  return null
}

export function FileViewer({ filename, mimeType, documentId, previewDataUrl, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
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
          objectUrl = URL.createObjectURL(blob)
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
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Cargando...
        </div>
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

    return <GenericViewer filename={filename} mimeType={mimeType} />
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="relative w-full max-w-4xl h-[80vh] mx-4 bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{filename}</p>
          </div>
          <Button
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
