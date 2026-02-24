---
name: git-sync-on-change
description: Manages Git synchronization for code changes. Pulls the latest version from the remote repository, commits and pushes when a new function is added, then verifies the push was successful by pulling again and confirming the change exists. Use when the user says "sync to git", "push function to git", "pull latest", "git sync", "push after adding function", or "verify my push".
---

# Git Sync On Change

## When to Use This Skill
- User adds a new function and wants it pushed to Git
- User asks to pull the latest version before starting work
- User wants to verify a push was successful
- User says "sync", "push to git", "git pull then push", or similar

## Workflow Checklist

```
[ ] 1. PULL  — Fetch latest from remote (pre-work baseline)
[ ] 2. VERIFY CLEAN — Check git status before making changes
[ ] 3. ADD FUNCTION — User or agent adds the new function to source file
[ ] 4. STAGE & COMMIT — Stage changed files and commit with a descriptive message
[ ] 5. PUSH — Push to remote branch
[ ] 6. VERIFY PUSH — Pull again and confirm the function exists in the pulled code
```

## Instructions

### Step 1 — Pull Latest

Always start by pulling to avoid merge conflicts.

```bash
git -C <repo_path> pull origin <branch>
```

- Default branch: `main`. Check with `git branch --show-current` if unsure.
- If pull fails due to diverged branches, run:
  ```bash
  git -C <repo_path> pull --rebase origin <branch>
  ```

---

### Step 2 — Verify Clean State

```bash
git -C <repo_path> status
```

- If there are **uncommitted local changes**, ask the user whether to stash or commit them before pulling.
- Stash safely:
  ```bash
  git -C <repo_path> stash push -m "auto-stash before pull"
  ```

---

### Step 3 — Add the Function

Make the code changes (new function). This step is done by you or the user directly in the source files.

---

### Step 4 — Stage and Commit

```bash
git -C <repo_path> add <changed_file_or_dot>
git -C <repo_path> commit -m "feat: add <function_name> function"
```

**Commit message rules:**
- Prefix: `feat:` for new functions, `fix:` for bug fixes, `refactor:` for refactors
- Keep it under 72 characters
- Include the function name if possible

---

### Step 5 — Push

```bash
git -C <repo_path> push origin <branch>
```

If push is rejected (remote has new commits):
```bash
git -C <repo_path> pull --rebase origin <branch>
git -C <repo_path> push origin <branch>
```

---

### Step 6 — Verify Push (Pull Back & Confirm)

Run the verify script to confirm the function now exists in the remote-tracked state:

```bash
node .agent/skills/git-sync-on-change/scripts/verify-push.js <repo_path> <function_name>
```

If the script is unavailable, do this manually:
```bash
git -C <repo_path> fetch origin
git -C <repo_path> show origin/<branch>:<file_path> | grep "<function_name>"
```

A successful result prints the matching line. If grep returns nothing, the push failed — retry Step 5.

---

## Error Handling

| Error | Fix |
|-------|-----|
| `! [rejected]` on push | Run `git pull --rebase origin <branch>` then push again |
| `CONFLICT` on pull | Resolve conflicts manually, then `git add .` and `git rebase --continue` |
| `Permission denied (publickey)` | Check SSH key with `ssh -T git@github.com` |
| Detached HEAD | Run `git checkout <branch>` before any commits |
| Nothing to commit | The file was not saved — verify the file was written before staging |

---

## Resources
- [verify-push.js](scripts/verify-push.js) — Confirms function presence in remote after push
