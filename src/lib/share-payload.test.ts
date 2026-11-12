import test from "node:test"
import assert from "node:assert/strict"
import { planShare, fenceFile, hasShareContent, MAX_TEXT_FILE_BYTES } from "./share-payload.ts"

test("text and link are merged without duplicates", () => {
  assert.equal(planShare({ text: " hi ", webUrl: "https://a.b" }).text, "hi\nhttps://a.b")
  assert.equal(planShare({ text: "https://a.b", webUrl: "https://a.b" }).text, "https://a.b")
  assert.equal(planShare({ text: "Look at https://a.b please", webUrl: "https://a.b" }).text, "Look at https://a.b please")
})
test("files are sorted into images, text files and skipped", () => {
  const p = planShare({
    files: [
      { path: "/data/x.jpg", mimeType: "image/jpeg", fileName: "x.jpg", width: 100, height: 50 },
      { path: "/data/n.py", mimeType: "application/octet-stream", fileName: "n.py", size: "120" },
      { path: "/data/big.log", mimeType: "text/plain", fileName: "big.log", size: MAX_TEXT_FILE_BYTES + 1 },
      { path: "/data/a.zip", mimeType: "application/zip", fileName: "a.zip" },
    ],
  })
  assert.deepEqual(p.images, [{ uri: "file:///data/x.jpg", mime: "image/jpeg", filename: "x.jpg", width: 100, height: 50 }])
  assert.deepEqual(p.textFiles, [{ uri: "file:///data/n.py", filename: "n.py" }])
  assert.deepEqual(p.skipped, ["big.log (too large)", "a.zip (unsupported type)"])
  assert.equal(hasShareContent(p), true)
})
test("empty share has no content", () => assert.equal(hasShareContent(planShare({})), false))
test("fenced file survives content with backticks", () => {
  assert.equal(fenceFile("a.md", "x\n"), "a.md:\n```\nx\n```")
  assert.ok(fenceFile("a.md", "```js\n1\n```").includes("~~~~"))
})
