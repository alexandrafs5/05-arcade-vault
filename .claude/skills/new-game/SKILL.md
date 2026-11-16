---
name: new-game
description: Designs a spec to add a playable game with its leaderboard to Arcade Vault, porting it from references/started-games/ or building it from scratch. Follows the /spec method (questions first, then the spec). Use it before writing any game code.
disable-model-invocation: true
argument-hint: "game name, or a folder in references/started-games/ (e.g. 03-tetris)"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /new-game — Spec designer for a new platform game

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Specs that already exist:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Reference games available to port:
!`ls references/started-games/ 2>/dev/null || echo "No references folder"`

Engines already integrated:
!`ls lib/games/ 2>/dev/null`

Migrations already applied:
!`ls supabase/migrations/ 2>/dev/null`

---

This skill is `/spec` specialised for one feature type: **add a real game, with its leaderboard, to Arcade Vault**. It follows the `/spec` method exactly (same phases, same template sections, same hard rules) and adds the fixed integration contract learned in SPEC 05 (first real game) and SPEC 06 (games and scores in Supabase). **You do not write code here.** Your job is to ask, then save `specs/NN-<id>-game.md`. The user runs `/spec-impl` afterwards.

Read `template.md` (same directory as this skill) before Phase 3. It holds the game-specific blocks the spec must contain.

## Command flow

Follow the four phases in order. **Never skip Phase 2, even for a reference port that looks fully defined.** Phase 2 always runs at least one block of questions (catalog row, HUD, scope, original features to keep or drop). If the user asks to go faster, remind them: "Questions now save hours later." and ask anyway. The only thing Phase 3 may skip is section-by-section confirmation, never the questions.

Reply in the language of the initial prompt. The spec file itself is written in English; UI strings the spec quotes (HUD labels, copy for the `games` row) stay in Spanish. This follows the project convention.

### Phase 1 — Understand the context

1. Read `CLAUDE.md` (game engine pattern, data notes, gotchas).
2. Read `specs/05-asteroids-game.md` and `specs/06-leaderboard-and-games-table.md`. They are the model for wording, section headings and the `Status` word (`Draft`, `Implemented`...).
3. Read the two most recent specs in `specs/` if they are not 05 and 06.
4. Read `lib/games/types.ts` and `lib/games/registry.ts` (the engine contract and the registry), and `app/globals.css` cover rules (`.cover-*`) to know which covers exist.
5. Identify the source from `$ARGUMENTS`:
   - **A folder in `references/started-games/`:** read its `README.md`, `CLAUDE.md`, `index.html`, every `.js` and `.css`, and list `assets/`. Build an inventory:
     - logic canvas size, extra canvases (e.g. a "next piece" canvas);
     - DOM globals (`getElementById`, `document.addEventListener`, `new Audio`, `new Image`) that must leave module scope;
     - HUD, overlays, restart buttons and theme toggles that the React shell replaces;
     - input: keys, mouse (`getBoundingClientRect` scaling is needed once the canvas is scaled by CSS);
     - assets (sprites, sounds) and where they would live (`public/games/<id>/`);
     - win state, level files, frame-rate-dependent physics;
     - rules and constants to keep exactly.
     - If the folder has its own `specs/`, `CLAUDE.md` or `levels.js`-style data files, read them too: they hold rules the code does not show.
     - Note the reference is vanilla JS with DOM globals: the port is a rewrite into the engine contract, not a copy.
   - **A name or description (from scratch):** note it. Rules, scoring, lose condition, controls and canvas size come out in Phase 2.
   - **Empty:** ask for a one-sentence description first. If it does not fit in one sentence, the game is too big: propose splitting it.

### Phase 2 — Clarify through questions

Ask in blocks of 3 to 5 questions. Wait for the answers of each block. Use `AskUserQuestion` for the blocks: 2–4 options, recommendation first and labelled, with the reason. Concrete questions, not open ones. If an answer opens Pandora's box (touch controls, multiplayer, sound...), say it deserves its own spec and ask whether it stays out of scope.

Always cover these, adapted to the game:

- **Source:** reference folder or from scratch. If a reference exists, which parts of it are kept, rewritten or dropped. If none exists, who writes the rules: the user dictates them here, and the spec records them exactly.
- **Catalog row:** `id` slug (English, lowercase, becomes the URL), `title`, Spanish `short` and `long` copy (no claim the game does not satisfy), `cat` (`ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`), `color` (`cyan`, `magenta`, `green`, `yellow`), cover (reuse an unused `.cover-*` or create one), `sort_order`.
- **Scoring and rules:** what adds points, what ends the game, win state (does winning end the game with the final score?), levels, difficulty.
- **HUD:** which fields besides player and score (key, Spanish label, format `number` / `hearts` / `pad2`, initial value). These become `GameDefinition.hud`.
- **Controls and canvas:** keys, mouse, logic size, scaling (tall canvases are limited by `max-height` in `.game-canvas`).
- **Original features to keep or drop** (reference ports): sound, spritesheets, level selector, theme toggle, extra canvases, mouse control. Drop by default what the shell already provides.
- **Integration:** does it depend on SPEC 05 and SPEC 06 only? Does it modify the shared player or only add? (Only add is the goal.)
- **Persistence:** scores only, through `saveScore` into `scores`. Confirm nothing else is stored.
- **UX and failure:** what the player sees on game over, pause, and a failed save (shell already handles these).
- **Risks and closed decisions:** anything the user already decided and does not want to reopen.

