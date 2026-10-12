# Work Mode power-up ideas

Draft for review, October 12, 2026. Idea 1 (Work run) is built and live as the `workMode` power-up. The others are not built.

## What the Notion docs say

These are the facts the ideas lean on. Anything a player sees should stay inside them.

- **Name and toggle.** The feature is Work Mode, a Chat | Work toggle in the AI Chat composer. Launch line: "Chat now has Work Mode." Positioning line: "Chat answers questions. Work does the work." Tooltip: "Give Otter a task to run on its own." (Naming Decision: Work Mode)
- **What it does.** It takes a multi-step task, pulls from your meetings, files and connected tools, and hands back a finished artifact: a document, dashboard, report or table. (Roadmap card: AI Chat Work Mode + Artifacts)
- **What sets it apart.** It reasons across all of your meetings, not one transcript. The enablement hub says single-transcript prompts undersell it. (Chat Work Mode: GTM Enablement Hub)
- **How a run feels.** Runs take seconds to minutes. You can leave and do something else, and status dots show when a run is working, done or needs your input. (Chat: Work Mode PRD, session status indicators)
- **Approval.** Before a write action, like filing a Jira ticket or sending an email, it can pause and ask you to approve or deny. "Ask for approval" is the default. (PRD, approval modes)
- **Typical tasks.** Draft the follow-up email from agreed next steps, build a prep brief from every call with an account, summarize open issues across six calls. (GTM Enablement Hub prompts)
- **Launch.** External launch is October 15 (GTM Enablement Hub timeline). Pro and Business get full access, Free sees a lock, and Enterprise gets early access first.

Things the docs say not to claim: that it's unlimited, that it browses the web, that it sends a brief before every meeting automatically, that you share artifacts by link, or any Slack or Microsoft 365 dates. Don't name models or vendors.

## Ideas

### 1. Work run: a task that finishes while you keep playing (recommended)

Pick it up and a small "Work run" card appears in the HUD tracker with a step counter. It runs in the background while you play: each lane you cross is one step. After 8 lanes the run finishes, and the slot's dot shows that it's done. Then it drops its artifact: every action item token still on the next few lanes gets pulled into a follow-up doc, and you bank all of them at once.

- Teaches: hand Otter the whole task, keep working, and come back to a finished artifact. This is the thing only Work Mode does in the lineup.
- It feels different from the existing power-ups. Action Items is a short magnet around you, Summary hops you forward, and Work run pays off later, so you have to survive to collect it.
- If you die before the run finishes, the game over tip names it: "A Work run was 3 lanes from done."
- Build: one module (`src/powerups/workmode.js`) with `update` counting lanes from `game.maxRow`, plus a done state in the tracker. Reuses the token pull from Action Items.

### 2. Approval gate

Pick it up and Otter takes over for a few lanes like Summary, but it stops in front of the next all-hands track. A prompt reads "Approve or deny?" Approve hops you across. Deny leaves you where you are, safe.

- Teaches: Work Mode asks before it acts, and you stay in control.
- Risk: a prompt in the middle of an action game breaks the flow. In booth mode it needs a large tap target, and it overlaps with what Summary already does.

### 3. Cross-meeting sweep

The pickup lights up every action item token on the next 10 lanes at once. You get a few seconds to grab as many as you can, and each one you grab adds to a growing doc icon in the HUD.

- Teaches: it reasons across all of your meetings, not one transcript.
- Simple to build, but it plays a lot like the Action Items magnet, so it teaches less that's new.

### 4. Chat | Work switch on AI Chat

No new pickup. AI Chat gets a Chat | Work switch in the pause menu. Chat keeps today's revive. Work spends AI Chat right away on a background run like idea 1.

- Teaches the toggle itself and the "Chat answers questions. Work does the work." line.
- Costs a pause-menu control and an extra choice for booth visitors who play once.

## Draft copy for idea 1

All of it needs a PMM check. The taglines stay under 6 words.

| Field | Draft | Source |
| --- | --- | --- |
| name | Work Mode | Naming decision |
| tagline | Hand Otter the whole task | PRD comms angle |
| description | Switch AI Chat to Work and Otter runs a multi-step task across your meetings and connected tools, then hands back a finished document. | Roadmap card, enablement hub |
| river phrase | Chat answers. Work does the work. | Positioning line, shortened |
| death tip (hawk) | Work Mode could have drafted that follow-up for you. | Enablement hub, first prompt to try |
| helpUrl | https://help.otter.ai/hc/en-us/articles/43427281705623 (Otter AI Chat Overview V2, which covers Chat and Work) | Help center |

Open questions for PMM:

- Should Work Mode wait until after the October 15 external launch? If so, ship it with `unreleased: true` and let the flag turn it on.
- Free users see a lock. Does an external booth audience need a "Pro and Business" note on the recap card?
