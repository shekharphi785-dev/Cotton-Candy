# Cotton Candy – personal notch-style AI companion

A small always-on-top island at the top-centre of your screen with a character whose eyes follow your cursor.
Chat with free-tier models from Google AI Studio, GitHub Models or NVIDIA NIM, and watch Claude Code status.

## Run
1. Install Node.js 20+ from nodejs.org
2. In this folder: `npm install` then `npm start` (or `npm run dist` to build the Windows exe locally)
3. Click the pill (or Ctrl/Cmd+Shift+Space), click the gear, paste a key, Save.

## Free keys
- Google AI Studio: https://aistudio.google.com/apikey
- GitHub Models: fine-grained personal access token with "Models: read" – https://github.com/settings/tokens
- NVIDIA NIM: https://build.nvidia.com (key starts with nvapi-)

## Claude Code status (optional)
Add to ~/.claude/settings.json (Windows: %USERPROFILE%\.claude\settings.json), merging with existing "hooks":

{
  "hooks": {
    "PreToolUse":   [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}],
    "Notification": [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}],
    "Stop":         [{"hooks":[{"type":"command","command":"curl -s -m 1 -X POST http://127.0.0.1:47821/event --data-binary @-"}]}]
  }
}
