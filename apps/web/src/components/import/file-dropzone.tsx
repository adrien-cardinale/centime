import { FileUp } from "lucide-react"
import { type DragEvent, type KeyboardEvent, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { isAndroid } from "@/lib/runtime"
import { cn } from "@/lib/utils"

export type DropzoneLabels = {
  prompt: string
  touchPrompt: string
  hint: string
  choose: string
}

type FileDropzoneProps = {
  file: File | null
  onFileSelected: (file: File) => void
  accept?: string
  capture?: "environment" | "user"
  labels?: DropzoneLabels
}

const ACCEPTED_TYPES = [
  ".csv",
  ".xml",
  "text/csv",
  "text/xml",
  "application/xml",
  "text/comma-separated-values",
  "text/plain",
  "application/octet-stream",
].join(",")

const ZONE_CLASS =
  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center sm:p-10"

function useDefaultLabels(): DropzoneLabels {
  const { t } = useTranslation()
  return {
    prompt: t("importWorkspace.dropzone.prompt"),
    touchPrompt: t("importWorkspace.dropzone.touchPrompt"),
    hint: t("importWorkspace.dropzone.hint"),
    choose: t("importWorkspace.dropzone.choose"),
  }
}

export function FileDropzone({ file, onFileSelected, accept = ACCEPTED_TYPES, capture, labels }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isTouch = useIsMobile() || isAndroid()
  const defaultLabels = useDefaultLabels()
  const texts = labels ?? defaultLabels
  const openPicker = () => inputRef.current?.click()

  const selectFirst = (files: FileList | null) => {
    const first = files?.[0]
    if (first) onFileSelected(first)
  }

  return (
    <>
      {isTouch ? (
        <TouchPicker file={file} labels={texts} onOpenPicker={openPicker} />
      ) : (
        <DropTarget file={file} labels={texts} onOpenPicker={openPicker} onFilesDropped={selectFirst} />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={isTouch ? capture : undefined}
        className="hidden"
        onChange={(event) => {
          selectFirst(event.target.files)
          event.target.value = ""
        }}
      />
    </>
  )
}

function FileName({ file, fallback }: { file: File | null; fallback: string }) {
  return <p className="max-w-full text-sm font-medium break-all">{file ? file.name : fallback}</p>
}

type TouchPickerProps = {
  file: File | null
  labels: DropzoneLabels
  onOpenPicker: () => void
}

function TouchPicker({ file, labels, onOpenPicker }: TouchPickerProps) {
  return (
    <div className={cn(ZONE_CLASS, "border-muted-foreground/25")}>
      <FileUp className="size-8 text-muted-foreground" />
      <FileName file={file} fallback={labels.touchPrompt} />
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <Button type="button" size="lg" className="mt-2" onClick={onOpenPicker}>
        {labels.choose}
      </Button>
    </div>
  )
}

type DropTargetProps = TouchPickerProps & {
  onFilesDropped: (files: FileList | null) => void
}

function DropTarget({ file, labels, onOpenPicker, onFilesDropped }: DropTargetProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onOpenPicker()
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    onFilesDropped(event.dataTransfer.files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        ZONE_CLASS,
        "cursor-pointer outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isDragging ? "border-primary bg-muted" : "border-muted-foreground/25 hover:bg-muted/50",
      )}
    >
      <FileUp className="size-8 text-muted-foreground" />
      <FileName file={file} fallback={labels.prompt} />
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
    </div>
  )
}
