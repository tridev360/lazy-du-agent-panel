# Changelog

## 3.2.0

- Book theme Now screen: the talk ring turns in layers, the conversation tabs take the color of who answers (Claude or ideas), the top line lists what is "pronto hoje", and deliveries, the week and the dock show how long ago they were read.
- Two new example blocks: live automation (the last action of an example purchase robot and today's count) and accounts (four Claude accounts, Codex and research, each with its read age or "sem leitura"). Like the rest of this screen they only show in the example; with your own data the previous Now opens first.
- One 5 s timer drives the screen, and it does nothing while the tab is hidden.

## 3.1.1

- Book theme Now screen: the talk ring says "exemplo" instead of promising a key, the ideas block is called IDEIAS like its tab, and the helpers note wraps instead of being cut.
- Cleaner served comments: no internal piece names in the files touched.

## 3.1.0

- Book theme: a new Now screen with the talk ring, "you decide" cards, a conversation box and the activity feed. In the example it is a demo only: nothing is sent or saved. With your own data the old Now opens first; the "Tela V3" button switches.
- Cleaner screen: the top bar and the view menu slide away and come back over the content when the mouse reaches the top edge. The "Barra de cima fixa" switch in settings, or the B key, keeps the bar fixed.
- WEN automatic mode reads in the background every 5 min and no longer opens the window; the WEN button or the W key opens it.
- Flow: clearer deadlines and empty states, focus order from each front, unread deadlines counted.
- Book theme: the delivery calendar shows when the history was read, and a missing detail no longer prints "null".

## 3.0.0

- New base, rebuilt view by view: Now, Flow, Ideas, Brain, Schedule, WEN and the Grid, Book and Sheet themes.
- Starts with `node servidor.cjs` (or `npm start`); `node checar.cjs` checks the setup first. The old `src/panel.cjs` entry and the `lazy-du-panel` command are gone.
- Optional state folder for cards, schedule, deliveries and ideas, with the method guide in `metodo/`.
- Fictional example with `npm run example`, no real sessions.
- Conversation view, voice, music and research log start off; session reading stays metadata only.
- Interface mostly in Portuguese for now. Version 2.2.8 stays under the `v2.2.8` tag.

## 2.2.8

- Replace the getting-started tutorials with videos recorded on the current welcome flow.
- Offer separate English, Portuguese and Spanish videos and captions in Welcome and First steps.
- Keep exact-file validation on every media request, with no fallback to another language.

## 2.2.7

- Add the Portuguese getting-started video and captions to Welcome and First steps.
- Link the same local video from the English and Portuguese README thumbnails.
- Validate the approved files on each request; removed or changed media stays unavailable.

## 2.2.6

- Remove project-specific names from a public test; generic copy checks stay in place.

## 2.2.5

- Correct the Home privacy text in English, Portuguese and Spanish: local session metadata, connected tasks, the global rules marker and optional network features.

## 2.2.4

- Welcome offers a labelled fictional example in a separate tab before setup.
- Returning from the example keeps the original setup and its unfinished input.
- Example preferences stay in that tab, without changing the original panel.
- The README starts with one purpose and one opening action, with accurate privacy details.

## 2.2.3

- First-time setup opens the existing welcome screen before the dashboard.
- First steps highlights the next pending step before operational indicators.
- Returning users keep their preferences; skipping or reopening setup does not complete tasks or accept rules.

## 2.2.2

- Local tutorial player integration in the welcome screen and First steps.
- Unavailable until approved language-specific media exists.

## 2.2.1

- Project-level indicators show whether the team rules were observed, without treating the global setup as proof for each project.
- Teach your AI shows one instruction after copying, with the selected AI tool.
- Version 2.1 notes retain their read marks after an update.
- First steps allows a few minutes for reading and cached checks; the README matches the connection button and explains file timestamps and project discovery.
- The fallback version and validation checks include this patch release.

## 2.2.0

- First steps guides setup with automatic detection, local rules copying and one-click tasks connection.
- Six metadata-based notices guide context handoffs, separate projects, model and effort choices, idle helpers, parked projects and a three-project priority queue.
- The model/effort table stays under Teach your AI.
- Choices stay local and do not run agents or edit instruction files.

## 2.1.1

- Clearer first reading, language in the header, consistent controls and simple AI rules copying.
- What the panel solves on Home and in the README; security and pinned-version instructions.
- Side-by-side Team from 1100 px, paused hidden animations and incremental status reads.
- Optional version check on click, background launcher reuse and offline mode.


## 2.1.0

- Clean home with a recent-session count, six short lines and four tabs plus More.
- Project size and objective chosen in two clicks, with Skip and saved preferences.
- BEGINNER, EXPLORER and PRO modes, switchable at any time.
- Known team hierarchy retained; one-person and larger-team fictional examples.
- Public acceleration checklist and local settings, with no automatic agent execution.
- Real readers project permitted metadata; previous conversation caches invalidated.
- Missing credit is explicit; remaining credit, tokens, sessions and completed tasks stay separate.
- English, Portuguese and Spanish; isolated public validation and responsive captures.
- Optional task folder: Markdown tasks with a short header and pending decisions in decisions.md.
- Today's look: one card per AI, who is working, what needs you and the week's spend; pink is you, orange is Claude Code, blue is Codex.
- Teach your AI with who does what, and a bell for version notes, tips, waiting items and decisions; author messages only when you turn them on.
- Send feedback and Talk to the author open in your browser only when clicked; this version sends no usage data.

## 2.0.0

Local dashboard, automatic session discovery, task boards, fictional examples and optional portable Windows tooling.
