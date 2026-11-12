import { test } from "node:test"
import assert from "node:assert/strict"
import { matchSupportedLocale, resolveLocale, FALLBACK_LOCALE } from "./locale-resolve.ts"

test("matchSupportedLocale maps zh variants to zh-Hans", () => {
  assert.equal(matchSupportedLocale("zh"), "zh-Hans")
  assert.equal(matchSupportedLocale("zh-CN"), "zh-Hans")
  assert.equal(matchSupportedLocale("zh-Hans"), "zh-Hans")
  assert.equal(matchSupportedLocale("zh-Hans-CN"), "zh-Hans")
  assert.equal(matchSupportedLocale("zh-Hant-TW"), "zh-Hans") // no zh-Hant catalog yet — closest match
})

test("matchSupportedLocale maps en variants to en", () => {
  assert.equal(matchSupportedLocale("en"), "en")
  assert.equal(matchSupportedLocale("en-US"), "en")
  assert.equal(matchSupportedLocale("EN-GB"), "en") // case-insensitive
})

test("matchSupportedLocale returns null for unsupported languages", () => {
  assert.equal(matchSupportedLocale("it-IT"), null)
  assert.equal(matchSupportedLocale("ar"), null)
  assert.equal(matchSupportedLocale("hi-IN"), null)
})

test("resolveLocale: explicit preference always wins over device tags", () => {
  assert.equal(resolveLocale("en", ["zh-Hans-CN"]), "en")
  assert.equal(resolveLocale("zh-Hans", ["en-US"]), "zh-Hans")
})

test("resolveLocale: system preference picks first supported device tag", () => {
  assert.equal(resolveLocale("system", ["it-IT", "zh-Hans-CN", "en-US"]), "zh-Hans")
  assert.equal(resolveLocale("system", ["en-US", "zh-Hans-CN"]), "en")
})

test("resolveLocale: system preference falls back when nothing matches", () => {
  assert.equal(resolveLocale("system", ["it-IT", "ar-SA"]), FALLBACK_LOCALE)
  assert.equal(resolveLocale("system", []), FALLBACK_LOCALE)
})

test("the new languages resolve from device tags", () => {
  assert.equal(matchSupportedLocale("fr-FR"), "fr")
  assert.equal(matchSupportedLocale("pt-BR"), "pt")
  assert.equal(matchSupportedLocale("pt_PT"), "pt")
  assert.equal(matchSupportedLocale("ja-JP"), "ja")
  assert.equal(matchSupportedLocale("uk-UA"), "uk")
  assert.equal(resolveLocale("system", ["tr-TR", "en-US"]), "tr")
})
