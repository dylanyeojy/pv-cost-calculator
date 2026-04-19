---
description: Core coding discipline rules that apply across the entire codebase
---

- Do not add features, UI sections, or configuration that were not explicitly asked for.
- Do not refactor surrounding code when fixing a bug — make the minimal targeted change.
- Do not add comments, docstrings, or type annotations to code you did not change.
- Do not add error handling for scenarios that cannot happen within this app's controlled environment (authenticated internal users, validated form inputs).
- Do not use `alert()`, `confirm()`, or `console.log()` in shipped code.
- Prefer editing an existing file over creating a new one.
- When removing code, delete it completely. Do not leave commented-out blocks behind.
- When in doubt about scope, do less and ask — a missed feature is easy to add, an unwanted one is noise.
