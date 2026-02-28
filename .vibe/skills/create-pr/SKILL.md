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
