import test from "node:test"
import assert from "node:assert/strict"
import { normalizeSpeechTag, resolveSpeechLang, DEFAULT_SPEECH_LANG } from "./speech-lang.ts"

test("explicit app language maps to a concrete recognizer locale", () => {
  assert.equal(resolveSpeechLang("ru", ["en-US"]), "ru-RU")
  assert.equal(resolveSpeechLang("en", ["ru-RU"]), "en-US")
  assert.equal(resolveSpeechLang("zh-Hans", []), "zh-CN")
})

test("system preference follows the first device locale, any language", () => {
  assert.equal(resolveSpeechLang("system", ["ru-RU", "en-US"]), "ru-RU")
  assert.equal(resolveSpeechLang("system", ["de-DE"]), "de-DE")
  assert.equal(resolveSpeechLang("system", ["pt_BR"]), "pt-BR")
})

test("script subtags are dropped and bare languages are kept", () => {
  assert.equal(normalizeSpeechTag("zh-Hans-CN"), "zh-CN")
  assert.equal(normalizeSpeechTag("fr"), "fr")
  assert.equal(normalizeSpeechTag("es-419"), "es-419")
})

test("falls back to English when nothing usable is available", () => {
  assert.equal(resolveSpeechLang("system", []), DEFAULT_SPEECH_LANG)
  assert.equal(resolveSpeechLang("system", ["", "!!"]), DEFAULT_SPEECH_LANG)
})
