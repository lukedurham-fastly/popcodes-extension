#!/usr/bin/env bash
# Manages GitHub PR review threads for the current branch's open PR.
#
# Usage:
#   .claude/pr-comments.sh [PR_NUMBER]
#       List unresolved review threads (default).
#
#   .claude/pr-comments.sh resolve <THREAD_NODE_ID>
#       Resolve a review thread by its GraphQL node ID (e.g. PRRT_kwDO...).
#
#   .claude/pr-comments.sh react <COMMENT_DATABASE_ID> [PR_NUMBER]
#       Add a +1 reaction to a review comment by its numeric database ID.

set -euo pipefail

# ── Shared: resolve owner/repo ──────────────────────────────────────────────
REPO_INFO=$(gh repo view --json owner,name)
OWNER=$(echo "$REPO_INFO" | jq -r '.owner.login')
REPO=$(echo "$REPO_INFO"  | jq -r '.name')

# ── Helper: resolve PR number from current branch ───────────────────────────
resolve_pr_number() {
  local hint="${1:-}"
  if [[ -n "$hint" ]]; then
    echo "$hint"
  else
    local pr_json
    pr_json=$(gh pr view --json number 2>/dev/null) || {
      echo "Error: no open PR for the current branch. Pass a PR number as an argument." >&2
      exit 1
    }
    echo "$pr_json" | jq -r '.number'
  fi
}

# ── Subcommand dispatch ─────────────────────────────────────────────────────
FIRST_ARG="${1:-}"

case "$FIRST_ARG" in

  resolve)
    THREAD_NODE_ID="${2:-}"
    if [[ -z "$THREAD_NODE_ID" ]]; then
      echo "Usage: $0 resolve <THREAD_NODE_ID>" >&2
      exit 1
    fi
    RESULT=$(gh api graphql -f query='
      mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { isResolved }
        }
      }
    ' -f threadId="$THREAD_NODE_ID")
    IS_RESOLVED=$(echo "$RESULT" | jq -r '.data.resolveReviewThread.thread.isResolved')
    if [[ "$IS_RESOLVED" == "true" ]]; then
      echo "Thread ${THREAD_NODE_ID} resolved."
    else
      echo "Failed to resolve thread ${THREAD_NODE_ID}." >&2
      echo "$RESULT" | jq . >&2
      exit 1
    fi
    ;;

  react)
    COMMENT_ID="${2:-}"
    if [[ -z "$COMMENT_ID" ]]; then
      echo "Usage: $0 react <COMMENT_DATABASE_ID> [PR_NUMBER]" >&2
      exit 1
    fi
    PR_NUMBER=$(resolve_pr_number "${3:-}")
    gh api "repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments/${COMMENT_ID}/reactions" \
      -X POST -f content='+1' > /dev/null
    echo "Added +1 reaction to comment ${COMMENT_ID} on PR #${PR_NUMBER}."
    ;;

  *)
    # Default: list unresolved threads.
    # FIRST_ARG is either a PR number or empty.
    PR_NUMBER=$(resolve_pr_number "$FIRST_ARG")

    PR_URL="https://github.com/${OWNER}/${REPO}/pull/${PR_NUMBER}"
    echo "=== Unresolved comments: ${PR_URL} ==="
    echo ""

    # GraphQL: fetch all review threads, up to 100, with up to 20 comments each
    RESULT=$(gh api graphql -f query='
    query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          title
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              isOutdated
              line
              originalLine
              diffSide
              path
              comments(first: 20) {
                nodes {
                  databaseId
                  author { login }
                  body
                  createdAt
                  url
                  replyTo { databaseId }
                }
              }
            }
          }
        }
      }
    }' -f owner="$OWNER" -f repo="$REPO" -F prNumber="$PR_NUMBER")

    UNRESOLVED=$(echo "$RESULT" | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)]')
    COUNT=$(echo "$UNRESOLVED" | jq 'length')

    if [[ "$COUNT" -eq 0 ]]; then
      echo "No unresolved review threads."
      exit 0
    fi

    echo "Found ${COUNT} unresolved thread(s)."
    echo ""

    echo "$UNRESOLVED" | jq -r '
      (length) as $total |
      to_entries[] |
      .key as $i |
      .value as $thread |
      ($i + 1 | tostring) as $n |
      ($thread.comments.nodes | map(select(.replyTo == null)) | first) as $root |
      ($thread.comments.nodes | map(select(.replyTo != null))) as $replies |

      "──────────────────────────────────────────────────────────",
      "Thread \($n) of \($total)",
      "File:    \($thread.path)\(if $thread.line then ":\($thread.line)" else "" end)\(if $thread.isOutdated then " [OUTDATED]" else "" end)",
      "NodeID:   \($thread.id)",
      "CommentID:\($root.databaseId)",
      "Author:   \($root.author.login)  (\($root.createdAt | split("T")[0]))",
      "URL:      \($root.url)",
      "",
      ($root.body | gsub("\\r"; "") | split("\n") | map("  " + .) | join("\n")),
      (if ($replies | length) > 0 then
        "",
        "  --- \($replies | length) repl\(if ($replies | length) == 1 then "y" else "ies" end) ---",
        ($replies[] |
          "  [#\(.databaseId) \(.author.login) \(.createdAt | split("T")[0])]: \(.body | gsub("\\r";"") | split("\n") | join(" "))"
        )
      else "" end),
      ""
    '
    ;;

esac