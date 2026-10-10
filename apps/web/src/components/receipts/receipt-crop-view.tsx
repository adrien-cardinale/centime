import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type PreparedReceiptImage, suggestReceiptCrop } from "@/lib/receipts/prepare-image"
import { type CropCorner, type CropRect, FULL_CROP, moveCrop, resizeCrop } from "@/lib/receipts/receipt-crop"
import { cn } from "@/lib/utils"
import { usePreparedImageUrl } from "./use-prepared-image-url"

const CORNERS: CropCorner[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"]
const KEYBOARD_STEP = 0.01

const CORNER_CLASSES: Record<CropCorner, string> = {
  topLeft: "left-0 top-0 cursor-nwse-resize",
  topRight: "left-full top-0 cursor-nesw-resize",
  bottomLeft: "left-0 top-full cursor-nesw-resize",
  bottomRight: "left-full top-full cursor-nwse-resize",
}

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [-KEYBOARD_STEP, 0],
  ArrowRight: [KEYBOARD_STEP, 0],
  ArrowUp: [0, -KEYBOARD_STEP],
  ArrowDown: [0, KEYBOARD_STEP],
}

type DragMode = "move" | CropCorner

type Drag = { mode: DragMode; startX: number; startY: number; rect: CropRect; bounds: DOMRect }

type ReceiptCropViewProps = {
  image: PreparedReceiptImage
  onApply: (rect: CropRect) => void
  onCancel: () => void
}

export function ReceiptCropView({ image, onApply, onCancel }: ReceiptCropViewProps) {
  const { t } = useTranslation()
  const url = usePreparedImageUrl(image)
  const [rect, setRect] = useSuggestedCrop(image)
  if (url === null || rect === null) return <Skeleton className="h-64 w-full" />
  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-md bg-muted p-4">
        <CropArea url={url} rect={rect} onChange={setRect} />
      </div>
      <p className="text-sm text-muted-foreground">{t("receipts.crop.hint")}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("receipts.crop.cancel")}
        </Button>
        <Button type="button" onClick={() => onApply(rect)}>
          {t("receipts.crop.apply")}
        </Button>
      </div>
    </div>
  )
}

function useSuggestedCrop(image: PreparedReceiptImage) {
  const [rect, setRect] = useState<CropRect | null>(null)
  useEffect(() => {
    let active = true
    setRect(null)
    void suggestReceiptCrop(image).then((suggested) => {
      if (active) setRect(suggested ?? FULL_CROP)
    })
    return () => {
      active = false
    }
  }, [image])
  return [rect, setRect] as const
}

function applyDrag(rect: CropRect, mode: DragMode, dx: number, dy: number): CropRect {
  return mode === "move" ? moveCrop(rect, dx, dy) : resizeCrop(rect, mode, dx, dy)
}

function frameStyle(rect: CropRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

type CropAreaProps = {
  url: string
  rect: CropRect
  onChange: (rect: CropRect) => void
}

function CropArea({ url, rect, onChange }: CropAreaProps) {
  const { t } = useTranslation()
  const areaRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const startDrag = (mode: DragMode, event: PointerEvent<HTMLElement>) => {
    const area = areaRef.current
    if (!area || event.button !== 0) return
    event.stopPropagation()
    area.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, rect, bounds: area.getBoundingClientRect() }
  }
  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startX) / drag.bounds.width
    const dy = (event.clientY - drag.startY) / drag.bounds.height
    onChange(applyDrag(drag.rect, drag.mode, dx, dy))
  }
  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div
      ref={areaRef}
      className="relative touch-none select-none"
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img src={url} alt={t("receipts.image.alt")} draggable={false} className="block max-h-[50dvh] max-w-full" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute border-2 border-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]" style={frameStyle(rect)} />
      </div>
      <div
        className="absolute cursor-move"
        style={frameStyle(rect)}
        onPointerDown={(event) => startDrag("move", event)}
      >
        {CORNERS.map((corner) => (
          <CornerHandle
            key={corner}
            corner={corner}
            onPointerDown={(event) => startDrag(corner, event)}
            onNudge={(dx, dy) => onChange(resizeCrop(rect, corner, dx, dy))}
          />
        ))}
      </div>
    </div>
  )
}

type CornerHandleProps = {
  corner: CropCorner
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onNudge: (dx: number, dy: number) => void
}

function CornerHandle({ corner, onPointerDown, onNudge }: CornerHandleProps) {
  const { t } = useTranslation()
  const nudge = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = ARROW_DELTAS[event.key]
    if (!delta) return
    event.preventDefault()
    onNudge(...delta)
  }
  return (
    <button
      type="button"
      aria-label={t(`receipts.crop.corners.${corner}`)}
      className={cn(
        "absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm",
        CORNER_CLASSES[corner],
      )}
      onPointerDown={onPointerDown}
      onKeyDown={nudge}
    />
  )
}
