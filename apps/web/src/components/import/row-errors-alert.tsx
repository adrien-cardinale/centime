import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ImportPreview } from "@/lib/api"

type RowErrorsAlertProps = {
  errors: ImportPreview["errors"]
  total: number
}

export function RowErrorsAlert({ errors, total }: RowErrorsAlertProps) {
  const { t } = useTranslation()
  if (errors.length === 0) return null

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{t("importWorkspace.rowErrors.title", { count: total })}</AlertTitle>
      <AlertDescription>
        <ScrollArea className="max-h-40 w-full">
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                {t("importWorkspace.rowErrors.line", { line: error.line, message: error.message })}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </AlertDescription>
    </Alert>
  )
}
