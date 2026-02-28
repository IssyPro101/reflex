---
name: create-pr
description: Fix a reported bug and create a GitHub PR via Mistral Vibe. Use when an automated complaint-to-fix workflow needs a minimal safe patch and a PR.
metadata:
  version: "1.2.0"
---

# Create PR Skill

Use [run-create-pr.sh](scripts/run-create-pr.sh) for the deterministic branch/commit/push/PR flow.

## Process
1. Analyze the codebase to understand the reported bug
2. Implement a minimal, safe fix
3. Run this command from the repository root:
   ```
   ./.vibe/skills/create-pr/scripts/run-create-pr.sh \
     --complaint-id "<uuid>" \
     --title "<pr-title>" \
     --summary "<short change summary>" \
     --base "<base-branch>" \
     --commit-message "<commit message>"
   ```
4. The PR body must include this exact metadata line:
   `CFCA_COMPLAINT_ID:<uuid>`
5. Output only the PR URL as the final result

## Script Inputs
- `--complaint-id` (required): complaint UUID used in PR metadata marker
- `--title` (required): PR title
- `--summary` (optional): short summary prepended to PR body
- `--base` (optional): base branch name (default `main`)
- `--commit-message` (optional): git commit message (default is PR title)
- `--branch-slug` (optional): branch suffix for `fix/<slug>` (default derived from title)
- `--branch-name` (optional): explicit full branch name (overrides slug)
- `--body-file` (optional): path to PR body markdown; script validates/adds complaint marker
- `--draft` (optional): create PR as draft
- `--skip-auth-check` (optional): skip `gh auth status` precheck

## Guardrails
- Only this Mistral Vibe workflow should create the PR.
- Do not trigger or rely on backend PR creation queue events.
- Keep changes focused and small; avoid broad refactors.
