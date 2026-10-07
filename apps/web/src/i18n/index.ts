import { enUS, fr } from "date-fns/locale"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"
import frMessages from "./locales/fr.json"

export const SUPPORTED_LANGUAGES = ["fr", "en"] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const DEFAULT_LANGUAGE: Language = "fr"
const STORAGE_KEY = "centime.language"

const intlLocales: Record<Language, string> = { fr: "fr-CH", en: "en-CH" }
const dateFnsLocales = { fr, en: enUS }

function isLanguage(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value)
}

function readStoredLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

function detectLanguage(): Language {
  const stored = readStoredLanguage()
  if (stored) return stored
  const browser = typeof navigator === "undefined" ? undefined : navigator.language.slice(0, 2)
  return isLanguage(browser) ? browser : DEFAULT_LANGUAGE
}

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export function currentIntlLocale(): string {
  return intlLocales[currentLanguage()]
}

export function currentDateFnsLocale() {
  return dateFnsLocales[currentLanguage()]
}

export function setLanguage(language: Language): Promise<unknown> {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Le choix reste valable pour la session si le stockage est indisponible.
  }
  return i18n.changeLanguage(language)
}

i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined") document.documentElement.lang = language
})

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: frMessages }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
