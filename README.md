

## Daily and weekly refresh

Quests, the daily shop deal and the weekly featured items come from `data/live.json`. Run `node scripts/refresh.mjs` to
refresh it for today (Toronto time), or `node scripts/refresh.mjs --weekly` to rebuild the weekly part too. Scheduled tasks do
this every morning (about 8am) and on Fridays. If the file is missing or old, the app builds the same content itself.
