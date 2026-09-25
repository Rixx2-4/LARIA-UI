import { File, FileCode, FileSpreadsheet, FileText, Image as ImageIcon, Presentation } from "lucide-react"
import { fileCategory, type FileCategory } from "@/lib/file-types"

const ICONS: Record<FileCategory, typeof File> = {
  image: ImageIcon,
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  text: FileCode,
  other: File,
}

export function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = ICONS[fileCategory(mimeType)]
  return <Icon className={className} aria-hidden />
}
