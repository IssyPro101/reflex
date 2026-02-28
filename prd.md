---

# 📄 Customer Feedback → Code Agent (CFCA)

**Version:** MVP (Hackathon)
**Owner:** Builder
**Status:** Build Ready
**Last Updated:** Feb 2026

---

# 1. Overview

## Problem

Customer feedback inside community channels is difficult to convert into engineering action.

Common issues:

* Bugs disappear in chat history
* Manual triage slows development
* Users never learn when issues are fixed
* Developers lack structured feedback intake

---

## Solution

An AI agent system that:

1. Monitors Discord messages.
2. Detects complaints or feature requests.
3. Uses **Mistral Vibe** to generate code changes.
4. Automatically creates GitHub Pull Requests.
5. Notifies the developer via Telegram.
6. Replies back to the original user when fixed.

👉 The system closes the **customer → code → shipped → feedback loop**.

---

# 2. Goals

## Primary Hackathon Goals

* ✅ Detect actionable complaints from Discord
* ✅ Auto-acknowledge user feedback
* ✅ Generate GitHub PR automatically
* ✅ Notify developer via Telegram
* ✅ Follow up after PR merge

## Secondary Goals

* Traceability (Message → PR)
* Sentiment classification
* Demo-ready automation loop

---

# 3. Non-Goals (MVP)

* Multi-channel ingestion
* Autonomous PR merging
* Enterprise permissions
* Production-grade security
* Perfect code generation

---

# 4. Users

## Primary User — Developer

Wants:

* Bugs turned into PRs automatically
* Fast notification for review

## Secondary User — Community Member

Wants:

* Acknowledgment of feedback
* Visibility into fixes
* Follow-up communication

---

# 5. Supported Integrations (MVP)

| System               | Purpose                |
| -------------------- | ---------------------- |
| Discord              | Customer input                  |
| Mistral API          | Intent + reasoning              |
| **Mistral Vibe CLI** | Coding agent + PR creation      |
| GitHub               | PR lifecycle (webhooks)         |
| Telegram             | Developer notification          |
| Supabase             | Database                        |
| Redis + BullMQ       | Job orchestration               |
| gh CLI               | PR creation (via Vibe bash tool)|

---

# 6. High-Level Architecture

```
Discord
   ↓
Discord Bot (discord.js)
   ↓
Ingestion API (Node.js)
   ↓
BullMQ Queue (Redis)
   ↓
AI Triage (Mistral)
   ↓
├── Reply Agent
├── Vibe Coding Agent
└── Notification Agent
        ↓
     GitHub PR
        ↓
 GitHub Webhook
        ↓
 Follow-Up Agent
        ↓
Discord Reply
```

---

# 7. Tech Stack

## Backend

* Node.js (TypeScript)
* NestJS (preferred) or Express

## Queue

* BullMQ
* Redis

## Database

* Supabase Postgres

## AI

* Mistral API

  * intent classification
  * summarization

## Coding Agent

* **Mistral Vibe CLI**

  * programmatic mode
  * repo-aware edits

## Integrations

