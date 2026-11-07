# Cotton Candy – personal notch-style AI companion

A small always-on-top island at the top-centre of your screen with a character whose eyes follow your cursor.
Chat with free-tier models from Google AI Studio, GitHub Models or NVIDIA NIM, and watch Claude Code status.

## Run
1. Install Node.js 20+ from nodejs.org
2. In this folder: `npm install` then `npm start` (or `npm run dist` to build the Windows exe locally)
3. Click the pill (or Ctrl/Cmd+Shift+Space), click the gear, paste a key, Save.

## Free keys
- Groq (fastest): https://console.groq.com/keys
- Cerebras: https://cloud.cerebras.ai
- OpenRouter: https://openrouter.ai/keys (models ending in :free)
- Google AI Studio: https://aistudio.google.com/apikey
- GitHub Models: fine-grained personal access token with "Models: read" – https://github.com/settings/tokens
- NVIDIA NIM: https://build.nvidia.com (key starts with nvapi-)

## Agents tab: live status + approvals (Claude Code)
Add to ~/.claude/settings.json (Windows: %USERPROFILE%\.claude\settings.json), merging with any existing "hooks".
Cotton Candy must be running; if it is not, Claude Code just shows its normal prompt.

{
  "hooks": {
    "UserPromptSubmit": [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}],
    "PreToolUse":       [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}],
    "Notification":     [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}],
    "Stop":             [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}],
    "PermissionRequest":[{"hooks":[{"type":"command","command":"curl -s -m 115 -X POST http://127.0.0.1:47821/approve --data-binary @-"}]}]
  }
}

PermissionRequest shows Allow / Deny / Ask-in-terminal buttons in the Agents tab.
Other agents can post the same JSON to /event: {"agent":"Codex","session_id":"1","event":"PreToolUse","tool_name":"Bash","cwd":"C:\\proj"}
