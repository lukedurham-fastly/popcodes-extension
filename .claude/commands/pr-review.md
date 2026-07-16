---
description: Review the current PR against project conventions
allowed-tools: Bash(gh pr view:), Bash(gh pr diff:), Bash(gh pr list:), Bash(gh pr comment:), Bash(gh search:), Bash(gh api:), Bash(jq:*)
---

## Context

- Current branch: !`git branch --show-current`
- PR details: !`gh pr view --json number,title,body,baseRefName,headRefName`
- PR diff: !`gh pr diff`
- Changed files: !`gh pr diff --name-only`

## Task

Review this PR against the conventions in CLAUDE.md. Check for violations in:

1. **Correctness** — logic errors, off-by-one, unhandled edge cases, incorrect conditionals
2. **Type safety** — missing types, unsafe casts, improper `any` usage
3. **Duplication & abstraction** — repeated logic that should be extracted into a shared function or service; inline values that should be constants; copy-pasted blocks that diverge only in one variable
4. **Test coverage** — new logic paths, branches, or public functions with no corresponding test; existing tests that no longer cover the changed behaviour
5. **Security** — unguarded inputs, secrets in code, missing auth checks, NoSQL/Mongoose query injection vectors
6. **Naming & readability** — misleading names, unexplained magic numbers, non-obvious exports with no inline explanation
7. **Unnecessary complexity** — deeply nested conditionals that could be flattened with early returns; functions or services that do more than one thing and should be split; over-engineered abstractions (extra layers, generics, or wrappers) that add indirection without benefit; multi-step data transforms that could be a single expression
8. **Documentation consistency** — check whether changes to public API surface, configuration, project structure, or setup steps require updates to `README.md`, `QUICKSTART.md`, `START_HERE.md`, or any file under `docs/`; flag any doc that now contradicts the diff

Post inline comments on specific diff lines. Mark each finding as **[AI: BLOCKER]** (must fix before merge) or **[AI: SUGGESTION]** (style/improvement). Do not comment on unchanged lines unless important. Do not invent issues. 
## Rules

- Only comment on lines present in the diff. Do not comment on unrelated code.
- Post one inline comment per distinct issue using `gh api` to call the GitHub pull request review comments endpoint (`POST /repos/{owner}/{repo}/pulls/{pull_number}/comments`). Use `gh pr view --json number,headRefOid,baseRepository` to get the PR number, head commit SHA, and repo details needed for the API call. Always construct the request body with `jq -n` and pipe it via `--input -` to avoid shell escaping issues with backticks and special characters in comment bodies. Example:
  ```
  jq -n --arg body "$(cat <<'BODY'
  your comment here
  BODY
  )" --arg commit_id "$SHA" --arg path "$FILE" --argjson line 42 \
    '{body: $body, commit_id: $commit_id, path: $path, line: $line, side: "RIGHT"}' \
  | gh api repos/{owner}/{repo}/pulls/{number}/comments --input -
  ```
- For small fixes (< 6 lines), include a concrete suggestion block.
- For larger or structural issues, describe the problem and the fix without a suggestion block.
- If no issues are found, post a single PR comment: "No issues found." and stop.
- Do not post a summary comment if inline comments were posted.
- Do not make exploratory tool calls. Only call a tool when required to complete the task.