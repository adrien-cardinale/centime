import { FileUp } from "lucide-react"
import { type DragEvent, type KeyboardEvent, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

type FileDropzoneProps = {
  file: File | null
  onFileSelected: (file: File) => void
}

const ACCEPTED_TYPES = ".csv,.xml,text/csv,text/xml,application/xml"

export function FileDropzone({ file, onFileSelected }: FileDropzoneProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const selectFirst = (files: FileList | null) => {
    const first = files?.[0]
    if (first) onFileSelected(first)
  }

  const openPicker = () => inputRef.current?.click()

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    openPicker()
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    selectFirst(event.dataTransfer.files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isDragging ? "border-primary bg-muted" : "border-muted-foreground/25 hover:bg-muted/50",
      )}
    >
      <FileUp className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{file ? file.name : t("importWorkspace.dropzone.prompt")}</p>
      <p className="text-xs text-muted-foreground">{t("importWorkspace.dropzone.hint")}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(event) => {
          selectFirst(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}
