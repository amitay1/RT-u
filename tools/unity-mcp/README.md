# Scan Master Unity MCP

This folder contains the local MCP stdio server used by Codex.

It talks to the Unity Editor bridge in:

`unity-scanmaster-simulation/Assets/ScanMasterSimulation/Editor/Scripts/ScanMasterMcpBridge.cs`

## Startup

1. Open the Unity project.
2. Let Unity finish compiling scripts.
3. If the bridge is not reachable, restart Unity or run:
   `Scan Master > MCP > Start Bridge`
4. Confirm the bridge is reachable:
   `http://127.0.0.1:17777/health`
5. Restart the Codex session so `.mcp.json` is reloaded and the `unity` MCP server becomes available.

## Tools Exposed

- `unity_status`
- `unity_build_scanmaster_scene`
- `unity_open_scene`
- `unity_save_scene`
- `unity_list_scene_objects`
- `unity_create_primitive`
- `unity_set_transform`
- `unity_set_active`
- `unity_delete_object`
- `unity_play`
- `unity_execute_menu`

