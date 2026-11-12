#!/usr/bin/env python3
"""Minimal MCP server (stdio, JSON-RPC 2.0) that exposes Android phone functions to an
agent through Termux:API. No third-party packages: it must run in plain Termux Python.

Run it from the computer over SSH so nothing listens on the network:
    ssh -T phone python ~/mcp/phone_mcp.py
and register it in OpenCode (opencode.json):
    "mcp": { "phone": { "type": "local", "command": ["ssh", "-T", "-o", "BatchMode=yes", "phone",
                                                       "python", "~/mcp/phone_mcp.py"] } }
and put the sensitive tools behind approval:
    "permission": { "phone_*": "ask" }

Requires: Termux + Termux:API app + `pkg install termux-api python`.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile

PROTOCOL = "2024-11-05"
MAX_IMAGE_BYTES = 1_500_000
TIMEOUT = 30


def run(cmd, timeout=TIMEOUT, stdin=None):
    """Run a termux-* command; return stdout text or raise RuntimeError with stderr."""
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, input=stdin)
    except FileNotFoundError:
        raise RuntimeError(f"{cmd[0]} not found: install it with `pkg install termux-api`")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"{cmd[0]} timed out after {timeout}s (is the Termux:API app allowed to run?)")
    if done.returncode != 0:
        raise RuntimeError((done.stderr or done.stdout or f"{cmd[0]} failed").strip())
    return done.stdout.strip()


def text(value):
    return [{"type": "text", "text": value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)}]


def t_battery(_):
    return text(run(["termux-battery-status"]))


def t_location(a):
    provider = a.get("provider", "network")
    if provider not in ("gps", "network", "passive"):
        raise RuntimeError("provider must be gps, network or passive")
    return text(run(["termux-location", "-p", provider, "-r", "once"], timeout=60))


def t_notify(a):
    cmd = ["termux-notification", "--title", str(a.get("title", "Agent")), "--content", str(a["content"])]
    if a.get("sound"):
        cmd.append("--sound")
    run(cmd)
    return text("notification shown")


def t_speak(a):
    run(["termux-tts-speak", str(a["text"])], timeout=120)
    return text("spoken")


def t_clipboard_get(_):
    return text(run(["termux-clipboard-get"]))


def t_clipboard_set(a):
    run(["termux-clipboard-set"], stdin=str(a["text"]))
    return text("clipboard set")


def t_photo(a):
    cam = str(int(a.get("camera", 0)))
    path = os.path.join(tempfile.gettempdir(), "agent-photo.jpg")
    run(["termux-camera-photo", "-c", cam, path], timeout=60)
    size = os.path.getsize(path)
    if size > MAX_IMAGE_BYTES:
        return text(f"photo saved to {path} ({size} bytes, too large to inline); fetch it with scp")
    with open(path, "rb") as fh:
        data = base64.b64encode(fh.read()).decode()
    return [{"type": "image", "data": data, "mimeType": "image/jpeg"}]


def t_sms_list(a):
    limit = str(min(int(a.get("limit", 10)), 50))
    return text(run(["termux-sms-list", "-l", limit, "-t", str(a.get("box", "inbox"))]))


def t_sms_send(a):
    run(["termux-sms-send", "-n", str(a["number"]), str(a["text"])])
    return text("sms sent")


def t_contacts(_):
    return text(run(["termux-contact-list"]))


def t_call_log(a):
    return text(run(["termux-call-log", "-l", str(min(int(a.get("limit", 10)), 50))]))


def t_wifi(_):
    return text(run(["termux-wifi-connectioninfo"]))


def t_torch(a):
    run(["termux-torch", "on" if a.get("on", True) else "off"])
    return text("ok")


def t_vibrate(a):
    run(["termux-vibrate", "-d", str(min(int(a.get("ms", 300)), 3000))])
    return text("ok")


def t_open_url(a):
    run(["termux-open-url", str(a["url"])])
    return text("opened")


def t_confirm(a):
    """Ask the phone's owner a yes/no question on the phone screen."""
    out = run(["termux-dialog", "confirm", "-t", str(a.get("title", "Agent asks")), "-i", str(a["question"])], timeout=300)
    return text(out)


def t_volume(a):
    if "stream" in a and "level" in a:
        run(["termux-volume", str(a["stream"]), str(int(a["level"]))])
    return text(run(["termux-volume"]))


S = {"type": "string"}
I = {"type": "integer"}
B = {"type": "boolean"}

TOOLS = {
    "battery": ("Battery level, charging state, temperature.", {}, [], t_battery),
    "location": ("Current GPS/network location.", {"provider": {"type": "string", "enum": ["network", "gps", "passive"]}}, [], t_location),
    "notify": ("Show a notification on the phone.", {"title": S, "content": S, "sound": B}, ["content"], t_notify),
    "speak": ("Say text aloud through the phone speaker (TTS).", {"text": S}, ["text"], t_speak),
    "clipboard_get": ("Read the phone clipboard.", {}, [], t_clipboard_get),
    "clipboard_set": ("Put text on the phone clipboard.", {"text": S}, ["text"], t_clipboard_set),
    "camera_photo": ("Take a photo (camera 0 = back, 1 = front) and return it as an image.", {"camera": I}, [], t_photo),
    "sms_list": ("List recent SMS messages (box: inbox, sent, draft, all).", {"limit": I, "box": S}, [], t_sms_list),
    "sms_send": ("Send an SMS. Sends a real message: always needs the owner's approval.", {"number": S, "text": S}, ["number", "text"], t_sms_send),
    "contacts": ("List contacts.", {}, [], t_contacts),
    "call_log": ("Recent calls.", {"limit": I}, [], t_call_log),
    "wifi": ("Current Wi-Fi connection info.", {}, [], t_wifi),
    "torch": ("Turn the flashlight on or off.", {"on": B}, [], t_torch),
    "vibrate": ("Vibrate the phone.", {"ms": I}, [], t_vibrate),
    "open_url": ("Open a URL in the phone's browser.", {"url": S}, ["url"], t_open_url),
    "confirm_dialog": ("Ask the owner a yes/no question on the phone screen and wait for the answer.", {"title": S, "question": S}, ["question"], t_confirm),
    "volume": ("Get volumes, or set one (stream: music, ring, alarm, notification, system, call).", {"stream": S, "level": I}, [], t_volume),
}


def tool_list():
    return [
        {"name": name, "description": desc, "inputSchema": {"type": "object", "properties": props, "required": req}}
        for name, (desc, props, req, _) in TOOLS.items()
    ]


def handle(msg):
    method = msg.get("method")
    if method == "initialize":
        return {"protocolVersion": PROTOCOL, "capabilities": {"tools": {}}, "serverInfo": {"name": "termux-phone", "version": "1.0.0"}}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": tool_list()}
    if method == "tools/call":
        params = msg.get("params", {})
        entry = TOOLS.get(params.get("name"))
        if not entry:
            raise KeyError(f"unknown tool {params.get('name')}")
        try:
            return {"content": entry[3](params.get("arguments") or {})}
        except Exception as exc:  # tool failures are reported to the model, not fatal
            return {"content": text(f"error: {exc}"), "isError": True}
    raise KeyError(f"method not found: {method}")


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if "id" not in msg:  # notification (e.g. notifications/initialized): no reply
            continue
        try:
            reply = {"jsonrpc": "2.0", "id": msg["id"], "result": handle(msg)}
        except KeyError as exc:
            reply = {"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32601, "message": str(exc)}}
        sys.stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