* discord.js
* gh CLI (GitHub CLI — used by Vibe's bash tool for PR creation)
* Telegram Bot API

## Deploy

* Railway / Render → backend + workers
* Supabase → DB

---

# 8. Core System Components

---

## 8.1 Discord Listener

Responsibilities:

* Listen to `messageCreate`
* Normalize message payload
* Store raw messages

Example schema:

```json
{
  "platform": "discord",
  "message_id": "...",
  "user_id": "...",
  "text": "Export button crashes",
  "timestamp": "..."
}
```

---

## 8.2 Intent Detection (Mistral)

Classifies messages:

| Intent          | Action    |
| --------------- | --------- |
| bug_report      | Create PR |
| feature_request | Create PR |
| question        | Ignore    |
| spam            | Ignore    |
| harmful         | Block     |

Output example:

```json
{
  "intent": "bug_report",
  "confidence": 0.92,
  "severity": "high",
  "summary": "Export crashes on iOS"
}
```

---

## 8.3 Auto Reply Agent

Immediately replies:

> Thanks! I've flagged this to the team and we're looking into it ✅

Requirements:

* Reply in same thread
* <5 second latency
* Store reply message ID

---

## 8.4 AI Coding Agent — Mistral Vibe + Skill

### Overview

Code generation **and PR creation** are performed using **Mistral Vibe**, an open-source CLI coding assistant that operates directly on the repository.

Instead of generating raw diffs and orchestrating git/GitHub operations in the worker, the system runs Vibe in **programmatic mode** with a **custom `create-pr` skill** that handles the entire flow — from code fix to published Pull Request.

Vibe provides:

* Project-aware context scanning
* File editing tools
* Git-aware workflows via bash tool
* PR creation via `gh` CLI (bash tool)
* Skills system for reusable workflows
* Built-in safety tooling via tool config

---

### Vibe Skill: `create-pr`

A reusable skill that encapsulates the fix → commit → push → PR workflow.

```markdown
<!-- .vibe/skills/create-pr/SKILL.md -->
---
name: create-pr
description: Fix a bug and create a GitHub PR with the changes
version: 1.0.0
---

# Create PR Skill

## Process
1. Analyze the codebase to understand the reported bug
2. Implement a minimal, safe fix
3. Validate that no secrets, .env, or deployment files are modified
4. Create a feature branch: fix/<short-slug>
5. Commit changes with a descriptive message
6. Push the branch to origin
7. Create a PR using gh pr create with a structured body
8. Output the PR URL as the final result
```

---

### Agent Profile: `pr-agent`

A dedicated agent profile configures tool permissions for autonomous PR creation.

```toml
# .vibe/agents/pr-agent.toml
active_model = "devstral-2"

instructions = """
You are an automated bug-fix agent. Create minimal, safe fixes.
Never modify .env, secrets, config credentials, or CI/CD workflows.
Always create a branch, commit, push, and open a PR.
"""

[tools.bash]
permission = "always"
allowlist = ["git *", "gh pr create *", "gh auth status"]
denylist = ["rm -rf", "sudo", "passwd", "mkfs"]

[tools.write_file]
permission = "always"

[tools.search_replace]
permission = "always"

[tools.read_file]
permission = "always"

[tools.grep]
permission = "always"
```

---

### Execution Flow

Worker job: `create_pr`

1. Create temporary workspace.
2. Shallow clone repository:

```
git clone --depth=1 <repo>
```

3. Run Vibe with the `pr-agent` profile:

```
vibe \
  --workdir ./repo \
  --agent pr-agent \
  --prompt "<generated task>" \
  --max-turns 12 \
  --max-price 0.50 \
  --output json
```

4. Vibe (via the `create-pr` skill):

   * scans the codebase for context
   * edits files to fix the bug
   * creates a feature branch
   * commits changes
   * pushes to origin
   * creates PR via `gh pr create`
   * returns PR URL in JSON output

5. Worker performs a lightweight post-check:

   * verifies PR was created (checks JSON output for PR URL)
   * runs `git diff --name-only` to confirm no forbidden files were touched
   * stores PR link in database

---

### Prompt Template

```
Fix the following bug:

{summary}

User report:
{original_message}

Constraints:
- minimal safe fix
- do not modify .env, secrets, or config credentials
- do not modify CI/CD or deployment workflows
- keep changes small and focused
- add a test if trivial to do so

After fixing, create a PR with a clear title and description
that references the original user report.
```

---

### Safety Guardrails

#### Layer 1 — Vibe Tool Config (preventive)

The `pr-agent.toml` profile restricts what Vibe can do:

* `bash.denylist` blocks destructive commands
* `bash.allowlist` limits to git and gh operations
* `write_file` permission scoped to repo workspace
* Instructions explicitly forbid touching secrets/configs

#### Layer 2 — Worker Post-Check (detective)

After Vibe completes, the worker validates:

* PR URL exists in Vibe's JSON output
* `git diff --name-only` against main contains no forbidden paths:
  * `.env*`
  * `*secret*`, `*credential*`
  * `.github/workflows/*`
  * `docker-compose*.yml`
* If any forbidden file is found → close the PR, mark `needs_manual`

#### Soft Warnings

Flag but allow:

* auth modules
* migrations
* dependency updates

---

### Vibe Controls

Recommended runtime constraints:

* Trusted repo folder only
* Agent profile with restricted tool permissions
* Bounded turns (`--max-turns 12`)
* Cost cap (`--max-price 0.50`)
* JSON output for programmatic parsing

---

### Failure Handling

If Vibe fails (non-zero exit, no PR URL, or post-check fails):

* Mark complaint `needs_manual`
* Notify developer via Telegram with failure context
* Do NOT claim fix to user

---

## 8.5 GitHub Integration

PR creation is handled by Vibe's `create-pr` skill (see 8.4). The backend only needs to handle **incoming webhooks** for post-PR events.

Events handled:

| Event      | Action                 |
| ---------- | ---------------------- |
| PR Merged  | Trigger user follow-up |

Webhook endpoint:

```
POST /webhooks/github
```

Note: PR creation notifications to Telegram are triggered by the worker after Vibe returns the PR URL — no GitHub webhook needed for that.

---

## 8.6 Telegram Notifications

Message example:

```
🚨 New PR Created

Fix: Export crash
Source: Discord
User: alex
PR: github.com/.../pull/142
```

---

# 9. Data Model (Minimal)

## messages

| field        | type   |
| ------------ | ------ |
| id           | uuid   |
| message_text | text   |
| user_id      | string |
| status       | enum   |

---

## complaints

| field      | type   |
| ---------- | ------ |
| id         | uuid   |
| message_id | uuid   |
| intent     | string |
| severity   | string |
| pr_id      | uuid   |

---

## prs

| field     | type               |
| --------- | ------------------ |
| id        | uuid               |
| pr_number | int                |
| status    | enum(open, merged) |

---

# 10. Example User Flow (End-to-End)

---

## Step 1 — User Complaint (Discord)

User posts:

> "Export button crashes on iOS."

discord.js receives event → API:

```
POST /ingest/discord
```

Message stored in Supabase.

BullMQ job queued: `classify_intent`.

---

## Step 2 — AI Triage

Worker calls Mistral.

Result:

```
intent: bug_report
severity: high
```

Jobs queued:

* `reply_ack`
* `create_pr`

---

## Step 3 — Instant Acknowledgment

Bot replies:

> Thanks! I've flagged this to the team and we're looking into it ✅

---

## Step 4 — Vibe Generates Fix + Creates PR

Worker:

1. clones repo
2. runs Vibe with `pr-agent` profile and `create-pr` skill:

```
vibe --agent pr-agent --prompt "Fix export crash..." --max-turns 12 --output json
```

Vibe (end-to-end):

* scans project for context
* edits files to fix the bug
* creates branch `fix/export-crash`
* commits and pushes
* creates PR via `gh pr create`
* returns PR URL in JSON output

Worker post-check:

* verifies PR URL in output
* confirms no forbidden files in diff
* links complaint → PR in database

---

## Step 6 — Telegram Notification

Developer receives:

```
🚨 PR #142 Created
Fix export crash
Source: Discord
```

---

## Step 7 — Developer Merges PR

GitHub webhook fires:

```
pull_request.closed (merged=true)
```

Backend queues follow-up.

---

## Step 8 — User Follow-Up

Bot replies:

> ✅ This issue has been fixed and merged!
> Thanks for helping improve the product.

Complaint marked resolved.

---

# 11. Success Metrics

| Metric                | Target      |
| --------------------- | ----------- |
| Complaint → PR        | < 2 minutes |
| Reply latency         | < 5 sec     |
| Demo reliability      | 100%        |
| PR generation success | ≥70%        |

---

# 12. MVP Build Order

### Phase 1 (Must Ship)

* Discord bot
* Intent classification
* Auto reply
* Vibe PR generation
* Telegram notification
* Merge follow-up

### Phase 2 (If Time)

* Dashboard
* Sentiment graphs
* Risk scoring

---

# 13. Demo Script

1. Send Discord complaint.
2. Bot replies instantly.
3. PR appears in GitHub.
4. Telegram alert arrives.
5. Merge PR live.
6. Bot confirms fix.

👉 Demonstrates full autonomous feedback loop.

---

# 14. One-Line Pitch

> **An AI agent that turns customer complaints into shipped code automatically.**

---