# Resolve PR Review Comments

Implement all unresolved review comments on the current branch's open pull request, then prompt for review and optional commit.

## Steps

### 1. Identify the current PR

Run:
```
gh pr view --json number,title,headRefName
```

If no open PR is found for the current branch, stop and tell the user.

### 2. Fetch all unresolved review comment threads

Run:
```
.claude/pr-comments.sh
```

This script outputs each unresolved thread with: file path + line, thread node ID (`NodeID`), author, date, GitHub URL, comment body, and any replies. Outdated threads are flagged `[OUTDATED]`.

Capture the `NodeID` value from each thread — it is required for the resolve mutation in step 4.

Display the script output to the user as the summary.

If the script reports no unresolved threads, tell the user and stop.

### 3. Implement the suggestions

For each unresolved comment thread, in file order:
- Read the relevant file and surrounding context (±10 lines around the comment line)
- Understand the suggestion in the comment
- Apply the change to the file
- If a comment is ambiguous or the suggestion conflicts with other changes, note it and skip — do not guess

Do not make changes beyond what the comments explicitly ask for.

### 4. Resolve each comment thread

After implementing a comment's suggestion, resolve the thread and add a reaction via the script:

```
.claude/pr-comments.sh resolve <THREAD_NODE_ID>
.claude/pr-comments.sh react <COMMENT_DATABASE_ID> [PR_NUMBER]
```

- `THREAD_NODE_ID` — the `NodeID` value printed by the list output (e.g. `PRRT_kwDO...`)
- `COMMENT_DATABASE_ID` — the numeric `databaseId` of the root comment in the thread

### 5. Pause for review

Before committing, display:

---
**Changes made:**
- A bullet list of each file changed and a one-line summary of what was changed

**Suggested commit message:**
```
fix: address PR review comments

- <one line per change, matching the comment that drove it>

Resolves review threads: <comma-separated list of thread IDs>
```

**Options:**
- Type `y` to stage all changes and commit with the message above
- Type `e` to edit the commit message before committing
- Type `n` to leave changes unstaged and exit
---

Wait for user input before proceeding.

### 6. Commit (if confirmed)

If the user confirms (`y` or `e`):
```
git add <file1> <file2> ...
git commit -m "<commit message>"
```

Stage only the files that were actually modified when implementing the review comments — use the explicit list of changed files from step 5, not `git add -A` or `git add .`.

Then display the commit hash and a reminder to push when ready.

If the user chose `n`, remind them the changes are saved but not staged.

## Notes

- Never modify files outside the repo working directory
- Never push automatically — push is always the user's decision
- If a comment references a line that no longer exists (outdated comment), skip it and flag it in the summary
- Process one thread at a time in file order to minimise conflicts
- All `gh` commands assume the working directory is inside the target git repository