import { useTranslation } from "react-i18next"
import { LanguageSelect } from "@/components/language-select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LanguageCard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.language.title")}</CardTitle>
        <CardDescription>{t("settings.language.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LanguageSelect />
      </CardContent>
    </Card>
  )
}
