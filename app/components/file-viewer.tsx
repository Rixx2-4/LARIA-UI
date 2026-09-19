"use client"

import { useState, useEffect, useRef } from "react"
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, FileCode, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"

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

function TextViewer({ content, filename }: { content: string; filename: string }) {
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

  useEffect(() => {
    if (!documentId || previewDataUrl) return

    const isTextFile =
      mimeType.startsWith("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("xml") ||
      mimeType.includes("javascript") ||
      mimeType.includes("typescript") ||
      mimeType.includes("python")

    if (!isTextFile) return

    const fetchContent = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_LARIA_API_URL || "http://localhost:8000/api/v1"
        const token = localStorage.getItem("laria_token")
        const response = await fetch(`${API_BASE_URL}/documents/${documentId}/content`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!response.ok) throw new Error("Error al cargar el archivo")
        const text = await response.text()
        setContent(text)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el archivo")
      } finally {
        setIsLoading(false)
      }
    }

    fetchContent()
  }, [documentId, mimeType, previewDataUrl])

  const getSourceUrl = () => {
    if (previewDataUrl) return previewDataUrl
    if (!documentId) return ""
    const API_BASE_URL = process.env.NEXT_PUBLIC_LARIA_API_URL || "http://localhost:8000/api/v1"
    const token = localStorage.getItem("laria_token")
    return `${API_BASE_URL}/documents/${documentId}/content${token ? `?token=${token}` : ""}`
  }

  const renderContent = () => {
    if (isLoading) {
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

    if (mimeType.startsWith("image/")) {
      return <ImageViewer src={getSourceUrl()} filename={filename} />
    }

    if (mimeType === "application/pdf") {
      return <PdfViewer src={getSourceUrl()} />
    }

    if (content !== null) {
      return <TextViewer content={content} filename={filename} />
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
