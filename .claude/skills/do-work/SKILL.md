---
name: do-work
description: Execute a unit of work in this repository by planning, implementing, then validating with type checks and tests. Use when asked to implement a feature, fix a bug, refactor code, or complete any development task in this project.
---

# Do Work

Execute a discrete unit of work: plan → implement → validate → commit.

## Workflow

### 1. Plan (optional)

Before writing any code:

- Read relevant existing files to understand the context
- Identify all files that need to be created or modified
- Note any conventions from CLAUDE.md that apply
- State your approach in 2–5 bullet points and confirm with the user if the scope is non-trivial

### 2. Implement

Follow project conventions:

- Use object parameters for functions with 2+ args (see CLAUDE.md)
- Services (`*Service.ts`) require a companion `.test.ts` file
- Prefer editing existing files over creating new ones
- Do not add comments, docstrings, or types to code you didn't change

### 3. Validate

Run the feedback loops in order and fix all errors before declaring done:

```bash
pnpm typecheck
pnpm test
```

- Fix every type error and failing test before moving on
- If a fix introduces new failures, resolve those too
- Do not skip or suppress errors — investigate and resolve them

### 4. Commit

Stage and commit only the files changed as part of this unit of work:

```bash
git add <specific files>
git commit -m "<message>"
```

- Write a concise commit message that describes *why*, not just *what*
- Stage files explicitly — do not use `git add -A` or `git add .`
- Do not commit unrelated files, env files, or secrets

## Done criteria

- `pnpm typecheck` exits 0
- `pnpm test` exits 0
- No unrelated files modified
- Changes committed to git
