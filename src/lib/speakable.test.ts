import test from "node:test"
import assert from "node:assert/strict"
import { speakableText, cleanForSpeech } from "./speakable.ts"

test("keeps prose, drops code blocks and markup", () => {
  const md = "# Итог\n\nСделал **правку** в `main.ts`.\n\n```ts\nconst x = 1\n```\n\n- пункт один\n- [ссылка](https://a.b/c)\n"
  assert.equal(cleanForSpeech(md), "Итог\n\nСделал правку в main.ts.\nпункт один\nссылка")
})

test("only text parts are spoken", () => {
  const parts = [
    { type: "reasoning", text: "скрытые мысли" },
    { type: "text", text: "Привет" },
    { type: "tool", text: "ls -la" },
    { type: "text", text: "Пока" },
  ]
  assert.equal(speakableText(parts), "Привет\n\nПока")
})

test("bare urls vanish and long text is capped", () => {
  assert.equal(cleanForSpeech("см. https://example.com/x тут"), "см. тут")
  const long = cleanForSpeech("слово ".repeat(2000))
  assert.ok(long.length <= 3501 && long.endsWith("…"))
})

test("empty input gives empty string", () => {
  assert.equal(speakableText([]), "")
})
