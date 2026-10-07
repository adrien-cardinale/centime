import { useTranslation } from "react-i18next"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type Language, SUPPORTED_LANGUAGES, setLanguage } from "@/i18n"

export function LanguageSelect() {
  const { t, i18n } = useTranslation()
  return (
    <Select value={i18n.language} onValueChange={(language) => void setLanguage(language as Language)}>
      <SelectTrigger className="w-48" aria-label={t("language.title")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((language) => (
          <SelectItem key={language} value={language}>
            {t(`language.${language}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
