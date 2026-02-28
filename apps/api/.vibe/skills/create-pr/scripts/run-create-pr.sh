#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  run-create-pr.sh --complaint-id <uuid> --title <pr-title> [options]

Options:
  --summary <text>           Short summary for the PR body (default: PR title)
  --base <branch>            Base branch for PR (default: main)
  --commit-message <text>    Commit message (default: PR title)
  --branch-slug <slug>       Branch slug for fix/<slug> (default: derived from title)
  --branch-name <name>       Explicit branch name (overrides --branch-slug)
  --body-file <path>         Existing markdown body file to use for PR description
  --draft                    Create PR as draft
  --skip-auth-check          Skip GitHub authentication precheck
  --help                     Show this help

Behavior:
  1) Validates changed files against create-pr guardrails
  2) Creates/switches to feature branch
  3) Stages and commits changes
  4) Pushes branch to origin
  5) Creates GitHub PR with required CFCA_COMPLAINT_ID marker
  6) Prints only the PR URL to stdout
EOF
}

log() {
  printf '[create-pr] %s\n' "$*" >&2
}

fail() {
  printf '[create-pr] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

is_uuid() {
  local value="$1"
  [[ "$value" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]
}

slugify() {
  local input="$1"
  local slug
  slug="$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
  printf '%s' "$slug"
}

extract_pr_url() {
  local text="$1"
  printf '%s\n' "$text" | grep -Eo 'https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+' | head -n 1 || true
}

get_github_token() {
  local token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  [[ -n "$token" ]] || fail "GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN environment variable."
  printf '%s' "$token"
}

get_remote_owner_repo() {
  local remote_url
  remote_url="$(git remote get-url "$REMOTE_NAME" 2>/dev/null || true)"
  [[ -n "$remote_url" ]] || fail "Cannot determine remote URL for $REMOTE_NAME"

  local owner_repo
  owner_repo="$(printf '%s' "$remote_url" | sed -E 's/\.git$//; s#^https://[^/]*/##; s#^git@github\.com:##')"
  [[ "$owner_repo" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || fail "Cannot parse owner/repo from remote URL: $remote_url"
  printf '%s' "$owner_repo"
}

collect_changed_files() {
  {
    git diff --name-only
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } | sed '/^[[:space:]]*$/d' | sort -u
}

COMPLAINT_ID=""
PR_TITLE=""
PR_SUMMARY=""
BASE_BRANCH="main"
COMMIT_MESSAGE=""
BRANCH_SLUG=""
BRANCH_NAME=""
BODY_FILE=""
DRAFT=0
SKIP_AUTH_CHECK=0
REMOTE_NAME="origin"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --complaint-id)
      [[ $# -ge 2 ]] || fail "Missing value for --complaint-id"
      COMPLAINT_ID="$2"
      shift 2
      ;;
    --title)
      [[ $# -ge 2 ]] || fail "Missing value for --title"
      PR_TITLE="$2"
      shift 2
      ;;
    --summary)
      [[ $# -ge 2 ]] || fail "Missing value for --summary"
      PR_SUMMARY="$2"
      shift 2
      ;;
    --base)
      [[ $# -ge 2 ]] || fail "Missing value for --base"
      BASE_BRANCH="$2"
      shift 2
      ;;
    --commit-message)
      [[ $# -ge 2 ]] || fail "Missing value for --commit-message"
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    --branch-slug)
      [[ $# -ge 2 ]] || fail "Missing value for --branch-slug"
      BRANCH_SLUG="$2"
      shift 2
      ;;
    --branch-name)
      [[ $# -ge 2 ]] || fail "Missing value for --branch-name"
      BRANCH_NAME="$2"
      shift 2
      ;;
    --body-file)
      [[ $# -ge 2 ]] || fail "Missing value for --body-file"
      BODY_FILE="$2"
      shift 2
      ;;
    --draft)
      DRAFT=1
      shift
      ;;
    --skip-auth-check)
      SKIP_AUTH_CHECK=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$COMPLAINT_ID" ]] || fail "--complaint-id is required"
[[ -n "$PR_TITLE" ]] || fail "--title is required"
is_uuid "$COMPLAINT_ID" || fail "--complaint-id must be a valid lowercase UUID"

if [[ -z "$PR_SUMMARY" ]]; then
  PR_SUMMARY="$PR_TITLE"
fi

if [[ -z "$COMMIT_MESSAGE" ]]; then
  COMMIT_MESSAGE="$PR_TITLE"
fi

if [[ -n "$BODY_FILE" && ! -f "$BODY_FILE" ]]; then
  fail "--body-file does not exist: $BODY_FILE"
fi

if [[ -z "$BRANCH_NAME" ]]; then
  if [[ -n "$BRANCH_SLUG" ]]; then
    BRANCH_SLUG="$(slugify "$BRANCH_SLUG")"
  else
    BRANCH_SLUG="$(slugify "$PR_TITLE")"
  fi
  [[ -n "$BRANCH_SLUG" ]] || fail "Unable to derive branch slug from title"
  BRANCH_NAME="fix/$BRANCH_SLUG"
fi

[[ "$BRANCH_NAME" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "Invalid --branch-name: $BRANCH_NAME"
[[ "$BASE_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "Invalid --base: $BASE_BRANCH"

require_cmd git
require_cmd curl
require_cmd jq

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO_ROOT" ]] || fail "Not inside a git repository"
cd "$REPO_ROOT"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
[[ -n "$CURRENT_BRANCH" ]] || fail "Unable to determine current branch"
[[ "$CURRENT_BRANCH" != "HEAD" ]] || fail "Detached HEAD is not supported"

GITHUB_TOKEN_VAL="$(get_github_token)"

if [[ "$SKIP_AUTH_CHECK" -eq 0 ]]; then
  log "Checking GitHub authentication"
  auth_http_code="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $GITHUB_TOKEN_VAL" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/user)"
  [[ "$auth_http_code" == "200" ]] || fail "GitHub authentication failed (HTTP $auth_http_code). Check GH_TOKEN or GITHUB_TOKEN."
fi

changed_files=()
while IFS= read -r file_path; do
  changed_files+=("$file_path")
done < <(collect_changed_files)

if [[ "${#changed_files[@]}" -eq 0 ]]; then
  fail "No local changes found. Implement a fix before running this script."
fi

forbidden_files=()
warning_files=()

for file_path in "${changed_files[@]}"; do
  normalized="${file_path#./}"
  lower_path="$(printf '%s' "$normalized" | tr '[:upper:]' '[:lower:]')"
  base_name="$(basename "$lower_path")"

  if [[ "$normalized" =~ ^\.env(\..+)?$ ]]; then
    forbidden_files+=("$normalized")
  fi
  if [[ "$lower_path" == *secret* ]]; then
    forbidden_files+=("$normalized")
  fi
  if [[ "$lower_path" == *credential* ]]; then
    forbidden_files+=("$normalized")
  fi
  if [[ "$normalized" =~ ^\.github/workflows/ ]]; then
    forbidden_files+=("$normalized")
  fi
  if [[ "$base_name" =~ ^docker-compose.*\.ya?ml$ ]]; then
    forbidden_files+=("$normalized")
  fi

  if [[ "$lower_path" == *auth* ]]; then
    warning_files+=("$normalized")
  fi
  if [[ "$lower_path" == *migration* ]]; then
    warning_files+=("$normalized")
  fi
  if [[ "$base_name" == "package.json" || "$base_name" == "package-lock.json" || "$base_name" == "pnpm-lock.yaml" || "$base_name" == "yarn.lock" ]]; then
    warning_files+=("$normalized")
  fi
done

if [[ "${#forbidden_files[@]}" -gt 0 ]]; then
  log "Forbidden file changes detected:"
  printf '%s\n' "${forbidden_files[@]}" | sort -u | sed 's/^/  - /' >&2
  fail "Aborting PR creation due to guardrails."
fi

if [[ "${#warning_files[@]}" -gt 0 ]]; then
  log "Warning file changes detected (review carefully):"
  printf '%s\n' "${warning_files[@]}" | sort -u | sed 's/^/  - /' >&2
fi

if [[ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    fail "Local branch already exists: $BRANCH_NAME"
  fi

  log "Creating branch $BRANCH_NAME"
  if ! git switch -c "$BRANCH_NAME" >/dev/null 2>&1; then
    git checkout -b "$BRANCH_NAME" >/dev/null
  fi
fi

log "Staging changes"
git add -A

if git diff --cached --quiet; then
  fail "No staged changes after git add -A."
fi

log "Committing changes"
git commit -m "$COMMIT_MESSAGE" >/dev/null

log "Pushing branch to $REMOTE_NAME/$BRANCH_NAME"
git push -u "$REMOTE_NAME" "$BRANCH_NAME" >/dev/null

tmp_body_file="$(mktemp "${TMPDIR:-/tmp}/create-pr-body.XXXXXX.md")"
cleanup() {
  rm -f "$tmp_body_file"
}
trap cleanup EXIT

if [[ -n "$BODY_FILE" ]]; then
  cat "$BODY_FILE" >"$tmp_body_file"
else
  printf '%s\n' "$PR_SUMMARY" >"$tmp_body_file"
fi

required_marker="CFCA_COMPLAINT_ID:${COMPLAINT_ID}"

if grep -Eq '^CFCA_COMPLAINT_ID:' "$tmp_body_file"; then
  if ! grep -Fxq "$required_marker" "$tmp_body_file"; then
    fail "PR body contains CFCA_COMPLAINT_ID that does not match --complaint-id"
  fi
else
  printf '\n%s\n' "$required_marker" >>"$tmp_body_file"
fi

log "Creating GitHub PR"

OWNER_REPO="$(get_remote_owner_repo)"
pr_body="$(cat "$tmp_body_file")"
is_draft=$( [[ "$DRAFT" -eq 1 ]] && echo true || echo false )

pr_json="$(jq -n \
  --arg title "$PR_TITLE" \
  --arg head "$BRANCH_NAME" \
  --arg base "$BASE_BRANCH" \
  --arg body "$pr_body" \
  --argjson draft "$is_draft" \
  '{title: $title, head: $head, base: $base, body: $body, draft: $draft}')"

set +e
pr_create_output="$(curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN_VAL" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -d "$pr_json" \
  "https://api.github.com/repos/${OWNER_REPO}/pulls" 2>&1)"
curl_exit_code=$?
set -e

if [[ "$curl_exit_code" -ne 0 ]]; then
  fail "curl request failed (exit $curl_exit_code): $pr_create_output"
fi

pr_url="$(printf '%s' "$pr_create_output" | jq -r '.html_url // empty' 2>/dev/null || true)"

if [[ -z "$pr_url" ]]; then
  api_message="$(printf '%s' "$pr_create_output" | jq -r '.message // empty' 2>/dev/null || true)"
  if [[ -n "$api_message" ]]; then
    fail "GitHub API error: $api_message"
  fi
  fail "Could not find PR URL in API response: $(printf '%s' "$pr_create_output" | head -c 500)"
fi

printf '%s\n' "$pr_url"
