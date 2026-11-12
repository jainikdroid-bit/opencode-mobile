#!/usr/bin/env node
'use strict'
// MCP server (stdio, no dependencies) that exposes the phone bridge to an AI agent such as opencode.
// Register it in opencode.json:  "mcp": { "phone": { "type": "local", "command": ["node", "<path>/phone-mcp.js"] } }
// It reads the bridge port and password from the opencode-connect state directory.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const readline = require('node:readline')

const TOOL_DEFS = [
  { name: 'phone_info', description: 'Basic facts about the phone (model, OS, battery if allowed, app version). The user may decline.', inputSchema: { type: 'object', properties: {} } },
  { name: 'phone_clipboard_read', description: 'Read the phone clipboard text. The user must approve each read on the phone.', inputSchema: { type: 'object', properties: {} } },
  { name: 'phone_clipboard_write', description: 'Put text on the phone clipboard.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'phone_notify', description: 'Show a notification on the phone.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['body'] } },
  { name: 'phone_speak', description: 'Speak a short text aloud on the phone.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'phone_location', description: 'Current phone location (latitude, longitude, accuracy). The user must approve each request on the phone.', inputSchema: { type: 'object', properties: {} } },
  { name: 'phone_photo', description: 'Ask the user to take a photo with the phone camera; returns the image. The user must approve and press the shutter.', inputSchema: { type: 'object', properties: {} } },
]

function stateDir(env = process.env) {
  if (env.OPENCODE_CONNECT_DIR) return env.OPENCODE_CONNECT_DIR
  if (process.platform === 'win32') return path.join(env.LOCALAPPDATA || os.homedir(), 'opencode-connect')
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode-connect')
}

/** Port of the bridge: two below the server (the launcher is one below). */
function bridgePort(state) {
  return Number(state.bridgePort) || (Number(state.port) || 4096) - 2
}

function callBridge(dir, tool, args) {
  return new Promise((resolve) => {
    let state = {}
    let password = ''
    try { state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8').replace(/^﻿/, '')) } catch { /* not installed */ }
    try { password = fs.readFileSync(path.join(dir, 'password'), 'utf8').trim() } catch { /* not installed */ }
    if (!password) return resolve({ ok: false, error: 'OpenCode Connect is not set up on this computer' })
    const body = JSON.stringify({ tool, args })
    const req = http.request({
      host: '127.0.0.1', port: bridgePort(state), path: '/call', method: 'POST', timeout: 130_000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64') },
    }, (res) => {
      let text = ''
      res.on('data', (c) => { text += c })
      res.on('end', () => { try { resolve(JSON.parse(text)) } catch { resolve({ ok: false, error: `bridge answered ${res.statusCode}` }) } })
    })
    req.on('error', () => resolve({ ok: false, error: 'the phone bridge is not running (re-run the OpenCode Connect installer with --phone-tools)' }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'bridge timed out' }) })
    req.end(body)
  })
}

/** Maps a bridge answer to MCP tool content; a photo comes back as an image block. */
function toMcpResult(tool, answer) {
  if (!answer.ok) return { isError: true, content: [{ type: 'text', text: String(answer.error || 'failed') }] }
  const data = answer.data
  if (tool === 'phone_photo' && data && typeof data.base64 === 'string') {
    return { content: [{ type: 'image', data: data.base64, mimeType: data.mime || 'image/jpeg' }] }
  }
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data ?? { done: true }) }] }
}

async function handleMessage(message, call) {
  const { id, method, params } = message
  const reply = (result) => ({ jsonrpc: '2.0', id, result })
  if (method === 'initialize') return reply({ protocolVersion: (params && params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'opencode-phone', version: '1.0.0' } })
  if (method === 'tools/list') return reply({ tools: TOOL_DEFS })
  if (method === 'tools/call') {
    const name = params && params.name
    if (!TOOL_DEFS.some((t) => t.name === name)) return { jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool ${name}` } }
    return reply(toMcpResult(name, await call(name, (params && params.arguments) || {})))
  }
  if (method === 'ping') return reply({})
  if (id === undefined) return null // notifications need no answer
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } }
}

function main() {
  const dir = stateDir()
  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', async (line) => {
    if (!line.trim()) return
    let message
    try { message = JSON.parse(line) } catch { return }
    const out = await handleMessage(message, (tool, args) => callBridge(dir, tool, args))
    if (out) process.stdout.write(JSON.stringify(out) + '\n')
  })
}

module.exports = { TOOL_DEFS, handleMessage, toMcpResult, bridgePort }
if (require.main === module) main()
