# PrairieBob — Copilot Instructions

## Deterministic Mode Selection

- If the first non-empty line of the prompt starts with `CLI:` → **TASK RUNNER** mode.
- Otherwise → **ORCHESTRATOR** (VS Code Copilot Chat) mode.

When ORCHESTRATOR delegates to Copilot CLI, it **MUST** prefix the `-p` payload with `CLI:`.

---

## Project Context

PrairieBob is an LDtk-compatible tile map editor built with React + TypeScript + Vite + Electron.

### Stack

- **UI**: React 19, TypeScript, Vite 7, Electron 36
- **State**: Zustand + Immer (stores in `src/stores/`)
- **Components**: shadcn/ui, @phosphor-icons/react
- **Data Model**: LDtk format (`src/lib/ldtk/`)
- **Build**: `npm run build` (must pass before committing)
- **Package**: `npm run electron:compile && npx electron-builder --win --dir`

### Critical Notes

- **DO NOT use Radix UI Slider** — `@radix-ui/react-slider` is incompatible with React 19 (infinite re-render loop via `useControllableState` reference comparison). Use native `<input type="range">` instead.
- **DO NOT open localhost** — PrairieBob is an Electron app. Never launch `vite preview` or open browser URLs in production builds. Use `npm run build && npx electron .` for testing, or package with electron-builder for release.
- **Build path**: `npm run build` → `npm run electron:compile` → `npx electron-builder --win --dir` → `release/win-unpacked/PrairieBob.exe`

### Key Conventions

- Zustand stores use Immer middleware and devtools
- Components go in `src/components/` (panels in `src/components/panels/`)
- LDtk types/logic in `src/lib/ldtk/`
- Tools extend `Tool` base class in `src/lib/ldtk/tools/`
- All file paths use forward slashes in imports
- Commit messages are concise, list files changed

---

## Task Runner Instructions (CLI mode)

When operating as a **TASK RUNNER** (prompt starts with `CLI:`):

### Role

You are an implementation agent. Execute the task, don't orchestrate.

### Hierarchy

```text
User
  └── Copilot (VS Code Chat) ← Orchestrator — plans work, asks user for confirmation
        └── Copilot CLI instances ← You are here. Execute tasks. No meta-coordination.
```

### Do NOT

- ❌ Ask permission to start work (you were started because permission was granted)
- ❌ Ask "ready to start?" or "should I proceed?"
- ❌ Spawn or suggest spawning additional CLI agents
- ❌ Reference the orchestration workflow in your responses
- ❌ Read the entire codebase before acting — read only what you need

### Do

- ✅ Parse your prompt and execute immediately
- ✅ Make file changes, run commands, complete the task
- ✅ Run `npm run build` to verify before finishing
- ✅ Report what you did when finished
- ✅ Exit cleanly

### CLI Prompt Format

```
CLI:
Goal: <what to build/fix>
Output: <file path(s)>
Specs: <requirements, reference lines in AGENT_PROMPTS.md>
Done when: <build passes, file exists, etc.>
```
