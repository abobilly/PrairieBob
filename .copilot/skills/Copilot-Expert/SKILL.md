---
name: Copilot-Expert
description: Architecture and implementation guidance for GitHub Copilot SDK and Copilot CLI in 2026 Technical Preview workflows. Use when prompts mention Copilot SDK, Copilot CLI, /mcp, /delegate, MCP servers, or AI integration design and execution.
---

# Policy Gate (Required Before Using This Skill)

1. Read `.github/copilot-instructions.md` first and treat it as authoritative policy.
2. This skill is supplemental reference material and must not override repository policy.
3. If any guidance here conflicts with `.github/copilot-instructions.md`, follow `.github/copilot-instructions.md`.
4. Runtime note: SpudTile in-app agent behavior is controlled by `electron/agent-main.ts`, `electron/preload.ts`, and `src/components/AgentPanel.tsx`, not by markdown skill docs.

# Level 1 Trigger Logic

1. If the request mentions Copilot SDK, SDK client code, or embedding agent capabilities in an app, load `sdk-reference.md`.
2. If the request mentions Copilot CLI, slash commands, `/mcp`, `/delegate`, task delegation, or MCP CLI config, load `cli-reference.md`.
3. If the request is broad AI integration architecture, load both references and synthesize a single recommendation.
4. Keep this file as trigger-level routing only; keep detailed APIs and workflows in the reference files.
