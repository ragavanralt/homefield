// The knobs that decide how fast coins come in without betting. Bets and game winnings are meant to be what moves you up;
// the daily bonus and quests are a steady trickle that keeps you in the game. Shop prices come from the base price and a curve (priceMult in avatar.js).
export const DAILY_BASE = 60, DAILY_STEP = 20, DAILY_CAP_DAYS = 7;
/** Daily bonus: 80 coins on day one, up to 200 from day 7 on. */
export const dailyBonus = (streakDays) => DAILY_BASE + DAILY_STEP * Math.min(Math.max(streakDays || 0, 0), DAILY_CAP_DAYS);
/** What the quest coin values are multiplied by (they were written when coins were handed out three times as freely). */
export const QUEST_SCALE = 0.6;
export const questCoins = (n) => Math.max(5, Math.round((n * QUEST_SCALE) / 5) * 5);
