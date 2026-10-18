// Homefield Worker (Cloudflare). Two jobs:
//   GET  /espn/...  passes through to ESPN's public feed and adds CORS headers (only needed if the browser blocks direct calls).
//   POST /ask       answers a question about one game using the Anthropic API. Your key stays here, never in the app.
// Secrets/vars: ANTHROPIC_API_KEY (secret). Optional: ALLOWED_ORIGIN (e.g. https://you.github.io), MODEL, KV namespace "LIMITS".

const ESPN = 'https://site.api.espn.com';

function cors(env, req) {
  const origin = req.headers.get('origin') || '*';
  const allowed = env.ALLOWED_ORIGIN;
  const ok = !allowed || allowed === '*' || origin === allowed;
  return {
    'access-control-allow-origin': ok ? (allowed && allowed !== '*' ? allowed : '*') : 'null',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const headers = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    if (url.pathname.startsWith('/espn/') && req.method === 'GET') {
      const target = ESPN + url.pathname.slice('/espn'.length) + url.search;
      const live = /scoreboard|summary/.test(url.pathname);
      const res = await fetch(target, { cf: { cacheTtl: live ? 10 : 600, cacheEverything: true } });
      return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'cache-control': `public, max-age=${live ? 10 : 300}`, ...headers } });
    }

    // Generic pass-through for the backup sources: /proxy?u=https://api-web.nhle.com/...
    if (url.pathname === '/proxy' && req.method === 'GET') {
      let target;
      try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return json({ error: 'Bad address' }, 400, headers); }
      const okHosts = ['api-web.nhle.com', 'statsapi.mlb.com', 'sports.core.api.espn.com', 'site.web.api.espn.com', 'site.api.espn.com', 'api.the-odds-api.com'];
      if (!okHosts.includes(target.hostname)) return json({ error: 'Host not allowed' }, 403, headers);
      const res = await fetch(target.toString(), { cf: { cacheTtl: 60, cacheEverything: true } });
      return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'cache-control': 'public, max-age=60', ...headers } });
    }

    if (url.pathname === '/ask' && req.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'The Worker has no ANTHROPIC_API_KEY set yet.' }, 500, headers);
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'Bad request' }, 400, headers); }
      const question = String(body.question || '').slice(0, 500).trim();
      const context = String(body.context || '').slice(0, 8000);
      if (!question) return json({ error: 'Ask a question first.' }, 400, headers);

      // Optional per-IP daily cap if a KV namespace named LIMITS is bound.
      if (env.LIMITS) {
        const ip = req.headers.get('cf-connecting-ip') || 'x';
        const key = `ask:${ip}:${new Date().toISOString().slice(0, 10)}`;
        const n = parseInt((await env.LIMITS.get(key)) || '0', 10);
        if (n >= 60) return json({ error: 'Daily limit reached. Try again tomorrow.' }, 429, headers);
        await env.LIMITS.put(key, String(n + 1), { expirationTtl: 90000 });
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: env.MODEL || 'claude-haiku-5-5',
          max_tokens: 400,
          system: 'You answer questions about a single sports game for a fan. Use only the game data provided. If the data does not say, say you do not have that detail. Keep answers short, plain and friendly. No markdown headings.',
          messages: [{ role: 'user', content: `Game data:\n${context}\n\nQuestion: ${question}` }],
        }),
      });
      if (!res.ok) return json({ error: 'The AI service had a problem (' + res.status + ').' }, 502, headers);
      const j = await res.json();
      const answer = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return json({ answer }, 200, headers);
    }

    return json({ ok: true, name: 'homefield-worker' }, 200, headers);
  },
};
