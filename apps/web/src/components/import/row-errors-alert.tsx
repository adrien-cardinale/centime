import { TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ImportPreview } from "@/lib/api"

type RowErrorsAlertProps = {
  errors: ImportPreview["errors"]
  total: number
}

export function RowErrorsAlert({ errors, total }: RowErrorsAlertProps) {
  if (errors.length === 0) return null

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>
        {total} ligne{total > 1 ? "s" : ""} ignorée{total > 1 ? "s" : ""}
      </AlertTitle>
      <AlertDescription>
        <ScrollArea className="max-h-40 w-full">
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                Ligne {error.line} : {error.message}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </AlertDescription>
    </Alert>
  )
}
