// Test helper: runs supabase/schema.sql in a throwaway Postgres database and calls its functions the way the
// app does (as the "anon" role, through psql). If Postgres is not available the SQL tests are skipped.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';

const CONN = process.env.HF_PG || 'host=/var/tmp/hfpg port=5544 user=postgres';
let counter = 0;
const base = (db) => ['-X', '-A', '-t', '-q', '-d', `${CONN} dbname=${db}`];

export function available() {
  try { execFileSync('psql', [...base('postgres'), '-c', 'select 1'], { stdio: 'pipe' }); return true; } catch (e) { return false; }
}

const JSON_ARGS = new Set(['p_games', 'p_cards', 'p_cap', 'p_actuals', 'p_data', 'p_public']);
const lit = (v, key) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (JSON_ARGS.has(key)) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (Array.isArray(v)) return v.length ? `array[${v.map((x) => lit(x)).join(',')}]::text[]` : "'{}'::text[]";
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function run(db, sqlText) {
  try { return { out: execFileSync('psql', [...base(db), '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sqlText, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }).trim() }; } catch (e) {
    const err = String(e.stderr || e.message);
    const m = err.match(/ERROR:\s+(.*)/);
    return { err: m ? m[1].trim() : err.trim() };
  }
}
function runAsync(db, sqlText) {
  return new Promise((resolve) => {
    const p = spawn('psql', [...base(db), '-v', 'ON_ERROR_STOP=1', '-f', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    p.stdin.end(sqlText);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => { if (code === 0) resolve({ out: out.trim() }); else { const m = err.match(/ERROR:\s+(.*)/); resolve({ err: m ? m[1].trim() : err.trim() }); } });
  });
}

export function createDb() {
  const DB = `hf_test_${process.pid}_${++counter}`;
  const q = (s) => execFileSync('psql', [...base('postgres'), '-v', 'ON_ERROR_STOP=1', '-c', s], { stdio: 'pipe', encoding: 'utf8' });
  q(`drop database if exists ${DB}`); q(`create database ${DB}`);
  const prep = `do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;
    grant usage on schema public, extensions to anon, authenticated, service_role;`;
  const r = run(DB, prep);
  if (r.err) throw new Error('prep failed: ' + r.err);
  return new Db(DB);
}

export class Db {
  constructor(name) { this.name = name; this.now = null; }
  /** Pin the database clock for later calls, e.g. '2026-10-20 14:00-04'. */
  at(ts) { this.now = ts; return this; }
  _wrap(role, s) { return `${role ? `set role ${role}; ` : ''}${this.now ? `set hf.now = '${this.now}'; ` : ''}${s}`; }
  applySchema() {
    const file = new URL('../supabase/schema.sql', import.meta.url);
    const r = execFileSync('psql', [...base(this.name), '-v', 'ON_ERROR_STOP=1', '-f', file.pathname], { stdio: 'pipe', encoding: 'utf8' });
    return r.trim();
  }
  /** Run SQL as the database owner. Returns the text output. */
  sql(s) { const r = run(this.name, this._wrap('', s)); if (r.err) throw new Error(r.err + '\n' + s); return r.out; }
  /** Run SQL as a role and return { out } or { err }. */
  as(role, s) { return run(this.name, this._wrap(role, s)); }
  rows(s) { const o = this.sql(`select coalesce(jsonb_agg(t), '[]') from (${s}) t`); return JSON.parse(o || '[]'); }
  one(s) { return this.sql(s).split('\n')[0]; }
  _call(role, fn, args) {
    const list = Object.entries(args || {}).map(([k, v]) => `${k} => ${lit(v, k)}`).join(', ');
    return this._wrap(role, `select ${fn}(${list})`);
  }
  /** Call a function as anon (the app). Returns the parsed JSON. Errors raised in SQL come back as { error: 'hf:...' , raised: true }. */
  rpc(fn, args, role = 'anon') {
    const r = run(this.name, this._call(role, fn, args));
    if (r.err) return { error: r.err, raised: true };
    const line = r.out.split('\n')[0];
    try { return line ? JSON.parse(line) : null; } catch (e) { return line; }
  }
  async rpcAsync(fn, args, role = 'anon') {
    const r = await runAsync(this.name, this._call(role, fn, args));
    if (r.err) return { error: r.err, raised: true };
    try { return JSON.parse(r.out.split('\n')[0]); } catch (e) { return r.out; }
  }
  drop() { try { execFileSync('psql', [...base('postgres'), '-c', `drop database if exists ${this.name}`], { stdio: 'pipe' }); } catch (e) { /* ignore */ } }
}
