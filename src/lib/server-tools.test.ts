import test from "node:test"
import assert from "node:assert/strict"
import {
  sortEntries, parentPath, breadcrumbs, formatBytes, clipForView, numberLines,
  toWebSocketBase, ptySocketUrl, isControlFrame, applyCtrl, SPECIAL_KEYS, diffInput,
} from "./server-tools.ts"

test("directories first, then files, case-insensitive, ignored last in group", () => {
  const sorted = sortEntries([
    { name: "b.ts", path: "b.ts", type: "file" as const },
    { name: "Zed", path: "Zed", type: "directory" as const },
    { name: "a.ts", path: "a.ts", type: "file" as const },
    { name: "node_modules", path: "node_modules", type: "directory" as const, ignored: true },
    { name: "alpha", path: "alpha", type: "directory" as const },
  ])
  assert.deepEqual(sorted.map((e) => e.name), ["alpha", "Zed", "node_modules", "a.ts", "b.ts"])
})

test("parent path and breadcrumbs handle both separators", () => {
  assert.equal(parentPath("a/b/c"), "a/b")
  assert.equal(parentPath("a\\b"), "a")
  assert.equal(parentPath("a"), "")
  assert.equal(parentPath(""), "")
  assert.deepEqual(breadcrumbs("src/lib/x.ts"), [
    { label: "src", path: "src" },
    { label: "lib", path: "src/lib" },
    { label: "x.ts", path: "src/lib/x.ts" },
  ])
  assert.deepEqual(breadcrumbs(""), [])
})

test("byte formatting", () => {
  assert.equal(formatBytes(0), "0 B")
  assert.equal(formatBytes(1023), "1023 B")
  assert.equal(formatBytes(1536), "1.5 KB")
  assert.equal(formatBytes(20 * 1024), "20 KB")
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB")
  assert.equal(formatBytes(-1), "")
})

test("long text is clipped at a line boundary and flagged", () => {
  assert.deepEqual(clipForView("abc", 10), { text: "abc", clipped: false })
  const text = "line1\nline2\nline3\nline4"
  const r = clipForView(text, 14)
  assert.equal(r.clipped, true)
  assert.equal(r.text, "line1\nline2")
})

test("numbered lines drop the trailing empty line and size the gutter", () => {
  assert.deepEqual(numberLines("a\nb\n"), { lines: ["a", "b"], gutter: 1 })
  const many = Array.from({ length: 120 }, (_, i) => `l${i}`).join("\n")
  assert.equal(numberLines(many).gutter, 3)
})

test("websocket urls", () => {
  assert.equal(toWebSocketBase("http://100.1.2.3:4096/"), "ws://100.1.2.3:4096")
  assert.equal(toWebSocketBase("https://x.ts.net"), "wss://x.ts.net")
  assert.equal(ptySocketUrl("http://h:4096", "pty_abc"), "ws://h:4096/pty/pty_abc/connect")
})

test("control frames are recognised", () => {
  assert.equal(isControlFrame('\u0000{"cursor":0}'), true)
  assert.equal(isControlFrame("hello"), false)
  assert.equal(isControlFrame(""), false)
})

test("ctrl combinations and special keys", () => {
  assert.equal(applyCtrl("c"), "\u0003")
  assert.equal(applyCtrl("D"), "\u0004")
  assert.equal(applyCtrl("["), "\u001b")
  assert.equal(applyCtrl("1"), "1")
  assert.equal(applyCtrl("ab"), "ab")
  assert.equal(SPECIAL_KEYS.up, "\u001b[A")
  assert.equal(SPECIAL_KEYS.tab, "\t")
})

test("typed text is sent as the difference between field values", () => {
  assert.equal(diffInput("", "ls"), "ls")
  assert.equal(diffInput("ls", "ls -la"), " -la")
  assert.equal(diffInput("ls -la", "ls"), "\u007f\u007f\u007f\u007f")
  assert.equal(diffInput("hello", "help"), "\u007f\u007fp")
  assert.equal(diffInput("abc", "abc"), "")
  assert.equal(diffInput("abc", ""), "\u007f\u007f\u007f")
})
