// Pure helper (no expo imports, unit-testable with plain `node --test`):
// picks the BCP-47 language the speech recognizer should listen for, so voice
// input is not limited to English.

import type { LocalePreference } from "./i18n/locale-resolve.ts"

export const DEFAULT_SPEECH_LANG = "en-US"

// An explicit app-language choice maps to one concrete recognizer locale.
const EXPLICIT: Record<Exclude<LocalePreference, "system">, string> = {
  en: "en-US",
  ru: "ru-RU",
  "zh-Hans": "zh-CN",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
  pt: "pt-BR",
  ja: "ja-JP",
  ko: "ko-KR",
  uk: "uk-UA",
  tr: "tr-TR",
}

/**
 * Normalise a device locale tag ("ru_RU", "zh-Hans-CN", "pt-BR") to the
 * language-REGION form Android's recognizer expects. A bare language ("fr")
 * is returned as-is; script subtags are dropped.
 */
export function normalizeSpeechTag(tag: string): string | null {
  const parts = tag.replace(/_/g, "-").split("-").filter(Boolean)
  if (parts.length === 0) return null
  const language = parts[0].toLowerCase()
  if (!/^[a-z]{2,3}$/.test(language)) return null
  const region = parts.slice(1).find((p) => /^([A-Za-z]{2}|\d{3})$/.test(p))
  return region ? `${language}-${region.toUpperCase()}` : language
}

/**
 * Speech language for a preference plus the device's ranked locale tags:
 * an explicit app language wins; "system" uses the device's first usable tag;
 * otherwise English.
 */
export function resolveSpeechLang(preference: LocalePreference, deviceTags: readonly string[]): string {
  if (preference !== "system") return EXPLICIT[preference]
  for (const tag of deviceTags) {
    const normalized = normalizeSpeechTag(tag)
    if (normalized) return normalized
  }
  return DEFAULT_SPEECH_LANG
}
