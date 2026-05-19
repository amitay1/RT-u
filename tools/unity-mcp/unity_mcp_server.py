#!/usr/bin/env python3
"""Small MCP stdio server for controlling the Scan Master Unity editor bridge."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, Iterable, Optional


BRIDGE_URL = os.environ.get("UNITY_MCP_URL", "http://127.0.0.1:17777").rstrip("/")
PROTOCOL_VERSION = "2024-11-05"


def read_message() -> Optional[Dict[str, Any]]:
    headers: Dict[str, str] = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        if line in (b"\r\n", b"\n"):
            break
        key, _, value = line.decode("ascii", errors="replace").partition(":")
        headers[key.lower()] = value.strip()

    length = int(headers.get("content-length", "0"))
    if length <= 0:
        return None
    payload = sys.stdin.buffer.read(length)
    return json.loads(payload.decode("utf-8"))


def write_message(message: Dict[str, Any]) -> None:
    payload = json.dumps(message, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(payload)}\r\n\r\n".encode("ascii"))
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()


def ok_response(request_id: Any, result: Dict[str, Any]) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def error_response(request_id: Any, code: int, message: str) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def text_content(value: Any) -> Dict[str, Any]:
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, indent=2, ensure_ascii=False)
    return {"content": [{"type": "text", "text": text}]}


def schema(properties: Dict[str, Any], required: Iterable[str] = ()) -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": list(required),
        "additionalProperties": False,
    }


TOOLS = [
    {
        "name": "unity_status",
        "description": "Check whether the Unity editor bridge is reachable and return active scene status.",
        "inputSchema": schema({}),
    },
    {
        "name": "unity_build_scanmaster_scene",
        "description": "Run Scan Master > Build Simulation Scene in Unity.",
        "inputSchema": schema({}),
    },
    {
        "name": "unity_open_scene",
        "description": "Open a scene by Unity asset path, for example Assets/ScanMasterSimulation/Scenes/ScanMasterImmersionDemo.unity.",
        "inputSchema": schema({"scenePath": {"type": "string"}}, ["scenePath"]),
    },
    {
        "name": "unity_save_scene",
        "description": "Save the active Unity scene.",
        "inputSchema": schema({}),
    },
    {
        "name": "unity_list_scene_objects",
        "description": "List all GameObjects in the active Unity scene with paths, transforms, active state, and components.",
        "inputSchema": schema({}),
    },
    {
        "name": "unity_create_primitive",
        "description": "Create a primitive GameObject in the active scene.",
        "inputSchema": schema(
            {
                "type": {"type": "string", "enum": ["cube", "sphere", "capsule", "cylinder", "plane", "quad"]},
                "name": {"type": "string"},
                "x": {"type": "number"},
                "y": {"type": "number"},
                "z": {"type": "number"},
                "sx": {"type": "number"},
                "sy": {"type": "number"},
                "sz": {"type": "number"},
            },
            ["type", "name"],
        ),
    },
    {
        "name": "unity_set_transform",
        "description": "Set world position, world Euler rotation, or local scale on a GameObject.",
        "inputSchema": schema(
            {
                "objectPath": {"type": "string"},
                "hasPosition": {"type": "boolean"},
                "x": {"type": "number"},
                "y": {"type": "number"},
                "z": {"type": "number"},
                "hasRotation": {"type": "boolean"},
                "rx": {"type": "number"},
                "ry": {"type": "number"},
                "rz": {"type": "number"},
                "hasScale": {"type": "boolean"},
                "sx": {"type": "number"},
                "sy": {"type": "number"},
                "sz": {"type": "number"},
            },
            ["objectPath"],
        ),
    },
    {
        "name": "unity_set_active",
        "description": "Set GameObject active state.",
        "inputSchema": schema({"objectPath": {"type": "string"}, "active": {"type": "boolean"}}, ["objectPath", "active"]),
    },
    {
        "name": "unity_delete_object",
        "description": "Delete a GameObject from the active scene.",
        "inputSchema": schema({"objectPath": {"type": "string"}}, ["objectPath"]),
    },
    {
        "name": "unity_play",
        "description": "Enter or exit Unity play mode.",
        "inputSchema": schema({"playing": {"type": "boolean"}}, ["playing"]),
    },
    {
        "name": "unity_execute_menu",
        "description": "Execute a Unity editor menu item by path, for example Scan Master/Build Simulation Scene.",
        "inputSchema": schema({"menuItem": {"type": "string"}}, ["menuItem"]),
    },
]


def bridge_command(command: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload = dict(arguments or {})
    payload["command"] = command
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BRIDGE_URL + "/command",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        return {
            "ok": False,
            "message": f"Unity bridge is not reachable at {BRIDGE_URL}. Open the Unity project and make sure Scan Master/MCP/Start Bridge is running. Details: {exc}",
            "data": {},
        }


def call_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if name == "unity_status":
        return bridge_command("status", arguments)
    if name == "unity_build_scanmaster_scene":
        return bridge_command("build_scanmaster_scene", arguments)
    if name == "unity_open_scene":
        return bridge_command("open_scene", arguments)
    if name == "unity_save_scene":
        return bridge_command("save_scene", arguments)
    if name == "unity_list_scene_objects":
        return bridge_command("list_scene_objects", arguments)
    if name == "unity_create_primitive":
        prepared = dict(arguments)
        prepared["hasPosition"] = all(key in prepared for key in ("x", "y", "z"))
        prepared["hasScale"] = all(key in prepared for key in ("sx", "sy", "sz"))
        return bridge_command("create_primitive", prepared)
    if name == "unity_set_transform":
        return bridge_command("set_transform", arguments)
    if name == "unity_set_active":
        return bridge_command("set_active", arguments)
    if name == "unity_delete_object":
        return bridge_command("delete_object", arguments)
    if name == "unity_play":
        return bridge_command("enter_play_mode" if arguments.get("playing") else "exit_play_mode", arguments)
    if name == "unity_execute_menu":
        return bridge_command("execute_menu", arguments)
    return {"ok": False, "message": f"Unknown tool: {name}", "data": {}}


def handle(message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}

    if method == "initialize":
        return ok_response(
            request_id,
            {
                "protocolVersion": params.get("protocolVersion", PROTOCOL_VERSION),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "scanmaster-unity-mcp", "version": "0.1.0"},
            },
        )
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return ok_response(request_id, {"tools": TOOLS})
    if method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments") or {}
        return ok_response(request_id, text_content(call_tool(name, arguments)))

    if request_id is None:
        return None
    return error_response(request_id, -32601, f"Unsupported method: {method}")


def main() -> int:
    while True:
        message = read_message()
        if message is None:
            return 0
        response = handle(message)
        if response is not None:
            write_message(response)


if __name__ == "__main__":
    raise SystemExit(main())

