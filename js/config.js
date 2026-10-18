// Settings you may want to change. Everything else works as is.
export const CONFIG = {
  // Where sports data comes from. Leave as is to call ESPN straight from the browser.
  // If the browser ever blocks those calls, deploy worker/worker.js and set this to
  // 'https://YOUR-WORKER.workers.dev/espn'
  espnBase: 'https://site.api.espn.com',

  // Player stats come from a second ESPN host. Same idea: swap for your Worker if blocked
  // ('https://YOUR-WORKER.workers.dev/espnweb').
  espnWebBase: 'https://site.web.api.espn.com',

  // Ask the game. Leave empty until you deploy worker/worker.js, then set to
  // 'https://YOUR-WORKER.workers.dev/ask'
  askUrl: '',
  askDailyLimit: 15,

  // How often live screens refresh (milliseconds).
  refreshMs: 20000,
};
