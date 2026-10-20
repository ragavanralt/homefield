# Crew games setup (Duels, Survivor, Cap Night)

One-time setup, about 10 minutes. Nothing here costs money on the free tiers.

## 1. Turn off Supabase's GitHub deploy
Supabase dashboard → Project Settings → Integrations → GitHub. If "Deploy to production" is on, switch it **off**. This app does not use Supabase migrations from the repo, and the toggle can run files you did not intend.

## 2. Paste the schema
1. Supabase dashboard → **SQL Editor** → New query.
2. Open `supabase/schema.sql` in this repo, copy everything, paste, **Run**.
3. The last result shown is `your_first_invite_code` (looks like `HF4K2M9Q`). **Copy it.** It is the owner invite. It works once.

It is safe to run again later (it is written to be repeatable). Running it again never deletes data.

## 3. Put the public key in the app
Open `js/social-config.js` and paste the project's **anon / publishable key** (Project Settings → API Keys) into `key`. The URL is already filled in and has no `/rest/v1` on the end. This key is meant to be public.

Never paste the **secret / service** key into any file in the repo.

## 4. GitHub secrets for the bots
Repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | the project URL (no `/rest/v1`) |
| `SUPABASE_SERVICE_KEY` | the **secret** key from the API Keys page |

Then Actions → **Crew bots** → Run workflow → job `slate`. It publishes today's games and cards. After that it runs by itself (twice a day for slates, every 15 minutes in the evening for results).

## 5. Join and test a duel
1. Open the app, go to Fan → **Crew**, enter the owner invite code, pick a handle. **Save the recovery code** it shows once. It is how you sign in on your Mac or a new phone.
2. Crew → Owner tools → **Make an invite link**. Send it to one person. One link, one person.
3. Pick'em → **Duels** → New duel → One game → pick them → Send challenge. Make your picks.
4. On the other device or account: open Duels, accept the challenge, make picks.
5. After the games end plus about 30 minutes, the winner sees a **Collect coins** banner on Duels, Survivor and Cap Night. Tap it to add the coins to your balance.

Test fast: pick a game that tips off soon. Picks lock at each card's game start.

## How the money works
- Stakes leave your coins on your device the moment you commit. Winnings, refunds and prizes wait on the server until you tap Collect, and can be collected only once.
- Duels: 5% cut of the pot. Tie, or fewer than 3 finished cards, returns stakes.
- Survivor: 50 coins to enter. If you forget to pick, the app picks the best favourite you have not used. Everyone out in the same period splits the pot.
- Cap Night (NBA): 100 coins for the night, 300 for the week (best 5 nights, Monday to Sunday). Needs at least 2 players.
- Coins live in each person's browser, so a determined friend could edit their own balance. This is a friends game and is built on trust.

## If something looks off
- **Pause everything:** in Supabase, SQL Editor: `update app_config set value = 'true' where key = 'killswitch';` (set back to `'false'` to resume).
- **Force everyone to refresh the app:** raise `min_version` in `app_config`.
- **Lost a recovery code:** if you are still signed in on any device, Crew → New recovery code. If not, the owner removes the old account and sends a new invite; the person joins again with a new handle (the old handle stays reserved).
- Bots need GitHub Actions minutes. Public repos are free; private repos have a monthly allowance.
