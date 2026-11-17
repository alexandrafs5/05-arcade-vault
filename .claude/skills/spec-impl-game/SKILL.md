---
name: spec-impl-game
description: Implements an approved game spec (specs/NN-<id>-game.md) by following /spec-impl, then runs @skin-designer and @mobile-porter one after the other (never in parallel) on the new game and merges their branches into the spec branch locally.
disable-model-invocation: true
argument-hint: "<NN-id-game>"
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git switch:*), Bash(git merge:*), Bash(git add:*), Bash(git commit:*), Bash(git rev-parse:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npm run lint:*), Bash(npx tsc:*), Bash(npm run build:*)
---

# /spec-impl-game — Game spec implementer plus skins and mobile

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

Base skill `/spec-impl` (single source of truth, read in Phase B):
!`ls ~/.agents/skills/spec-impl/SKILL.md 2>/dev/null || echo "MISSING"`

---

This command wraps `/spec-impl` for one feature type: **a playable game**. After the game is implemented and committed, it runs `@skin-designer` and then `@mobile-porter` on that game, one after the other, and merges their branches back into the spec branch. It does not duplicate `/spec-impl`: it reads that skill and follows it.

The argument is: `$ARGUMENTS`

Follow the phases in strict order. Do not advance if the previous phase did not complete.

## Phase A — Check the spec is a game spec

1. If the session context says `MISSING` for the base skill, stop and tell the user: "/spec-impl not found. Install it with `npx skills@latest add Klerith/fernando-skills`."
2. Resolve the spec file from `$ARGUMENTS` exactly as `/spec-impl` Phase 1 does (full name, number only or slug only). If `$ARGUMENTS` is empty, list `specs/` and ask for the exact name. Stop and wait.
3. The file must be named `NN-<id>-game.md`. Derive `<id>` (it is the `games.id`). If it does not match, stop and tell the user to run plain `/spec-impl` for non-game specs. Do not continue.

## Phase B — Implement with /spec-impl

The Skill tool cannot call `/spec-impl` (it is user-invoked only). Read `~/.agents/skills/spec-impl/SKILL.md` with the Read tool and follow its Phases 1 to 4 exactly, with the same `$ARGUMENTS`:

- approved-only gate (any other status: show its standard error block and stop, no branch, no code);
- clean working tree check, branch `spec-NN-<id>-game`, `AutoCreateBranch` flag;
- summary, then step-by-step implementation with a pause after each step;
- stop on ambiguities, stay inside the spec scope.

Project rules on top (from `CLAUDE.md`): one commit per plan step when the user asks for commits; use `/frontend-design` for any new UI; never add a catalog row without a working engine. Never commit on your own: only when the user says so.

Do not start Phase C until the last plan step is done.

## Phase C — Gate before the agents

The agents need a clean tree and a registered game. Proceed only when all of these are true:

1. Every acceptance criterion of the spec was verified one by one (Playwright for gameplay). Report each as pass or fail.
2. The user agreed to set the spec status to `Implemented` and it is set.
3. The final commit exists and `git status --short` is empty.
4. `<id>` is registered in `lib/games/registry.ts`, and `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
5. The `CLAUDE.md` Games table has the row for the new game.

If one fails, stop, say which one, and wait. Do not launch any agent.

Record the spec branch name now (`git branch --show-current`): it is the merge target in Phases D and E.

## Phase D — @skin-designer

1. Launch one agent with the Agent tool: `subagent_type: "skin-designer"`, prompt `skin <id>`. Run it in the foreground. Wait for its final report before doing anything else.
2. If the agent stopped, asked a question or reported a failed check: show its report and stop. Do not run `@mobile-porter`. Do not merge.
3. If it succeeded (branch `skins-<id>`, one commit):
   - `git switch <spec branch>`
   - `git merge --no-ff skins-<id>`
   - confirm `git status --short` is empty.
   - On a merge conflict: stop and ask the user. Never resolve it silently.

## Phase E — @mobile-porter

Only after Phase D is merged and the tree is clean. Never in parallel with Phase D.

1. Launch one agent: `subagent_type: "mobile-porter"`, prompt `mobile <id>`. Foreground. Wait for its final report.
2. Same failure rule as Phase D: on stop or failed check, show the report and stop.
3. If it succeeded (branch `mobile-<id>`, one commit):
   - `git switch <spec branch>`
   - `git merge --no-ff mobile-<id>`
   - confirm `git status --short` is empty. Conflict: stop and ask.

## Phase F — Report

Be short. Give:

- spec, game id and the branch that now holds everything;
- commits merged (`git log --oneline --graph` of the branch, last few lines);
- from each agent: checks run with results and screenshot paths;
- agent reference files updated (`references/game-with-themes.md`, `references/game-mobile-ready.md`);
- next step: push the branch and open a pull request when the user asks.

## Hard rules

- `@skin-designer` and `@mobile-porter` run sequentially, never in parallel, and only after Phase C passes.
- Never launch an agent if the previous step failed or the tree is not clean.
- One game per run.
- Never push, never open a pull request. Local merges into the spec branch are the only merges.
- Never edit `/spec-impl` or the agent definitions from here.
- Never change gameplay, scoring or the schema while running the agents.
