import { FileText, ImageUp, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FileDropzone } from "@/components/import/file-dropzone"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { type PreparedReceiptImage, prepareReceiptImage } from "@/lib/receipts/prepare-image"
import { isAndroid } from "@/lib/runtime"
import { formatFileSize } from "./receipt-lines"

const ACCEPTED_TYPES = "image/*,application/pdf"
const PDF_MIME = "application/pdf"

type ReceiptPhotoStepProps = {
  image: PreparedReceiptImage | null
  onImageChange: (image: PreparedReceiptImage | null) => void
  onContinue: () => void
}

export function ReceiptPhotoStep({ image, onImageChange, onContinue }: ReceiptPhotoStepProps) {
  const { t } = useTranslation()
  const [preparing, setPreparing] = useState(false)
  const isTouch = useIsMobile() || isAndroid()

  const selectFile = async (file: File) => {
    setPreparing(true)
    try {
      onImageChange(await prepareReceiptImage(file))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("receipts.photo.failed"))
    } finally {
      setPreparing(false)
    }
  }

  if (preparing) return <Skeleton className="h-64 w-full" />
  if (!image) {
    return (
      <div className="space-y-3">
        <FileDropzone
          file={null}
          accept={ACCEPTED_TYPES}
          capture="environment"
          onFileSelected={(file) => void selectFile(file)}
          labels={{
            prompt: t("receipts.photo.prompt"),
            touchPrompt: t("receipts.photo.touchPrompt"),
            hint: t("receipts.photo.hint"),
            choose: t("receipts.photo.choose"),
          }}
        />
        {isTouch && <PickFileButton onFileSelected={(file) => void selectFile(file)} />}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <ImagePreview image={image} />
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("receipts.photo.size", { size: formatFileSize(image.bytes.byteLength) })}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onImageChange(null)}>
          <RotateCcw />
          {t("receipts.photo.retake")}
        </Button>
        <Button type="button" onClick={onContinue}>
          {t("receipts.actions.continue")}
        </Button>
      </div>
    </div>
  )
}

function PickFileButton({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
        <ImageUp />
        {t("receipts.photo.pickFile")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelected(file)
          event.target.value = ""
        }}
      />
    </>
  )
}

function usePreviewUrl(image: PreparedReceiptImage): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.mime }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [image])
  return url
}

function ImagePreview({ image }: { image: PreparedReceiptImage }) {
  const { t } = useTranslation()
  const url = usePreviewUrl(image)
  if (image.mime === PDF_MIME) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md bg-muted text-sm text-muted-foreground">
        <FileText className="size-8" aria-hidden />
        {t("receipts.image.pdf")}
      </div>
    )
  }
  if (url === null) return <Skeleton className="h-64 w-full" />
  return <img src={url} alt={t("receipts.image.alt")} className="max-h-[50dvh] w-full rounded-md bg-muted object-contain" />
}
