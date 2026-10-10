import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function ReceiptOcrText({ text }: { text: string }) {
  const { t } = useTranslation()
  return (
    <Collapsible className="text-sm">
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" aria-hidden />
        {t("receipts.ocr.rawText")}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-2 font-mono text-xs">
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
