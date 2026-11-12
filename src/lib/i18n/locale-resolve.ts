// Pure locale-resolution logic, kept free of expo-localization/i18next imports
// so it's unit-testable with plain `node --test` (same split as
// settings-merge.ts / store-review-policy.ts).

export const SUPPORTED_LOCALES = ["en", "ru", "zh-Hans", "es", "de", "fr", "pt", "ja", "ko", "uk", "tr"] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** Each language in its own name: the picker must be readable by someone who cannot read the current UI language. */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  ru: "Русский",
  "zh-Hans": "简体中文",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  pt: "Português",
  ja: "日本語",
  ko: "한국어",
  uk: "Українська",
  tr: "Türkçe",
}

export const FALLBACK_LOCALE: SupportedLocale = "en"

// User-facing preference: "system" defers to the device's locale list.
export type LocalePreference = "system" | SupportedLocale

/**
 * Map one device locale tag (e.g. "zh-Hans-CN", "zh-CN", "en-US", "fr-FR") to
 * one of our supported catalogs, matching by language subtag since we don't
 * ship per-region variants. Returns null if we have no catalog for it.
 */
export function matchSupportedLocale(tag: string): SupportedLocale | null {
  const lower = tag.toLowerCase()
  if (lower.startsWith("zh")) return "zh-Hans"
  const language = lower.split(/[-_]/)[0]
  return (SUPPORTED_LOCALES as readonly string[]).includes(language) ? (language as SupportedLocale) : null
}

/**
 * Resolve the effective app locale from a user preference plus the device's
 * ranked list of locale tags (as returned by expo-localization's
 * `getLocales().map(l => l.languageTag)`).
 * - An explicit preference (anything but "system") always wins.
 * - "system" walks the device list in priority order and uses the first tag
 *   we have a catalog for.
 * - If nothing matches (or the list is empty), falls back to FALLBACK_LOCALE.
 */
export function resolveLocale(preference: LocalePreference, deviceTags: readonly string[]): SupportedLocale {
  if (preference !== "system") return preference

  for (const tag of deviceTags) {
    const match = matchSupportedLocale(tag)
    if (match) return match
  }

  return FALLBACK_LOCALE
}