**Stop asking** when you can answer these three without assuming anything:

1. Which files appear or change?
2. What are the first and the last executable steps?
3. How is the game verified as finished?

### Phase 3 — Write the spec

- **If you can answer the three questions with no assumptions:** do not go section by section. Write the full spec and go straight to Phase 4. Do not show a draft for approval. The user reviews the saved file.
- **Only if information is missing:** develop the sections one by one, show each in markdown, ask "Does this section stay like this or do you want to tweak it?", and move on only after confirmation.

Section order (from `/spec`, using the blocks in `template.md`): Header, Why this spec exists, Scope (In and Out), Data model, Implementation plan, Acceptance criteria, Decisions, Risks, What is **not** in this spec.

Rules for the content:

- The header objective is one sentence. If it needs two, go back to Phase 2.
- Fill the fixed contract in `template.md` with real names (`id`, file paths, HUD keys, SQL values). No placeholders left.
- Implementation plan: numbered steps, each leaves the app runnable and can be committed alone. A step over 30–50 lines of code gets split. The last step is not "test everything".
- Acceptance criteria are boolean and verifiable. Never "works well".
- Decisions list what was discarded, with a reason. Never skip this section.
- Out of scope records what came up in the questions and was deferred.
- Any new UI (cover art, a new HUD format, a new page element) names `/frontend-design` as the skill `/spec-impl` must use, per the project `CLAUDE.md`. The spec does not design the UI itself.
- Games, scores and stats are never mock: do not add fake data, placeholder rows or "coming soon" entries.
- Never put a game in the catalog without a working engine.
- No TODOs. Short snippets for data structures only; no full functions.
- Standard markdown that renders on GitHub.

### Phase 4 — Save the spec

1. Next number: highest in `specs/` plus one, two digits.
2. Slug: `<id>-game` (e.g. `07-tetris-game.md`). If `$ARGUMENTS` already is a kebab-case token, use it for `<id>`.
3. Date: only the one read from the session context.
4. Write `specs/NN-<id>-game.md` directly. Do not ask permission and do not ask about the file name. Ask only if the file already exists.
5. Status `Draft`. Never `Approved` automatically.
6. Check that every spec in `Depends on` exists in `specs/`. If one does not, say so instead of writing a dangling reference. Dependencies are normally SPEC 05 and SPEC 06, plus any spec that changed the shared player.
7. If `specs/.spec-config.yml` is missing, create it with the default below. If it exists, leave it untouched.

   ```yaml
   # spec workflow configuration
   #
   # AutoCreateBranch — controls whether /spec-impl creates the git branch automatically.
   #   true  (default) → /spec-impl creates and switches to spec-NN-slug without asking
   #   false           → /spec-impl asks for [y/N] confirmation before creating the branch
   AutoCreateBranch: true
   ```

8. Confirm to the user: path of the file; the spec is `Draft` (change to `Approved` after re-reading); if the config file was created, say `AutoCreateBranch` defaults to `true`; next step is `/spec-impl NN-<id>-game`. **Stop there.**

## Hard rules

- **Never write code.** Only the spec `.md` (and `specs/.spec-config.yml` when missing).
- **Never propose implementing the spec** after saving it.
- **Never assume decisions the user did not confirm.** Ask in Phase 2.
- **Do not re-ask in Phase 3** what Phase 2 already answered.
- **Too big** (does not fit in one sentence, touches more than three areas, needs decisions in four or more domains): propose splitting. Typical split: one spec for the engine port, one for any change to the shared player or schema.
- Never edit an applied migration. A catalog change is a new migration file.

## Tone when asking questions

Direct and specific. No apologies, no "if you don't mind". Number the questions and put one per line.

Example block:

> Before writing the data model I need to clarify three things:
>
> 1. **Win state.** Clearing all 5 levels: (a) ends the game and saves the final score, (b) loops back to level 1 with higher speed. Recommendation: (a), because the shell only knows `gameover`.
> 2. **Sound.** The reference plays two `.mp3` files. Keep them (needs `public/games/arkanoid/`) or leave sound for another spec? Recommendation: leave it, same as SPEC 05.
> 3. **HUD.** Besides score, show lives and level? Recommendation: yes, `hearts` and `pad2`, as in ASTEROIDS.
