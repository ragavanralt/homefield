

## Daily and weekly refresh

Quests, the daily shop deal and the weekly featured items come from `data/live.json`. Run `node scripts/refresh.mjs` to
refresh it for today (Toronto time), or `node scripts/refresh.mjs --weekly` to rebuild the weekly part too. Scheduled tasks do
this every morning (about 8am) and on Fridays. If the file is missing or old, the app builds the same content itself.

## Backup odds source

Settings has a second key box for OddsPapi (oddspapi.io, about 250 free requests a month). The app tries The Odds API first, then OddsPapi if there is no key, it ran out, or it had nothing. Answers are cached on the device. See js/oddspapi.js.
