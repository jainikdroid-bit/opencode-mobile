// Guards against locale drift: en.json and zh-Hans.json must expose exactly
// the same set of translation keys, or i18next silently falls back to the
// key path (en) / nothing sensible (missing zh copy) at runtime. Run with
// plain `node --test` — no i18next/expo-localization imports needed, same
// as locale-resolve.test.ts.
import { test } from "node:test"
import assert from "node:assert/strict"
import en from "./en.json" with { type: "json" }
import zhHans from "./zh-Hans.json" with { type: "json" }

// Flattens a nested translation object into dotted leaf-key paths, e.g.
// { settings: { language: { label: "..." } } } -> ["settings.language.label"]
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix]
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "object" && value !== null) {
      keys.push(...flattenKeys(value, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

test("en.json and zh-Hans.json expose identical translation keys", () => {
  const enKeys = new Set(flattenKeys(en))
  const zhKeys = new Set(flattenKeys(zhHans))

  const missingFromZh = [...enKeys].filter((k) => !zhKeys.has(k)).sort()
  const missingFromEn = [...zhKeys].filter((k) => !enKeys.has(k)).sort()

  assert.deepEqual(missingFromZh, [], `keys present in en.json but missing from zh-Hans.json: ${missingFromZh.join(", ")}`)
  assert.deepEqual(missingFromEn, [], `keys present in zh-Hans.json but missing from en.json: ${missingFromEn.join(", ")}`)
})

test("no translation value is an empty string", () => {
  for (const [name, catalog] of [["en", en], ["zh-Hans", zhHans]] as const) {
    const keys = flattenKeys(catalog)
    for (const key of keys) {
      const value = key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], catalog)
      assert.notEqual(value, "", `${name}.json: "${key}" is an empty string`)
    }
  }
})

// Every shipped language must have exactly the English keys and the same {{placeholders}} in every value:
// a missing key shows the raw key path to users, a dropped placeholder shows "undefined" or loses a number.
import fs from "node:fs"
import path from "node:path"

const I18N_DIR = import.meta.dirname

function placeholders(value: string): string[] {
  return (value.match(/\{\{\w+\}\}/g) ?? []).sort()
}

function valueAt(catalog: unknown, key: string): string {
  return String(key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], catalog))
}

for (const file of fs.readdirSync(I18N_DIR).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  test(`${file} has the same keys and placeholders as en.json`, () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(I18N_DIR, file), "utf8"))
    const enKeys = new Set(flattenKeys(en))
    const keys = new Set(flattenKeys(catalog))
    assert.deepEqual([...enKeys].filter((k) => !keys.has(k)), [], `${file}: keys missing`)
    assert.deepEqual([...keys].filter((k) => !enKeys.has(k)), [], `${file}: unknown keys`)
    for (const key of enKeys) {
      assert.deepEqual(placeholders(valueAt(catalog, key)), placeholders(valueAt(en, key)), `${file}: placeholders differ in "${key}"`)
      assert.notEqual(valueAt(catalog, key).trim(), "", `${file}: "${key}" is empty`)
    }
  })
}
