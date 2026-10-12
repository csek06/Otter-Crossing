# Online boards (Supabase)

The game works offline by default. When the build is given a Supabase project URL and publishable (or legacy anon) key, it adds online boards. Without them it behaves exactly as before and makes no network calls.

## What's built

| Board | Who sees it | What counts |
| --- | --- | --- |
| This device | Anyone on that device | Local top 10, as before. Never leaves the device. |
| Global | Everyone | Best free-play score per player, all time. |
| Today | Everyone | Best score on today's daily lanes. Every player gets the same seed. |
| Event | Everyone | Best score per player while an event code is set and the event is running. |
| My company | Signed-in players with the same work domain | Best score per player whose verified email is on that domain. |

- **Event codes.** Open the game with `?event=summit-2026`, or set the code on the admin screen. The code sticks on that device until it's cleared. Events live in the `events` table with a name and start and end times. Scores only count while the event is running.
- **Company boards.** A player types a work email and gets a 6-digit code from Supabase Auth. Once verified, `claim_company()` reads the confirmed email and stores only the domain. Free and disposable domains (gmail.com, yahoo.com, hotmail.com, outlook.com, msn.com, aol.com, icloud.com, and about 75 more) are rejected, so those players stay on the public boards. Emails stay in Supabase Auth and never land in the game tables.
- **Posting is a choice each run.** The game over form has "Post to the online boards (initials only)" (on by default, remembered) and "Also post to the {domain} board" once signed in. Public boards show initials only.
- **Booth mode** never shows the company tab or sign-in, because it's a shared device.
- **Offline.** If a post fails because the network is down, it waits in a queue of up to 20 and retries when the device comes back online.
- **Forget me.** Signed in, the board screen has "Remove my online scores". It deletes the device's and the account's scores and the stored domain.

## How it fits together

- `supabase/migrations/` is the whole database. Every table has row level security on with no policies, and the `anon` and `authenticated` roles have no table access. The browser can only call these functions:
  - `start_run`
  - `submit_score`
  - `leaderboard`
  - `event_info`
  - `claim_company`
  - `forget_me`
- `src/online/client.js` calls them with plain `fetch` (no SDK, so the single HTML file stays small). It also handles the Auth email code, token refresh and the offline queue.
- `src/online/config.js` reads the URL and key the build baked in. `?offline=1` turns online off for one visit. Debug builds (`?debug=1`) stay offline unless you also pass `&sbUrl=...&sbKey=...`, so test runs never reach the real boards.

### Cheating

Scores come from the browser, so they can be forged. Nothing fully stops that without running the game on the server. The migration makes it expensive:

- **Run tokens.** `start_run` hands out a run id when a run starts. `submit_score` only accepts that run once, within 24 hours.
- **Time checks.** A score of N lanes must have taken at least N × 0.1 seconds since the run started. Action items are capped at score × 2 + 50.
- **Limits.** Scores are capped at 10,000. Each device can start 120 runs an hour.
- **Initials.** Blocked initials are replaced with OTR.

If a board gets abused, the next steps are Cloudflare Turnstile on `start_run`, and an admin view to delete rows.

## GitHub integration

Everything is set from GitHub. You never need to paste settings into the Supabase dashboard.

- `.github/workflows/supabase.yml` runs when `supabase/`, `tools/supabase-setup.mjs` or the workflow itself changes, or by hand. It does four things:
  1. It prints which settings it can see (names only).
  2. It checks the migrations against Postgres 16.
  3. It runs `supabase db push`.
  4. It runs `tools/supabase-setup.mjs`, which uses the Management API to set the sign-in URLs, the code email, Resend as the email sender and the rows in `supabase/events.json`.
- `.github/workflows/pages.yml` builds the site and also runs after each Supabase run. It uses the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables if you set them. Otherwise it looks up the project URL and publishable key with the access token. If it finds neither, the build is offline only.

Supabase also has its own GitHub integration (project settings > Integrations > GitHub). It applies migrations from a branch and can make preview branches per pull request, but it's a paid-plan feature. The workflow does the same job on the free plan, so pick one, not both.

To change the database, add a new file in `supabase/migrations/` (named `YYYYMMDDHHMMSS_what.sql`) and never edit one that's already been pushed. Run `npm run test:db` locally. It needs Postgres and `psql`.

## Where each setting lives

All of these go in GitHub, under Settings > Secrets and variables > Actions. Use repository secrets, not environment secrets. The workflow pushes the email settings into Supabase.

| Name | Kind | What it is |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Secret | Personal access token, from supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_ID` | Secret, optional | The project ref, the part before `.supabase.co`. Only needed if the token can see more than one project. |
| `SUPABASE_DB_PASSWORD` | Secret | The database password from project creation |
| `RESEND_API_KEY` | Secret | Resend API key with sending access |
| `AUTH_EMAIL_FROM` | Variable | Sender address on your verified Resend domain, like `play@mail.example.com` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Variable, optional | Only if you want to override the lookup |

The Resend key is never built into the game. Supabase uses it to send the sign-in emails.

## Setup checklist

1. Create a Supabase project and add the Supabase secrets above.
2. Set up Resend:
   1. Sign up at resend.com.
   2. Under Domains, add a domain or subdomain you control, and add the DNS records Resend shows you (an MX and SPF TXT on the sending subdomain, plus a DKIM TXT). On a company domain, someone with DNS access has to add them. Wait for Resend to show the domain as verified.
   3. Under API Keys, create a key with "Sending access", limited to that domain.
   4. Save it as the `RESEND_API_KEY` secret, and save the sender address as the `AUTH_EMAIL_FROM` variable.
3. Run "Supabase migrations" from the Actions tab. "Deploy to GitHub Pages" runs after it.
4. Add events to `supabase/events.json` and push. Each one needs an id (the `?event=` code), a name, and start and end times.
5. Have legal review the privacy side. The game stores a random device id, initials and scores. If someone signs in, it also stores their email (in Supabase Auth) and their email domain.

## More ideas

- **Weekly board.** `leaderboard('week')` already exists, but there's no tab for it yet.
- **Company vs company.** Rank domains by their top 5 average, and only show domains with at least 5 players so a company of one isn't exposed.
- **Otter board.** Pin the otter.ai domain as a staff board for internal events and dogfooding.
- **Slack daily top 10.** `pg_cron` plus `pg_net` can post yesterday's daily board to a channel webhook.
- **Phone handoff at the booth.** Show a QR code on the game over screen that opens the game on a phone with the run's score attached, so people can sign in on their own device instead of the shared one.
- **Event sign-ups.** An opt-in "email me about Otter" box at events, stored in its own private table and separate from scores.
- **Streaks.** Count consecutive days a player has posted a daily score.
