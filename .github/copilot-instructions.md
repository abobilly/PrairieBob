# SpudTile — Copilot Instructions

## Project Context

SpudTile is an LDtk-compatible tile map editor built with React + TypeScript + Vite + Electron.

### Stack

- **UI**: React 19, TypeScript, Vite 7, Electron 36
- **State**: Zustand + Immer (stores in `src/stores/`)
- **Components**: shadcn/ui, @phosphor-icons/react
- **Data Model**: LDtk format (`src/lib/ldtk/`)
- **Build**: `npm run build` (must pass before committing)
- **Package**: `npm run electron:compile && npx electron-builder --win --dir`

### Critical Notes

- **DO NOT use Radix UI Slider** — `@radix-ui/react-slider` is incompatible with React 19 (infinite re-render loop via `useControllableState` reference comparison). Use native `<input type="range">` instead.
- **DO NOT open localhost** — SpudTile is an Electron app. Never launch `vite preview` or open browser URLs in production builds. Use `npm run build && npx electron .` for testing, or package with electron-builder for release.
- **Build path**: `npm run build` -> `npm run electron:compile` -> `npx electron-builder --win --dir` -> `release/win-unpacked/SpudTile.exe`

### Key Conventions

- Zustand stores use Immer middleware and devtools
- Components go in `src/components/` (panels in `src/components/panels/`)
- LDtk types/logic in `src/lib/ldtk/`
- Tools extend `Tool` base class in `src/lib/ldtk/tools/`
- All file paths use forward slashes in imports
- Commit messages are concise, list files changed

---

## SDK Agent Instructions

When operating as an implementation agent via SDK sessions:

### Policy Precedence (Do Not Drift)

- Authoritative policy for this repository lives in this file.
- `.copilot/skills/Copilot-Expert/*` is supplemental reference material, not policy authority.
- If any skill/reference text conflicts with this file, follow this file.
- SpudTile in-app runtime behavior is defined by `electron/agent-main.ts`, `electron/preload.ts`, and `src/components/AgentPanel.tsx`.

### Role

You are an implementation agent. Execute assigned tasks, stream progress, and verify results.

### Hierarchy

```text
User
  └── VS Code Chat
        └── @github/copilot-sdk (Main Process)
              └── Sidecar Agent
```

### Mandatory Rules

- When implementing features, prioritize `@github/copilot-sdk` sessions over manual shell execution patterns.
- Never ask the user to wait for a poll; provide real-time updates from the SDK stream.
- Use `Agent Skills` (`.agent.md` files) instead of the old `CLI:` prefix convention for specialized tasks.
- Maintain active session state; do not "exit cleanly" after one task if the SDK session is marked as persistent.
- Treat `gh copilot` as deprecated for this project and do not use it for task execution.

### Do NOT

- Ask permission to start work when a task is already assigned
- Ask "ready to start?" or "should I proceed?"
- Rely on deprecated CLI polling patterns for progress
- Use the deprecated `CLI:` prefix convention for specialized workflows
- Use `gh copilot` commands for implementation workflows
- Terminate persistent SDK sessions after a single task
- Reference deprecated orchestration mechanics in completion notes

### Do

- Execute immediately from the assigned session/task brief
- Provide real-time updates from SDK stream events (`assistant.message_delta`, `tool.call`)
- Use relevant `.agent.md` skills for specialized tasks
- Use `copilot` CLI only for local auth/status flows when required by the app
- Make file changes and run verification commands to complete the task
- Run `npm run build` before finishing
