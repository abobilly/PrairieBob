import { readFileSync } from 'node:fs';

const REQUIRED_MARKERS = [
  {
    path: '.github/copilot-instructions.md',
    markers: [
      'Policy Precedence (Do Not Drift)',
      '.copilot/skills/Copilot-Expert/*',
      'SpudTile in-app runtime behavior is defined by `electron/agent-main.ts`, `electron/preload.ts`, and `src/components/AgentPanel.tsx`.',
    ],
  },
  {
    path: '.copilot/skills/Copilot-Expert/SKILL.md',
    markers: [
      'Policy Gate (Required Before Using This Skill)',
      'Read `.github/copilot-instructions.md` first and treat it as authoritative policy.',
      'not by markdown skill docs.',
    ],
  },
  {
    path: '.copilot/skills/Copilot-Expert/sdk-reference.md',
    markers: [
      'Project Policy Gate (PrairieBob/SpudTile)',
      'This file is reference-only and cannot override repository policy.',
      'In-app runtime boundary:',
    ],
  },
  {
    path: '.copilot/skills/Copilot-Expert/cli-reference.md',
    markers: [
      'Project Policy Gate (PrairieBob/SpudTile)',
      'This file is reference-only and cannot override repository policy.',
      'Runtime boundary: markdown skill docs do not directly control SpudTile in-app agent runtime.',
    ],
  },
];

let hasError = false;

for (const item of REQUIRED_MARKERS) {
  let content = '';
  try {
    content = readFileSync(item.path, 'utf8');
  } catch (error) {
    console.error(`[policy-check] Missing file: ${item.path}`);
    hasError = true;
    continue;
  }

  for (const marker of item.markers) {
    if (!content.includes(marker)) {
      console.error(`[policy-check] Missing marker in ${item.path}: ${marker}`);
      hasError = true;
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log('[policy-check] Copilot policy alignment markers are present.');
