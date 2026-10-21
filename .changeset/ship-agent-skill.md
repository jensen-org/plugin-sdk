---
"@jensen-org/plugin-sdk": minor
---

Ship an agent skill that teaches Claude Code and other coding agents how to build Jensen plugins with this SDK. `jensen-plugin skill install [--target <agents|claude|all>] [--dir <path>] [--force]` copies it to `.agents/skills/jensen-plugin-sdk` and `.claude/skills/jensen-plugin-sdk`, and `jensen-plugin create` now installs it into new projects unless you pass `--no-skill`.
