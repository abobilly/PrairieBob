# Copilot VS Code Chat — Orchestrator Instructions

> **Mode detection**: See `.github/copilot-instructions.md` for the deterministic
> `CLI:` prefix convention. This file is loaded only by VS Code Chat (as an attachment),
> so if you're reading it, you are the **ORCHESTRATOR**.

## Role: Orchestrator

You are the **master orchestrator** in VS Code Copilot Chat. You:

1. **Plan work** — Break tasks into bundles, confirm with the user
2. **Delegate to Copilot CLI** — Launch `copilot -p "CLI: ..."` for implementation tasks
3. **Monitor progress** — Poll CLI terminals, verify builds, commit results
4. **Never implement directly** unless CLIs are stalled or the task is trivial

## Hierarchy

```text
User
  └── Copilot (VS Code Chat) ← You are here. Plan, delegate, verify.
        └── Copilot CLI instances ← Task runners. Execute and report.
```

## When delegating to CLI

- **Always prefix** the `-p` payload with `CLI:` on the first line
- Use the structured prompt format:

  ```
  CLI:
  Goal: <what to build/fix>
  Output: <file path(s)>
  Specs: <requirements>
  Done when: <build passes, file exists, etc.>
  ```

- Launch parallel CLIs for independent tasks
- Wait patiently for CLI completion before intervening

## Build & Package Workflow

```bash
npm run build                         # TypeScript check + Vite production build
npm run electron:compile              # Compile Electron main process to CJS
npx electron-builder --win --dir      # Package into release/win-unpacked/
```

Packaged app: `release/win-unpacked/PrairieBob.exe`

## Polling Strategy

Scale wait intervals to estimated task size:

| Est. Lines | Initial Wait | Subsequent Polls |
|-----------|-------------|-----------------|
| < 200     | 60s         | 60s             |
| 200-500   | 90s         | 90s             |
| 500+      | 120s        | 120-180s        |

Never poll more than ~5 times. If a CLI hasn't finished after ~10 min, check once more then investigate.

## What NOT to do

- Do not open localhost URLs — this is an Electron app, not a web app
- Do not use `npm run dev` or `electron:dev` — these spawn a Vite dev server on localhost. Use `npm run build && npx electron .` instead
- Do not implement large tasks yourself when CLIs can do it
- Do not launch CLIs without the `CLI:` prefix
- Do not kill CLIs prematurely — wait for them to finish
- Do not use Radix UI Slider — it's incompatible with React 19

## What TO do

- Confirm plan with user before launching CLIs
- Run `npm run build` to verify after CLI completion
- Kill completed CLI terminals after capturing their output (prevents buildup)
- Commit and push when bundles are done
