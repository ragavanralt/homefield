# Homefield

Live scores, lineups, box scores, play by play, win chance with a replay slider, recap cards, calendar export and a solo Pick'em game. No sign-in, no build step, free to host.

## Run it on your computer
```
cd homefield
python3 -m http.server 8080
```
Open http://localhost:8080. (Or `npm start`.)

## Put it on GitHub Pages (free)
1. Create a new GitHub repo and push this whole folder to it.
2. Repo Settings, Pages, Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`. Save.
3. After a minute your app is at `https://YOURNAME.github.io/REPONAME/`. On a phone, open it and use Share, Add to Home Screen to install it.

Cloudflare Pages and Netlify also work: point them at this folder with no build command.

## First thing to do
Open the app, pick your teams, then go to Settings, Run data check. It tests every league's feed and tells you what is working. If anything looks off, copy the report.

## If the browser blocks the data (CORS)
Data comes from ESPN's public feed. If the data check says "Failed to fetch":
1. Deploy `worker/worker.js` to Cloudflare Workers (free): `cd worker && npx wrangler deploy`.
2. In `js/config.js` set `espnBase: 'https://YOUR-WORKER.workers.dev/espn'`.

## Turn on "Ask the game" (optional, needs an API key)
1. Deploy the Worker as above.
2. Add your key: `npx wrangler secret put ANTHROPIC_API_KEY`.
3. In `js/config.js` set `askUrl: 'https://YOUR-WORKER.workers.dev/ask'`.
Each device is capped at 15 questions a day (`askDailyLimit`). Without the Worker, the Ask tab explains it is not set up and everything else still works.

## Notes
- Everything you save (teams, picks, watched games) lives in your browser on that device. Use Settings, Download backup to move it.
- The data feed is unofficial and can change without notice. Parsing is defensive, so a missing field hides that piece instead of breaking the page.
- Logos, photos and data belong to ESPN and the leagues. This is a personal project.
- Tests: `npm install && npm test`.
