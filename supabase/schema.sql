-- =====================================================================================
-- Homefield crew server. Paste this whole file into Supabase > SQL Editor > Run.
-- It is safe to run again: tables use "if not exists" and functions are replaced in place.
--
-- How it is locked down
--   * Every table has row level security ON with no policies, and anon / authenticated get no
--     table privileges. The only way in is the functions named hf_*, which check your sign-in
--     token on every call. Functions named x_* and bot_* cannot be called from the app.
--   * bot_* functions are only for the GitHub bots (they use the service key).
--   * Time comes from the database clock, never from the phone.
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;

/* ---------------------------------------------------------------- settings */
create table if not exists app_config (key text primary key, value jsonb not null);
insert into app_config (key, value) values
  ('killswitch', 'false'), ('min_version', '1'),
  ('duel_cut_pct', '5'), ('duel_min_stake', '10'), ('duel_max_stake', '500'), ('duel_max_open', '12'),
  ('survivor_entry', '50'), ('survivor_leagues', '["nfl","nba"]'),
  ('cap_budget', '40'), ('cap_night_prize', '100'), ('cap_week_prize', '300'),
  ('solo_coins', '10')
on conflict (key) do nothing;

/* ------------------------------------------------------------------ tables */
create table if not exists crews (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Crew',
  created_at timestamptz not null default now()
);
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  display text,
  crew_id uuid not null references crews(id),
  is_owner boolean not null default false,
  active boolean not null default true,
  secret_hash text not null,
  avatar jsonb,
  team jsonb,
  stats jsonb not null default '{}',
  solo_streak int not null default 0,
  solo_best int not null default 0,
  solo_last date,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);
create unique index if not exists profiles_handle_key on profiles (lower(handle));
create table if not exists sessions (
  hash text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  device text,
  created_at timestamptz not null default now(),
  last_used timestamptz not null default now()
);
create index if not exists sessions_user on sessions (user_id);
create table if not exists invites (
  code text primary key,
  crew_id uuid not null references crews(id),
  made_by uuid references profiles(id),
  owner boolean not null default false,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists throttle (key text not null, at timestamptz not null default now());
create index if not exists throttle_key on throttle (key, at);
create table if not exists fans (
  user_id uuid primary key references profiles(id) on delete cascade,
  ver int not null default 0,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table if not exists ops (
  user_id uuid not null references profiles(id) on delete cascade,
  op text not null,
  kind text not null,
  ref text,
  created_at timestamptz not null default now(),
  primary key (user_id, op)
);

create table if not exists games (
  league text not null,
  game_id text not null,
  day date not null,
  start_at timestamptz not null,
  status text not null default 'pre',            -- pre | in | post | void
  home jsonb not null,                           -- { id, name, abbr }
  away jsonb not null,
  home_score int,
  away_score int,
  fav_team text,
  fav_prob numeric,
  ou numeric,
  home_spread numeric,
  final_at timestamptz,
  settled_at timestamptz,
  primary key (league, game_id)
);
create index if not exists games_day on games (day);
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  league text not null,
  game_id text not null,
  kind text not null check (kind in ('winner', 'total', 'team_total', 'player')),
  subject text not null,
  title text not null,
  a_label text not null,
  b_label text not null,
  line numeric,
  start_at timestamptz not null,
  meta jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'final', 'void')),
  outcome text check (outcome in ('a', 'b', 'push')),
  actual numeric,
  settled_at timestamptz,
  unique (league, game_id, kind, subject),
  foreign key (league, game_id) references games (league, game_id)
);
create index if not exists cards_day on cards (day, status);

create table if not exists duels (
  id uuid primary key default gen_random_uuid(),
  op text not null,
  creator uuid not null references profiles(id),
  opponent uuid references profiles(id),
  length text not null check (length in ('game', 'day', 'week')),
  stake int not null check (stake > 0),
  target int not null,
  status text not null default 'open' check (status in ('open', 'active', 'settled', 'void', 'cancelled', 'expired', 'declined')),
  day date,
  game_key text,
  window_end date,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  winner uuid references profiles(id),
  result jsonb,
  settled_at timestamptz,
  unique (creator, op)
);
create index if not exists duels_status on duels (status);
create table if not exists duel_cards (
  duel_id uuid not null references duels(id) on delete cascade,
  card_id uuid not null references cards(id),
  pos int not null,
  primary key (duel_id, card_id)
);
create table if not exists picks (
  duel_id uuid not null references duels(id) on delete cascade,
  user_id uuid not null references profiles(id),
  card_id uuid not null references cards(id),
  side text not null check (side in ('a', 'b')),
  made_at timestamptz not null default now(),
  primary key (duel_id, user_id, card_id)
);
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  ref text not null,
  amount int not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  claim_id uuid,
  claimed_at timestamptz,
  unique (user_id, kind, ref)
);
create index if not exists payouts_open on payouts (user_id) where claimed_at is null;

create table if not exists daily_five (day date not null, card_id uuid not null references cards(id), pos int not null, primary key (day, card_id));
create table if not exists solo_picks (
  user_id uuid not null references profiles(id) on delete cascade,
  card_id uuid not null references cards(id),
  day date not null,
  side text not null check (side in ('a', 'b')),
  made_at timestamptz not null default now(),
  result text,
  primary key (user_id, card_id)
);
create table if not exists solo_days (user_id uuid not null references profiles(id) on delete cascade, day date not null, correct int not null, valid int not null, primary key (user_id, day));
create table if not exists solo_closed (day date primary key);

create table if not exists survivor_pools (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crews(id),
  league text not null,
  round int not null default 1,
  status text not null default 'open' check (status in ('open', 'live')),
  entry int not null default 50,
  first_period date,
  cur_period date,
  last_period date,
  unique (crew_id, league)
);
create table if not exists survivor_entries (
  pool_id uuid not null references survivor_pools(id) on delete cascade,
  round int not null,
  user_id uuid not null references profiles(id),
  alive boolean not null default true,
  out_period date,
  paid int not null,
  joined_at timestamptz not null default now(),
  primary key (pool_id, round, user_id)
);
create table if not exists survivor_picks (
  pool_id uuid not null,
  round int not null,
  user_id uuid not null,
  period date not null,
  team_id text not null,
  game_league text not null,
  game_id text not null,
  auto boolean not null default false,
  result text,
  made_at timestamptz not null default now(),
  primary key (pool_id, round, user_id, period),
  foreign key (pool_id, round, user_id) references survivor_entries (pool_id, round, user_id) on delete cascade
);
create unique index if not exists survivor_no_reuse on survivor_picks (pool_id, round, user_id, team_id) where result is distinct from 'void';
create table if not exists survivor_rounds (pool_id uuid not null, round int not null, winners jsonb not null, pot int not null, ended_at timestamptz not null default now(), primary key (pool_id, round));

create table if not exists cap_players (
  day date not null,
  player_id text not null,
  league text not null default 'nba',
  game_id text not null,
  name text not null,
  team_id text not null,
  team_abbr text not null,
  pos text,
  face text,
  price int not null check (price between 1 and 40),
  avg numeric not null,
  primary key (day, player_id),
  foreign key (league, game_id) references games (league, game_id)
);
create table if not exists cap_lineups (user_id uuid not null references profiles(id) on delete cascade, day date not null, players text[] not null default '{}', cost int not null default 0, updated_at timestamptz not null default now(), primary key (user_id, day));
create table if not exists cap_stats (day date not null, player_id text not null, stats jsonb not null default '{}', dnp boolean not null default false, score numeric not null default 0, primary key (day, player_id));
create table if not exists cap_days (day date primary key, closed_at timestamptz not null default now());
create table if not exists cap_nights (day date not null, user_id uuid not null references profiles(id) on delete cascade, score numeric not null, picks jsonb not null default '[]', primary key (day, user_id));
create table if not exists cap_weeks (week date primary key, closed_at timestamptz not null default now());

/* ---------------------------------------------------------------- helpers */
-- Time and settings. x_now() reads the database clock; tests can pin it with: set hf.now = '2026-10-20 12:00+00'
create or replace function x_now() returns timestamptz language sql stable as
$$ select coalesce(nullif(current_setting('hf.now', true), '')::timestamptz, now()) $$;
create or replace function x_et(ts timestamptz) returns date language sql stable as
$$ select (ts at time zone 'America/New_York')::date $$;
create or replace function x_cfg(k text) returns jsonb language sql stable security definer set search_path = public as
$$ select value from app_config where key = k $$;
create or replace function x_cfg_int(k text) returns int language sql stable security definer set search_path = public as
$$ select (value #>> '{}')::int from app_config where key = k $$;
create or replace function x_fail(code text) returns jsonb language sql immutable as $$ select jsonb_build_object('error', code) $$;
create or replace function x_norm(t text) returns text language sql immutable as
$$ select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Pause switch and "app too old" check. The app sends its version in the x-client-info header.
create or replace function x_gate() returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare hdr text; ver int;
begin
  if (x_cfg('killswitch') #>> '{}') = 'true' then raise exception 'hf:off'; end if;
  begin hdr := current_setting('request.headers', true)::json ->> 'x-client-info'; exception when others then hdr := null; end;
  if hdr ~ 'homefield/[0-9]+' then
    ver := substring(hdr from 'homefield/([0-9]+)')::int;
    if ver < x_cfg_int('min_version') then raise exception 'hf:update'; end if;
  end if;
end $$;

-- Who is calling? Checks the sign-in token and returns the player's id.
create or replace function x_uid(p_token text) returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u uuid;
begin
  perform x_gate();
  if p_token is null or length(p_token) < 20 then raise exception 'hf:not_signed_in'; end if;
  update sessions set last_used = x_now()
   where hash = encode(digest(p_token, 'sha256'), 'hex') and created_at > x_now() - interval '180 days'
     and exists (select 1 from profiles p where p.id = sessions.user_id and p.active)
  returning user_id into u;
  if u is null then raise exception 'hf:not_signed_in'; end if;
  update profiles set last_seen = x_now() where id = u and (last_seen is null or last_seen < x_now() - interval '5 minutes');
  return u;
end $$;

create or replace function x_code() returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := gen_random_bytes(16); s text := ''; i int;
begin
  for i in 0..15 loop
    s := s || substr(a, (get_byte(b, i) % 32) + 1, 1);
    if i in (3, 7, 11) then s := s || '-'; end if;
  end loop;
  return s;
end $$;

create or replace function x_session(p_user uuid, p_device text) returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare tok text := encode(gen_random_bytes(24), 'hex');
begin
  insert into sessions (hash, user_id, device, created_at, last_used) values (encode(digest(tok, 'sha256'), 'hex'), p_user, left(p_device, 60), x_now(), x_now());
  delete from sessions where user_id = p_user and hash not in (select hash from sessions where user_id = p_user order by last_used desc limit 8);
  return tok;
end $$;

create or replace function x_me(p_user uuid) returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', p.id, 'handle', p.handle, 'display', coalesce(p.display, p.handle), 'owner', p.is_owner,
                            'crew', jsonb_build_object('id', c.id, 'name', c.name))
  from profiles p join crews c on c.id = p.crew_id where p.id = p_user $$;

create or replace function x_throttle_over(p_key text, p_max int, p_secs int) returns boolean language sql stable security definer set search_path = public, pg_temp as
$$ select count(*) >= p_max from throttle where key = p_key and at > x_now() - make_interval(secs => p_secs) $$;
create or replace function x_throttle_hit(p_key text) returns void language sql security definer set search_path = public, pg_temp as
$$ insert into throttle (key, at) values (p_key, x_now()) $$;

create or replace function x_refund(p_user uuid, p_ref text, p_amt int, p_note text) returns void language sql security definer set search_path = public, pg_temp as
$$ insert into payouts (user_id, kind, ref, amount, note) values (p_user, 'refund', p_ref, p_amt, p_note) on conflict (user_id, kind, ref) do nothing $$;
create or replace function x_pay(p_user uuid, p_kind text, p_ref text, p_amt int, p_note text) returns void language sql security definer set search_path = public, pg_temp as
$$ insert into payouts (user_id, kind, ref, amount, note) select p_user, p_kind, p_ref, p_amt, p_note where p_amt > 0 on conflict (user_id, kind, ref) do nothing $$;

/* ------------------------------------------------------- accounts and crew */
create or replace function hf_ping() returns jsonb language sql stable security definer set search_path = public, pg_temp as
$$ select jsonb_build_object('ok', true, 'off', (x_cfg('killswitch') #>> '{}') = 'true', 'min_version', x_cfg_int('min_version')) $$;

create or replace function hf_signup(p_invite text, p_handle text, p_display text default null, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare inv invites; h text := lower(trim(coalesce(p_handle, ''))); code text; uid uuid; disp text;
begin
  perform x_gate();
  if x_throttle_over('signup', 40, 3600) then return x_fail('slow_down'); end if;
  select * into inv from invites where invites.code = x_norm(p_invite) for update;
  if not found or inv.revoked or inv.uses >= inv.max_uses or (inv.expires_at is not null and inv.expires_at < x_now()) then
    perform x_throttle_hit('signup');
    return x_fail('bad_invite');
  end if;
  if h !~ '^[a-z0-9_]{3,16}$' then return x_fail('bad_handle'); end if;
  if exists (select 1 from profiles where lower(handle) = h) then return x_fail('handle_taken'); end if;
  disp := nullif(left(trim(coalesce(p_display, '')), 24), '');
  code := x_code();
  insert into profiles (handle, display, crew_id, is_owner, secret_hash)
  values (h, disp, inv.crew_id, inv.owner, crypt(x_norm(code), gen_salt('bf', 8))) returning id into uid;
  update invites set uses = uses + 1 where invites.code = inv.code;
  return jsonb_build_object('token', x_session(uid, p_device), 'code', code, 'me', x_me(uid));
exception when unique_violation then
  return x_fail('handle_taken');
end $$;

create or replace function hf_login(p_handle text, p_code text, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text := lower(trim(coalesce(p_handle, ''))); pr profiles;
begin
  perform x_gate();
  if x_throttle_over('login:' || h, 8, 900) then return x_fail('locked'); end if;
  select * into pr from profiles where lower(handle) = h and active;
  if not found or crypt(x_norm(p_code), pr.secret_hash) <> pr.secret_hash then
    perform x_throttle_hit('login:' || h);
    return x_fail('bad_login');
  end if;
  delete from throttle where key = 'login:' || h;
  return jsonb_build_object('token', x_session(pr.id, p_device), 'me', x_me(pr.id));
end $$;

create or replace function hf_whoami(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token);
begin return jsonb_build_object('me', x_me(u)); end $$;

create or replace function hf_logout(p_token text) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform x_gate();
  delete from sessions where hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- A new recovery code. Every other device is signed out.
create or replace function hf_new_code(p_token text) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u uuid := x_uid(p_token); code text := x_code();
begin
  update profiles set secret_hash = crypt(x_norm(code), gen_salt('bf', 8)) where id = u;
  delete from sessions where user_id = u and hash <> encode(digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('code', code);
end $$;

create or replace function hf_set_display(p_token text, p_display text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token);
begin
  update profiles set display = nullif(left(trim(coalesce(p_display, '')), 24), '') where id = u;
  return jsonb_build_object('me', x_me(u));
end $$;

create or replace function hf_invite_make(p_token text, p_uses int default 1, p_days int default 14) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u uuid := x_uid(p_token); pr profiles; c text;
begin
  select * into pr from profiles where id = u;
  if not pr.is_owner then return x_fail('owner_only'); end if;
  c := 'HF' || substr(x_norm(encode(gen_random_bytes(8), 'base64')), 1, 6);
  insert into invites (code, crew_id, made_by, max_uses, expires_at) values (c, pr.crew_id, u, greatest(1, least(coalesce(p_uses, 1), 20)), x_now() + make_interval(days => greatest(1, least(coalesce(p_days, 14), 90))));
  return jsonb_build_object('code', c);
end $$;

create or replace function hf_invites(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); pr profiles;
begin
  select * into pr from profiles where id = u;
  if not pr.is_owner then return x_fail('owner_only'); end if;
  return jsonb_build_object('invites', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'uses', uses, 'max', max_uses, 'expires_at', expires_at, 'revoked', revoked) order by created_at desc)
    from (select * from invites where crew_id = pr.crew_id and not owner order by created_at desc limit 20) i), '[]'::jsonb));
end $$;

create or replace function hf_invite_revoke(p_token text, p_code text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); pr profiles;
begin
  select * into pr from profiles where id = u;
  if not pr.is_owner then return x_fail('owner_only'); end if;
  update invites set revoked = true where code = x_norm(p_code) and crew_id = pr.crew_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function hf_member_remove(p_token text, p_handle text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); pr profiles; t uuid;
begin
  select * into pr from profiles where id = u;
  if not pr.is_owner then return x_fail('owner_only'); end if;
  select id into t from profiles where lower(handle) = lower(p_handle) and crew_id = pr.crew_id and id <> u;
  if t is null then return x_fail('no_such_player'); end if;
  update profiles set active = false where id = t;
  delete from sessions where user_id = t;
  return jsonb_build_object('ok', true);
end $$;

-- Likes on fits in the gallery. fit is 'current' (what someone is wearing now) or the id of one of their saved fits.
create table if not exists fit_likes (
  user_id uuid not null references profiles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  fit text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, owner_id, fit)
);

create or replace function hf_fit_like(p_token text, p_handle text, p_fit text default 'current') returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); me profiles; o profiles; n int; liked boolean;
begin
  p_fit := coalesce(nullif(trim(p_fit), ''), 'current');
  if length(p_fit) > 24 then raise exception 'hf:bad_request'; end if;
  select * into me from profiles where id = u;
  select * into o from profiles where lower(handle) = lower(trim(coalesce(p_handle, ''))) and crew_id = me.crew_id and active;
  if not found then return x_fail('no_such_player'); end if;
  if o.id = u then return x_fail('own_fit'); end if;
  if p_fit <> 'current' and not exists (select 1 from jsonb_array_elements(coalesce(o.avatar -> 'fits', '[]'::jsonb)) f where f ->> 'id' = p_fit) then return x_fail('no_such_fit'); end if;
  delete from fit_likes where user_id = u and owner_id = o.id and fit = p_fit;
  liked := not found;
  if liked then insert into fit_likes (user_id, owner_id, fit) values (u, o.id, p_fit); end if;
  select count(*) into n from fit_likes where owner_id = o.id and fit = p_fit;
  return jsonb_build_object('liked', liked, 'count', n);
end $$;

create or replace function hf_crew(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); c uuid;
begin
  select crew_id into c from profiles where id = u;
  return jsonb_build_object('me', x_me(u), 'members', coalesce((
    select jsonb_agg(jsonb_build_object(
      'handle', p.handle, 'display', coalesce(p.display, p.handle), 'owner', p.is_owner, 'me', p.id = u,
      'avatar', p.avatar, 'team', p.team, 'stats', p.stats, 'solo_streak', p.solo_streak, 'solo_best', p.solo_best, 'last_seen', p.last_seen,
      'duel_w', (select count(*) from duels d where d.status = 'settled' and d.winner = p.id),
      'duel_l', (select count(*) from duels d where d.status = 'settled' and d.winner is not null and d.winner <> p.id and p.id in (d.creator, d.opponent)),
      'duel_t', (select count(*) from duels d where d.status = 'settled' and d.winner is null and p.id in (d.creator, d.opponent)),
      'likes', coalesce((select jsonb_object_agg(q.fit, q.n) from (select fit, count(*) n from fit_likes where owner_id = p.id group by fit) q), '{}'::jsonb),
      'liked', coalesce((select jsonb_agg(l.fit) from fit_likes l where l.owner_id = p.id and l.user_id = u), '[]'::jsonb)
    ) order by p.handle) from profiles p where p.crew_id = c and p.active), '[]'::jsonb));
end $$;

/* ----------------------------------------------------- device sync (fan etc.) */
create or replace function hf_sync_get(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); f fans;
begin
  select * into f from fans where user_id = u;
  if not found then return jsonb_build_object('ver', 0, 'data', null); end if;
  return jsonb_build_object('ver', f.ver, 'data', f.data, 'updated_at', f.updated_at);
end $$;

-- p_base is the version you last saw. If someone else (your other device) saved since, you get a conflict
-- back with their copy, so nothing is overwritten by accident.
create or replace function hf_sync_put(p_token text, p_base int, p_data jsonb, p_public jsonb default null) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); f fans; nv int;
begin
  if p_data is null or length(p_data::text) > 400000 then return x_fail('too_big'); end if;
  if p_public is not null and length(p_public::text) > 30000 then return x_fail('too_big'); end if;
  insert into fans (user_id, ver, data) values (u, 0, '{}') on conflict (user_id) do nothing;
  select * into f from fans where user_id = u for update;
  if f.ver <> coalesce(p_base, 0) then
    return jsonb_build_object('conflict', true, 'ver', f.ver, 'data', f.data);
  end if;
  nv := f.ver + 1;
  update fans set ver = nv, data = p_data, updated_at = x_now() where user_id = u;
  if p_public is not null then
    update profiles set avatar = p_public -> 'avatar', team = p_public -> 'team',
                        stats = coalesce(p_public -> 'stats', '{}'::jsonb) where id = u;
  end if;
  return jsonb_build_object('ver', nv);
end $$;

/* --------------------------------------------------------- coins and receipts */
create or replace function hf_op_status(p_token text, p_ops text[]) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token);
begin
  return jsonb_build_object('known', coalesce((select jsonb_agg(op) from ops where user_id = u and op = any (p_ops)), '[]'::jsonb));
end $$;

create or replace function hf_payouts(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token);
begin
  perform x_expire_duels();
  return jsonb_build_object('total', coalesce((select sum(amount) from payouts where user_id = u and claimed_at is null), 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'amount', amount, 'note', note, 'at', created_at) order by created_at) from payouts where user_id = u and claimed_at is null), '[]'::jsonb));
end $$;

-- Takes everything waiting for you, exactly once. The app adds the coins to your balance.
create or replace function hf_claim(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); cid uuid := gen_random_uuid(); r jsonb;
begin
  perform x_expire_duels();
  with c as (update payouts set claimed_at = x_now(), claim_id = cid where user_id = u and claimed_at is null returning kind, amount, note)
  select jsonb_build_object('claim_id', cid, 'total', coalesce(sum(amount), 0), 'items', coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'amount', amount, 'note', note)), '[]'::jsonb)) into r from c;
  return r;
end $$;

/* ------------------------------------------------------------------- the slate */
create or replace function x_card_json(c cards, p_user uuid, p_duel uuid default null) returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', c.id, 'kind', c.kind, 'league', c.league, 'game_id', c.game_id, 'title', c.title, 'a', c.a_label, 'b', c.b_label,
    'line', c.line, 'start_at', c.start_at, 'status', c.status, 'outcome', c.outcome, 'actual', c.actual, 'meta', c.meta,
    'locked', (c.start_at <= x_now() or c.status <> 'open')) $$;

-- Games for today and tomorrow (Eastern Time) with how many cards each has. Used to start a duel.
create or replace function hf_slate(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); today date := x_et(x_now());
begin
  return jsonb_build_object('today', today, 'games', coalesce((
    select jsonb_agg(jsonb_build_object('key', g.league || ':' || g.game_id, 'league', g.league, 'game_id', g.game_id, 'day', g.day, 'start_at', g.start_at,
        'home', g.home, 'away', g.away, 'status', g.status,
        'cards', (select count(*) from cards c where c.league = g.league and c.game_id = g.game_id and c.status = 'open' and c.start_at > x_now() + interval '5 minutes'))
      order by g.start_at)
    from games g where g.day between today and today + 1 and g.status <> 'void' and g.start_at > x_now()), '[]'::jsonb),
    'open_cards', (select count(*) from cards c where c.day between today and today + 1 and c.status = 'open' and c.start_at > x_now() + interval '5 minutes'));
end $$;

/* ---------------------------------------------------------------------- duels */
create or replace function x_expire_duels() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare d duels; n int := 0;
begin
  for d in select * from duels where status = 'open' and expires_at <= x_now() for update skip locked loop
    update duels set status = 'expired', settled_at = x_now() where id = d.id;
    perform x_refund(d.creator, d.id::text, d.stake, 'Challenge expired');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Adds cards to a duel from the slate. game: that game. day: that day. week: today's slate.
create or replace function x_attach(p_duel uuid, p_limit int) returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare d duels; n int; pos0 int;
begin
  if p_limit <= 0 then return 0; end if;
  select * into d from duels where id = p_duel;
  select coalesce(max(pos), 0) into pos0 from duel_cards where duel_id = p_duel;
  with cand as (
    select c.id, row_number() over (partition by c.league, c.game_id order by md5(d.id::text || c.id::text)) as rn
    from cards c
    where c.status = 'open' and c.start_at > x_now() + interval '5 minutes'
      and not exists (select 1 from duel_cards x where x.duel_id = d.id and x.card_id = c.id)
      and case d.length when 'game' then (c.league || ':' || c.game_id) = d.game_key
                        when 'day' then c.day = d.day
                        else c.day = x_et(x_now()) end
  ), pick as (
    select id, row_number() over (order by rn, md5(d.id::text || id::text)) as k from cand order by rn, md5(d.id::text || id::text) limit p_limit
  ), ins as (
    insert into duel_cards (duel_id, card_id, pos) select d.id, id, pos0 + k from pick returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

-- Week duels collect up to 3 new cards from each day's slate until they have 10.
create or replace function x_fill_week_duels() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare d duels; have int; today_n int; n int := 0; add int;
begin
  for d in select * from duels where status = 'active' and length = 'week' and window_end >= x_et(x_now()) for update skip locked loop
    select count(*) into have from duel_cards where duel_id = d.id;
    select count(*) into today_n from duel_cards dc join cards c on c.id = dc.card_id where dc.duel_id = d.id and c.day = x_et(x_now());
    add := least(d.target - have, 3 - today_n);
    if add > 0 then n := n + x_attach(d.id, add); end if;
  end loop;
  return n;
end $$;

create or replace function x_duel_json(p_duel uuid, p_viewer uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d duels; cj jsonb; cr profiles; op profiles;
begin
  select * into d from duels where id = p_duel;
  if not found then return null; end if;
  select * into cr from profiles where id = d.creator;
  select * into op from profiles where id = d.opponent;
  select coalesce(jsonb_agg(x_card_json(c, p_viewer) || jsonb_build_object(
      'mine', mp.side,
      'their_made', tp.side is not null,
      'theirs', case when (c.start_at <= x_now() or c.status <> 'open') then tp.side else null end) order by dc.pos), '[]'::jsonb) into cj
  from duel_cards dc join cards c on c.id = dc.card_id
  left join picks mp on mp.duel_id = d.id and mp.card_id = c.id and mp.user_id = p_viewer
  left join picks tp on tp.duel_id = d.id and tp.card_id = c.id and tp.user_id <> p_viewer
  where dc.duel_id = d.id and (p_viewer in (d.creator, d.opponent) or d.status = 'open');
  return jsonb_build_object(
    'id', d.id, 'length', d.length, 'stake', d.stake, 'target', d.target, 'status', d.status,
    'creator', jsonb_build_object('handle', cr.handle, 'display', coalesce(cr.display, cr.handle), 'avatar', cr.avatar, 'team', cr.team),
    'opponent', case when op.id is null then null else jsonb_build_object('handle', op.handle, 'display', coalesce(op.display, op.handle), 'avatar', op.avatar, 'team', op.team) end,
    'you', case when p_viewer = d.creator then 'creator' when p_viewer = d.opponent then 'opponent' else 'viewer' end,
    'created_at', d.created_at, 'expires_at', d.expires_at, 'accepted_at', d.accepted_at, 'window_end', d.window_end, 'day', d.day,
    'winner', (select handle from profiles where id = d.winner), 'result', d.result, 'cards', cj,
    'pot', d.stake * 2, 'cut_pct', x_cfg_int('duel_cut_pct'));
end $$;

create or replace function hf_duel_create(p_token text, p_op text, p_length text, p_stake int, p_opponent text default null, p_game text default null, p_day date default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); me profiles; ex duels; opp uuid; d duels; n int; today date := x_et(x_now()); tgt int; first_start timestamptz;
begin
  if p_op is null or length(p_op) < 8 or p_length not in ('game', 'day', 'week') then raise exception 'hf:bad_request'; end if;
  select * into ex from duels where creator = u and op = p_op;
  if found then return jsonb_build_object('duel', x_duel_json(ex.id, u)); end if;
  if p_stake is null or p_stake < x_cfg_int('duel_min_stake') or p_stake > x_cfg_int('duel_max_stake') then raise exception 'hf:bad_stake'; end if;
  select * into me from profiles where id = u;
  if (select count(*) from duels where status in ('open', 'active') and (creator = u or opponent = u)) >= x_cfg_int('duel_max_open') then raise exception 'hf:too_many'; end if;
  if p_opponent is not null and trim(p_opponent) <> '' then
    select id into opp from profiles where lower(handle) = lower(trim(p_opponent)) and crew_id = me.crew_id and active and id <> u;
    if opp is null then raise exception 'hf:no_such_player'; end if;
  end if;
  tgt := case p_length when 'game' then 3 when 'day' then 5 else 10 end;
  if p_length = 'game' and not exists (select 1 from games where (league || ':' || game_id) = p_game and start_at > x_now() and status <> 'void') then raise exception 'hf:no_such_game'; end if;
  if p_length = 'day' then
    p_day := coalesce(p_day, today);
    if p_day < today or p_day > today + 1 then raise exception 'hf:bad_day'; end if;
  end if;
  insert into duels (op, creator, opponent, length, stake, target, day, game_key, expires_at)
  values (p_op, u, opp, p_length, p_stake, tgt, case when p_length = 'day' then p_day end, case when p_length = 'game' then p_game end, x_now() + interval '24 hours')
  returning * into d;
  if p_length <> 'week' then
    n := x_attach(d.id, tgt);
    if n < tgt then raise exception 'hf:not_enough_cards'; end if;
    select min(c.start_at) into first_start from duel_cards dc join cards c on c.id = dc.card_id where dc.duel_id = d.id;
    update duels set expires_at = least(expires_at, first_start - interval '2 minutes') where id = d.id;
  end if;
  insert into ops (user_id, op, kind, ref) values (u, p_op, 'duel_create', d.id::text);
  return jsonb_build_object('duel', x_duel_json(d.id, u));
end $$;

create or replace function hf_duel_accept(p_token text, p_duel uuid, p_op text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); d duels; me profiles; cr profiles;
begin
  if p_op is null or length(p_op) < 8 then raise exception 'hf:bad_request'; end if;
  if exists (select 1 from ops where user_id = u and op = p_op) then return jsonb_build_object('duel', x_duel_json(p_duel, u)); end if;
  perform x_expire_duels();
  select * into d from duels where id = p_duel for update;
  if not found then return x_fail('no_such_duel'); end if;
  select * into me from profiles where id = u;
  select * into cr from profiles where id = d.creator;
  if cr.crew_id <> me.crew_id or d.creator = u then return x_fail('not_yours'); end if;
  if d.status <> 'open' then return x_fail(case when d.status = 'expired' then 'expired' else 'taken' end); end if;
  if d.opponent is not null and d.opponent <> u then return x_fail('not_yours'); end if;
  if (select count(*) from duels where status in ('open', 'active') and (creator = u or opponent = u)) >= x_cfg_int('duel_max_open') then return x_fail('too_many'); end if;
  update duels set status = 'active', opponent = u, accepted_at = x_now(), window_end = case when length = 'week' then x_et(x_now()) + 6 end where id = d.id;
  if d.length = 'week' then perform x_attach(d.id, 3); end if;
  insert into ops (user_id, op, kind, ref) values (u, p_op, 'duel_accept', d.id::text);
  return jsonb_build_object('duel', x_duel_json(d.id, u));
end $$;

create or replace function hf_duel_cancel(p_token text, p_duel uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); d duels;
begin
  select * into d from duels where id = p_duel for update;
  if not found then return x_fail('no_such_duel'); end if;
  if d.status <> 'open' then return x_fail('not_open'); end if;
  if d.creator = u then
    update duels set status = 'cancelled', settled_at = x_now() where id = d.id;
    perform x_refund(d.creator, d.id::text, d.stake, 'Challenge cancelled');
  elsif d.opponent = u then
    update duels set status = 'declined', settled_at = x_now() where id = d.id;
    perform x_refund(d.creator, d.id::text, d.stake, 'Challenge declined');
  else return x_fail('not_yours'); end if;
  return jsonb_build_object('duel', x_duel_json(d.id, u));
end $$;

create or replace function hf_duel_pick(p_token text, p_duel uuid, p_card uuid, p_side text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); d duels; c cards;
begin
  if p_side not in ('a', 'b') then raise exception 'hf:bad_request'; end if;
  select * into d from duels where id = p_duel;
  if not found or d.status not in ('open', 'active') then return x_fail('not_active'); end if;
  if d.status = 'open' and u <> d.creator then return x_fail('not_yours'); end if;
  if u not in (d.creator, coalesce(d.opponent, d.creator)) then return x_fail('not_yours'); end if;
  if not exists (select 1 from duel_cards where duel_id = d.id and card_id = p_card) then return x_fail('no_such_card'); end if;
  select * into c from cards where id = p_card;
  if c.status <> 'open' or c.start_at <= x_now() then return x_fail('locked'); end if;
  insert into picks (duel_id, user_id, card_id, side, made_at) values (d.id, u, p_card, p_side, x_now())
  on conflict (duel_id, user_id, card_id) do update set side = excluded.side, made_at = excluded.made_at;
  return jsonb_build_object('duel', x_duel_json(d.id, u));
end $$;

create or replace function hf_duel_get(p_token text, p_duel uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); d duels; mine uuid;
begin
  perform x_expire_duels();
  select * into d from duels where id = p_duel;
  if not found then return x_fail('no_such_duel'); end if;
  select crew_id into mine from profiles where id = u;
  if u not in (d.creator, coalesce(d.opponent, d.creator)) and not (d.status = 'open' and (select crew_id from profiles where id = d.creator) = mine and (d.opponent is null or d.opponent = u)) then
    return x_fail('not_yours');
  end if;
  return jsonb_build_object('duel', x_duel_json(d.id, u));
end $$;

create or replace function hf_duels(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); c uuid;
begin
  perform x_expire_duels();
  select crew_id into c from profiles where id = u;
  return jsonb_build_object(
    'open', coalesce((select jsonb_agg(x_duel_json(d.id, u) order by d.created_at desc) from duels d join profiles pc on pc.id = d.creator
                       where d.status = 'open' and d.creator <> u and pc.crew_id = c and (d.opponent is null or d.opponent = u)), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(x_duel_json(m.id, u) order by m.created_at desc) from (
                       select id, created_at from duels where (creator = u or opponent = u)
                          and (status in ('open', 'active') or coalesce(settled_at, created_at) > x_now() - interval '10 days')
                       order by created_at desc limit 40) m), '[]'::jsonb),
    'record', jsonb_build_object(
      'w', (select count(*) from duels where status = 'settled' and winner = u),
      'l', (select count(*) from duels where status = 'settled' and winner is not null and winner <> u and u in (creator, opponent)),
      't', (select count(*) from duels where status = 'settled' and winner is null and u in (creator, opponent))));
end $$;

-- Scores finished duels. Safe to run any number of times.
create or replace function x_settle_duels() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare d duels; n int := 0; pending int; have int; valid int; sc_c int; sc_o int; pot int; cut int; pct int := x_cfg_int('duel_cut_pct'); w uuid;
begin
  for d in select * from duels where status = 'active' order by created_at for update skip locked loop
    select count(*) into pending from duel_cards dc join cards c on c.id = dc.card_id where dc.duel_id = d.id and c.status = 'open';
    if pending > 0 then continue; end if;
    select count(*) into have from duel_cards where duel_id = d.id;
    if d.length = 'week' and have < d.target and x_et(x_now()) <= d.window_end then continue; end if;
    select count(*) into valid from duel_cards dc join cards c on c.id = dc.card_id where dc.duel_id = d.id and c.status = 'final' and c.outcome in ('a', 'b');
    select count(*) into sc_c from duel_cards dc join cards c on c.id = dc.card_id join picks p on p.duel_id = d.id and p.card_id = c.id and p.user_id = d.creator
      where dc.duel_id = d.id and c.status = 'final' and c.outcome in ('a', 'b') and p.side = c.outcome;
    select count(*) into sc_o from duel_cards dc join cards c on c.id = dc.card_id join picks p on p.duel_id = d.id and p.card_id = c.id and p.user_id = d.opponent
      where dc.duel_id = d.id and c.status = 'final' and c.outcome in ('a', 'b') and p.side = c.outcome;
    pot := d.stake * 2; cut := 0; w := null;
    if valid < 3 then
      perform x_refund(d.creator, d.id::text, d.stake, 'Duel void: not enough finished cards');
      perform x_refund(d.opponent, d.id::text, d.stake, 'Duel void: not enough finished cards');
      update duels set status = 'void', settled_at = x_now(), result = jsonb_build_object('valid', valid, 'reason', 'too_few_cards') where id = d.id;
    elsif sc_c = sc_o then
      perform x_refund(d.creator, d.id::text, d.stake, 'Duel tied: stake back');
      perform x_refund(d.opponent, d.id::text, d.stake, 'Duel tied: stake back');
      update duels set status = 'settled', settled_at = x_now(), result = jsonb_build_object('valid', valid, 'creator', sc_c, 'opponent', sc_o, 'tie', true) where id = d.id;
    else
      w := case when sc_c > sc_o then d.creator else d.opponent end;
      cut := floor(pot * pct / 100.0);
      perform x_pay(w, 'duel_win', d.id::text, pot - cut, 'Duel won');
      update duels set status = 'settled', winner = w, settled_at = x_now(), result = jsonb_build_object('valid', valid, 'creator', sc_c, 'opponent', sc_o, 'pot', pot, 'cut', cut) where id = d.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

/* ------------------------------------------------------- daily five (solo practice) */
create or replace function x_daily(p_day date) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare have int; pos0 int;
begin
  select count(*), coalesce(max(pos), 0) into have, pos0 from daily_five where day = p_day;
  if have >= 5 then return; end if;
  -- spread the five across sports: take turns between leagues, so no sport hogs it (3 at most when two or more sports are on)
  insert into daily_five (day, card_id, pos)
  select p_day, t.id, pos0 + t.k from (
    select id, row_number() over (order by rl, md5(p_day::text || id::text)) k from (
      select q.id, row_number() over (partition by q.league order by q.rn, md5(p_day::text || q.id::text)) + coalesce(h.n, 0) rl
      from (select c.id, c.league, row_number() over (partition by c.league, c.game_id order by md5(p_day::text || c.id::text)) rn
            from cards c where c.day = p_day and c.status = 'open' and c.start_at > x_now() + interval '5 minutes'
              and not exists (select 1 from daily_five f where f.day = p_day and f.card_id = c.id)) q
      left join (select c2.league, count(*) n from daily_five f2 join cards c2 on c2.id = f2.card_id where f2.day = p_day group by c2.league) h on h.league = q.league) r
    order by rl, md5(p_day::text || id::text) limit 5 - have) t;
end $$;

create or replace function hf_daily(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); today date := x_et(x_now()); pr profiles;
begin
  perform x_daily(today);
  select * into pr from profiles where id = u;
  return jsonb_build_object('day', today, 'coins_per_win', x_cfg_int('solo_coins'), 'streak', pr.solo_streak, 'best', pr.solo_best, 'last', pr.solo_last,
    'cards', coalesce((select jsonb_agg(x_card_json(c, u) || jsonb_build_object('mine', sp.side, 'result', sp.result) order by f.pos)
                       from daily_five f join cards c on c.id = f.card_id left join solo_picks sp on sp.card_id = c.id and sp.user_id = u where f.day = today), '[]'::jsonb));
end $$;

create or replace function hf_daily_pick(p_token text, p_card uuid, p_side text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); c cards; f daily_five;
begin
  if p_side not in ('a', 'b') then raise exception 'hf:bad_request'; end if;
  select * into f from daily_five where card_id = p_card;
  if not found then return x_fail('no_such_card'); end if;
  select * into c from cards where id = p_card;
  if c.status <> 'open' or c.start_at <= x_now() then return x_fail('locked'); end if;
  insert into solo_picks (user_id, card_id, day, side, made_at) values (u, p_card, f.day, p_side, x_now())
  on conflict (user_id, card_id) do update set side = excluded.side, made_at = excluded.made_at where solo_picks.result is null;
  return hf_daily(p_token);
end $$;

create or replace function x_settle_solo() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int; dy date; r record; v int; ok boolean; prev date; coins int := x_cfg_int('solo_coins');
begin
  update solo_picks sp set result = case when c.status = 'void' then 'void' when c.outcome = 'push' then 'push' when sp.side = c.outcome then 'win' else 'loss' end
    from cards c where c.id = sp.card_id and sp.result is null and c.status in ('final', 'void');
  get diagnostics n = row_count;
  insert into payouts (user_id, kind, ref, amount, note)
    select sp.user_id, 'solo', sp.card_id::text, coins, 'Daily Five' from solo_picks sp where sp.result = 'win' on conflict (user_id, kind, ref) do nothing;
  -- close each finished day once and update streaks, oldest day first
  for dy in select f.day from daily_five f where not exists (select 1 from solo_closed s where s.day = f.day)
              group by f.day having not exists (select 1 from daily_five f2 join cards c on c.id = f2.card_id where f2.day = f.day and c.status = 'open') order by f.day loop
    select count(*) into v from daily_five f join cards c on c.id = f.card_id where f.day = dy and c.status = 'final' and c.outcome in ('a', 'b');
    select max(day) into prev from solo_closed where day < dy;
    for r in select user_id, count(*) filter (where result = 'win') as correct from solo_picks where day = dy group by user_id loop
      ok := v > 0 and r.correct >= least(3, v);
      insert into solo_days (user_id, day, correct, valid) values (r.user_id, dy, r.correct, v) on conflict do nothing;
      update profiles set solo_streak = case when ok then (case when solo_last is not distinct from prev then solo_streak + 1 else 1 end) else 0 end,
                          solo_best = greatest(solo_best, case when ok then (case when solo_last is not distinct from prev then solo_streak + 1 else 1 end) else 0 end),
                          solo_last = dy where id = r.user_id;
    end loop;
    insert into solo_closed (day) values (dy);
  end loop;
  return n;
end $$;

/* --------------------------------------------------------------------- survivor */
-- NFL "weeks" run Tuesday to Monday. Everything else is one day at a time.
create or replace function x_period(p_league text, p_day date) returns date language sql immutable as
$$ select case when p_league = 'nfl' then p_day - ((extract(isodow from p_day)::int + 5) % 7) else p_day end $$;
create or replace function x_period_lock(p_league text, p_period date) returns timestamptz language sql stable security definer set search_path = public, pg_temp as
$$ select min(start_at) from games where league = p_league and status <> 'void' and x_period(league, day) = p_period $$;
create or replace function x_next_period(p_league text) returns date language sql stable security definer set search_path = public, pg_temp as
$$ select p from (select x_period(league, day) as p, min(start_at) as m from games where league = p_league and status <> 'void' group by 1) t
   where m > x_now() + interval '10 minutes' order by p limit 1 $$;
create or replace function x_period_after(p_league text, p_period date) returns date language sql stable security definer set search_path = public, pg_temp as
$$ select min(x_period(league, day)) from games where league = p_league and status <> 'void' and x_period(league, day) > p_period $$;

create or replace function x_survivor_eval(p_pool uuid, p_period date) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare pl survivor_pools; e survivor_entries; best record; before_alive uuid[]; alive_after int; winners uuid[]; pot int; share int; i int; r record;
begin
  select * into pl from survivor_pools where id = p_pool;
  select array_agg(user_id order by joined_at) into before_alive from survivor_entries where pool_id = pl.id and round = pl.round and alive;
  -- 1. anyone who forgot gets the favourite they have not used yet
  for e in select * from survivor_entries se where pool_id = pl.id and round = pl.round and alive
              and not exists (select 1 from survivor_picks sp where sp.pool_id = pl.id and sp.round = pl.round and sp.user_id = se.user_id and sp.period = p_period) loop
    select g.league as lg, g.game_id as gid, t.team_id into best from games g
      cross join lateral (values (g.home ->> 'id'), (g.away ->> 'id')) t(team_id)
      where g.league = pl.league and x_period(g.league, g.day) = p_period and g.status <> 'void'
        and not exists (select 1 from survivor_picks u where u.pool_id = pl.id and u.round = pl.round and u.user_id = e.user_id and u.team_id = t.team_id and u.result is distinct from 'void')
      order by case when t.team_id = g.fav_team then coalesce(g.fav_prob, 0.5) else 1 - coalesce(g.fav_prob, 0.5) end desc, t.team_id limit 1;
    if found then
      insert into survivor_picks (pool_id, round, user_id, period, team_id, game_league, game_id, auto) values (pl.id, pl.round, e.user_id, p_period, best.team_id, best.lg, best.gid, true);
    end if;
  end loop;
  -- 2. score every pick for this period
  update survivor_picks sp set result = case
      when g.status = 'void' or g.home_score is null or g.away_score is null then 'void'
      when g.home_score = g.away_score then 'tie'
      when (g.home ->> 'id' = sp.team_id) = (g.home_score > g.away_score) then 'won' else 'lost' end
    from games g where sp.pool_id = pl.id and sp.round = pl.round and sp.period = p_period and sp.result is null and g.league = sp.game_league and g.game_id = sp.game_id;
  update survivor_entries se set alive = false, out_period = p_period
    where se.pool_id = pl.id and se.round = pl.round and se.alive and exists (select 1 from survivor_picks sp where sp.pool_id = pl.id and sp.round = pl.round and sp.user_id = se.user_id and sp.period = p_period and sp.result = 'lost');
  select count(*) into alive_after from survivor_entries where pool_id = pl.id and round = pl.round and alive;
  update survivor_pools set last_period = p_period, cur_period = null where id = pl.id;
  -- 3. is the round over?
  if alive_after <= 1 then
    if alive_after = 1 then select array_agg(user_id) into winners from survivor_entries where pool_id = pl.id and round = pl.round and alive;
    else winners := before_alive; end if;
    select coalesce(sum(paid), 0) into pot from survivor_entries where pool_id = pl.id and round = pl.round;
    share := pot / greatest(coalesce(array_length(winners, 1), 1), 1);
    for i in 1..coalesce(array_length(winners, 1), 0) loop
      perform x_pay(winners[i], 'survivor', pl.id::text || ':' || pl.round, share + case when i = 1 then pot - share * array_length(winners, 1) else 0 end, 'Survivor won');
    end loop;
    insert into survivor_rounds (pool_id, round, winners, pot) values (pl.id, pl.round, (select coalesce(jsonb_agg(handle), '[]'::jsonb) from profiles where id = any (winners)), pot) on conflict do nothing;
    update survivor_pools set round = round + 1, status = 'open', first_period = null, cur_period = null, last_period = null where id = pl.id;
  end if;
end $$;

create or replace function x_survivor_tick() returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare pl survivor_pools; lock_at timestamptz; n int; guard int; nxt date; e record;
begin
  -- make sure each crew has a pool for each league in the settings
  insert into survivor_pools (crew_id, league, entry)
    select c.id, l.value, x_cfg_int('survivor_entry') from crews c cross join jsonb_array_elements_text(x_cfg('survivor_leagues')) l(value) on conflict (crew_id, league) do nothing;
  for pl in select * from survivor_pools order by id for update loop
    if pl.status = 'open' then
      if pl.first_period is null then
        update survivor_pools set first_period = x_next_period(pl.league) where id = pl.id;
      else
        lock_at := x_period_lock(pl.league, pl.first_period);
        if lock_at is not null and lock_at <= x_now() then
          select count(*) into n from survivor_entries where pool_id = pl.id and round = pl.round;
          if n >= 2 then
            update survivor_pools set status = 'live', cur_period = first_period where id = pl.id;
          else
            for e in select * from survivor_entries where pool_id = pl.id and round = pl.round loop
              perform x_refund(e.user_id, 'survivor:' || pl.id::text || ':' || pl.round, e.paid, 'Survivor round did not start: entry back');
            end loop;
            delete from survivor_entries where pool_id = pl.id and round = pl.round;
            update survivor_pools set first_period = x_next_period(pl.league) where id = pl.id;
          end if;
        end if;
      end if;
    end if;
    guard := 0;
    loop
      select * into pl from survivor_pools where id = pl.id;
      exit when pl.status <> 'live' or guard >= 30;
      guard := guard + 1;
      if pl.cur_period is null then
        nxt := case when pl.last_period is null then pl.first_period else x_period_after(pl.league, pl.last_period) end;
        exit when nxt is null;
        update survivor_pools set cur_period = nxt where id = pl.id;
        pl.cur_period := nxt;
      end if;
      -- wait until every game in the period has been scored
      exit when exists (select 1 from games g where g.league = pl.league and x_period(g.league, g.day) = pl.cur_period and g.settled_at is null);
      perform x_survivor_eval(pl.id, pl.cur_period);
    end loop;
  end loop;
end $$;

create or replace function hf_survivor(p_token text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); c uuid; res jsonb := '[]'::jsonb; pl survivor_pools; me survivor_entries; per date; opts jsonb; used jsonb; ent jsonb; lock_at timestamptz;
begin
  select crew_id into c from profiles where id = u;
  perform x_survivor_tick();
  for pl in select * from survivor_pools where crew_id = c order by league loop
    select * into me from survivor_entries where pool_id = pl.id and round = pl.round and user_id = u;
    per := case when pl.status = 'live' then pl.cur_period else pl.first_period end;
    lock_at := case when pl.first_period is not null and pl.status = 'open' then x_period_lock(pl.league, pl.first_period) end;
    select coalesce(jsonb_agg(jsonb_build_object('period', period, 'team_id', team_id, 'result', result, 'auto', auto, 'game_id', game_id) order by period), '[]'::jsonb) into used
      from survivor_picks where pool_id = pl.id and round = pl.round and user_id = u;
    select coalesce(jsonb_agg(jsonb_build_object('game_id', g.game_id, 'start_at', g.start_at, 'status', g.status, 'home', g.home, 'away', g.away, 'fav_team', g.fav_team, 'fav_prob', g.fav_prob,
        'home_score', g.home_score, 'away_score', g.away_score) order by g.start_at), '[]'::jsonb) into opts
      from games g where g.league = pl.league and per is not null and x_period(g.league, g.day) = per and g.status <> 'void';
    select coalesce(jsonb_agg(jsonb_build_object('handle', p.handle, 'display', coalesce(p.display, p.handle), 'alive', e.alive, 'out_period', e.out_period,
        'pick', (select jsonb_build_object('team_id', sp.team_id, 'result', sp.result, 'auto', sp.auto) from survivor_picks sp where sp.pool_id = e.pool_id and sp.round = e.round and sp.user_id = e.user_id and sp.period = per
                   and (sp.result is not null or (select g.start_at <= x_now() from games g where g.league = sp.game_league and g.game_id = sp.game_id)))
      ) order by e.alive desc, p.handle), '[]'::jsonb) into ent
      from survivor_entries e join profiles p on p.id = e.user_id where e.pool_id = pl.id and e.round = pl.round;
    res := res || jsonb_build_array(jsonb_build_object(
      'id', pl.id, 'league', pl.league, 'round', pl.round, 'status', pl.status, 'entry', pl.entry, 'period', per, 'lock_at', lock_at,
      'pot', coalesce((select sum(paid) from survivor_entries where pool_id = pl.id and round = pl.round), 0),
      'joined', me.user_id is not null, 'alive', coalesce(me.alive, false), 'picks', used, 'games', opts, 'entries', ent,
      'last', (select jsonb_build_object('round', r.round, 'winners', r.winners, 'pot', r.pot) from survivor_rounds r where r.pool_id = pl.id order by r.round desc limit 1)));
  end loop;
  return jsonb_build_object('pools', res);
end $$;

create or replace function hf_survivor_join(p_token text, p_pool uuid, p_op text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); pl survivor_pools; me profiles; lock_at timestamptz;
begin
  if p_op is null or length(p_op) < 8 then raise exception 'hf:bad_request'; end if;
  if exists (select 1 from ops where user_id = u and op = p_op) then return jsonb_build_object('ok', true); end if;
  perform x_survivor_tick();
  select * into pl from survivor_pools where id = p_pool for update;
  select * into me from profiles where id = u;
  if not found or pl.crew_id <> me.crew_id then return x_fail('not_yours'); end if;
  if pl.status <> 'open' or pl.first_period is null then return x_fail('closed'); end if;
  lock_at := x_period_lock(pl.league, pl.first_period);
  if lock_at is null or lock_at <= x_now() then return x_fail('closed'); end if;
  if exists (select 1 from survivor_entries where pool_id = pl.id and round = pl.round and user_id = u) then return x_fail('already_in'); end if;
  insert into survivor_entries (pool_id, round, user_id, paid) values (pl.id, pl.round, u, pl.entry);
  insert into ops (user_id, op, kind, ref) values (u, p_op, 'survivor_join', pl.id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function hf_survivor_leave(p_token text, p_pool uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); pl survivor_pools; e survivor_entries; lock_at timestamptz;
begin
  select * into pl from survivor_pools where id = p_pool for update;
  select * into e from survivor_entries where pool_id = p_pool and round = pl.round and user_id = u;
  if not found then return x_fail('not_in'); end if;
  lock_at := x_period_lock(pl.league, pl.first_period);
  if pl.status <> 'open' or lock_at is null or lock_at <= x_now() then return x_fail('closed'); end if;
  delete from survivor_entries where pool_id = p_pool and round = pl.round and user_id = u;
  perform x_refund(u, 'survivor:' || pl.id::text || ':' || pl.round, e.paid, 'Left Survivor: entry back');
  return jsonb_build_object('ok', true);
end $$;

create or replace function hf_survivor_pick(p_token text, p_pool uuid, p_game text, p_team text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); pl survivor_pools; e survivor_entries; g games; per date; old survivor_picks;
begin
  select * into pl from survivor_pools where id = p_pool;
  if not found then return x_fail('no_such_pool'); end if;
  select * into e from survivor_entries where pool_id = pl.id and round = pl.round and user_id = u;
  if not found or not e.alive then return x_fail('not_in'); end if;
  per := case when pl.status = 'live' then pl.cur_period else pl.first_period end;
  if per is null then return x_fail('closed'); end if;
  select * into g from games where league = pl.league and game_id = p_game;
  if not found or x_period(g.league, g.day) <> per or g.status = 'void' then return x_fail('no_such_game'); end if;
  if g.start_at <= x_now() then return x_fail('locked'); end if;
  if p_team not in (g.home ->> 'id', g.away ->> 'id') then return x_fail('no_such_team'); end if;
  select * into old from survivor_picks where pool_id = pl.id and round = pl.round and user_id = u and period = per;
  if found and (select start_at from games where league = old.game_league and game_id = old.game_id) <= x_now() then return x_fail('locked'); end if;
  if exists (select 1 from survivor_picks where pool_id = pl.id and round = pl.round and user_id = u and team_id = p_team and period <> per and result is distinct from 'void') then return x_fail('team_used'); end if;
  insert into survivor_picks (pool_id, round, user_id, period, team_id, game_league, game_id, auto, made_at) values (pl.id, pl.round, u, per, p_team, g.league, g.game_id, false, x_now())
  on conflict (pool_id, round, user_id, period) do update set team_id = excluded.team_id, game_league = excluded.game_league, game_id = excluded.game_id, auto = false, made_at = excluded.made_at;
  return jsonb_build_object('ok', true);
end $$;

/* --------------------------------------------------------------------- cap night */
create or replace function x_fantasy(s jsonb) returns numeric language sql immutable as $$
  select round(coalesce((s ->> 'pts')::numeric, 0) + 1.2 * coalesce((s ->> 'reb')::numeric, 0) + 1.5 * coalesce((s ->> 'ast')::numeric, 0)
             + 3 * coalesce((s ->> 'stl')::numeric, 0) + 3 * coalesce((s ->> 'blk')::numeric, 0) - coalesce((s ->> 'to')::numeric, 0), 1) $$;
create or replace function x_week_start(d date) returns date language sql immutable as $$ select d - (extract(isodow from d)::int - 1) $$;

create or replace function hf_cap(p_token text, p_day date default null) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); c uuid; today date := x_et(x_now()); dy date; wk date; lu cap_lineups; board jsonb; wkb jsonb;
begin
  select crew_id into c from profiles where id = u;
  dy := coalesce(p_day, case when exists (select 1 from cap_players where day = today) then today
                              when exists (select 1 from cap_players where day = today + 1) then today + 1
                              else (select max(day) from cap_players where day < today) end, today);
  wk := x_week_start(dy);
  select * into lu from cap_lineups where user_id = u and day = dy;
  select coalesce(jsonb_agg(jsonb_build_object('name', q.display, 'handle', q.handle, 'me', q.id = u, 'count', q.cnt, 'score', q.score, 'final', q.final, 'picks', q.picks) order by q.score desc, q.handle), '[]'::jsonb) into board
  from (
    select p.id, p.handle, coalesce(p.display, p.handle) as display, coalesce(array_length(l.players, 1), 0) as cnt,
           coalesce((select sum(cs.score) from cap_stats cs where cs.day = l.day and cs.player_id = any (l.players)), 0) as score,
           exists (select 1 from cap_days cd where cd.day = l.day) as final,
           (select coalesce(jsonb_agg(jsonb_build_object('id', cp.player_id, 'name', cp.name, 'team', cp.team_abbr, 'score', cs.score, 'dnp', cs.dnp) order by cp.price desc, cp.name), '[]'::jsonb)
              from cap_players cp join games g on g.league = cp.league and g.game_id = cp.game_id left join cap_stats cs on cs.day = cp.day and cs.player_id = cp.player_id
             where cp.day = l.day and cp.player_id = any (l.players) and (l.user_id = u or g.start_at <= x_now())) as picks
      from profiles p join cap_lineups l on l.user_id = p.id and l.day = dy where p.crew_id = c and p.active) q;
  with n as (
      select cn.user_id, cn.day, cn.score from cap_nights cn where cn.day between wk and wk + 6
      union all
      select l.user_id, l.day, coalesce((select sum(cs.score) from cap_stats cs where cs.day = l.day and cs.player_id = any (l.players)), 0)
        from cap_lineups l where l.day between wk and wk + 6 and not exists (select 1 from cap_days cd where cd.day = l.day)
    ), rk as (select user_id, day, score, row_number() over (partition by user_id order by score desc) rn from n)
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.display, p.handle), 'handle', p.handle, 'me', p.id = u, 'total', t.total, 'nights', t.nights) order by t.total desc), '[]'::jsonb) into wkb
    from (select user_id, sum(score) filter (where rn <= 5) as total, count(*) as nights from rk group by user_id) t join profiles p on p.id = t.user_id and p.crew_id = c and p.active;
  return jsonb_build_object('day', dy, 'week', wk, 'budget', x_cfg_int('cap_budget'), 'max_per_team', 2, 'slots', 5,
    'night_prize', x_cfg_int('cap_night_prize'), 'week_prize', x_cfg_int('cap_week_prize'),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', cp.player_id, 'name', cp.name, 'team_id', cp.team_id, 'team', cp.team_abbr, 'pos', cp.pos, 'face', cp.face,
        'price', cp.price, 'avg', cp.avg, 'game_id', cp.game_id, 'start_at', g.start_at, 'score', cs.score, 'dnp', coalesce(cs.dnp, false), 'stats', cs.stats) order by cp.price desc, cp.name)
        from cap_players cp join games g on g.league = cp.league and g.game_id = cp.game_id left join cap_stats cs on cs.day = cp.day and cs.player_id = cp.player_id where cp.day = dy), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(day order by day) from (select distinct day from cap_players where day between today - 7 and today + 1) z), '[]'::jsonb),
    'mine', to_jsonb(coalesce(lu.players, '{}'::text[])), 'cost', coalesce(lu.cost, 0), 'closed', exists (select 1 from cap_days where day = dy),
    'board', board, 'week_board', wkb);
end $$;

create or replace function hf_cap_set(p_token text, p_day date, p_players text[]) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := x_uid(p_token); old text[]; cost int; n int; bad int; today date := x_et(x_now()); pid text; ps text[];
begin
  p_players := coalesce(p_players, '{}');
  if p_day < today - 1 or p_day > today + 1 then return x_fail('bad_day'); end if;
  select array(select distinct x from unnest(p_players) x) into ps;
  if array_length(ps, 1) is distinct from array_length(p_players, 1) then return x_fail('duplicate'); end if;
  if coalesce(array_length(ps, 1), 0) > 5 then return x_fail('too_many'); end if;
  select count(*), coalesce(sum(price), 0) into n, cost from cap_players where day = p_day and player_id = any (ps);
  if n <> coalesce(array_length(ps, 1), 0) then return x_fail('unknown_player'); end if;
  if cost > x_cfg_int('cap_budget') then return x_fail('over_cap'); end if;
  if exists (select 1 from cap_players where day = p_day and player_id = any (ps) group by team_id having count(*) > 2) then return x_fail('team_limit'); end if;
  select players into old from cap_lineups where user_id = u and day = p_day;
  old := coalesce(old, '{}');
  -- a player whose game has started stays put; nobody can be added after tip-off
  for pid in select unnest(old) loop
    if not (pid = any (ps)) and exists (select 1 from cap_players cp join games g on g.league = cp.league and g.game_id = cp.game_id where cp.day = p_day and cp.player_id = pid and g.start_at <= x_now()) then return x_fail('locked'); end if;
  end loop;
  for pid in select unnest(ps) loop
    if not (pid = any (old)) and exists (select 1 from cap_players cp join games g on g.league = cp.league and g.game_id = cp.game_id where cp.day = p_day and cp.player_id = pid and g.start_at <= x_now()) then return x_fail('locked'); end if;
  end loop;
  if exists (select 1 from cap_days where day = p_day) then return x_fail('locked'); end if;
  insert into cap_lineups (user_id, day, players, cost, updated_at) values (u, p_day, ps, cost, x_now())
  on conflict (user_id, day) do update set players = excluded.players, cost = excluded.cost, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'cost', cost);
end $$;

create or replace function x_cap_finalize() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare dy date; wk date; n int := 0; top numeric; cnt int; r record; prize int;
begin
  for dy in select distinct cp.day from cap_players cp where not exists (select 1 from cap_days cd where cd.day = cp.day)
              and not exists (select 1 from cap_players c2 join games g on g.league = c2.league and g.game_id = c2.game_id where c2.day = cp.day and g.settled_at is null) order by 1 loop
    insert into cap_nights (day, user_id, score, picks)
      select l.day, l.user_id, coalesce((select sum(cs.score) from cap_stats cs where cs.day = l.day and cs.player_id = any (l.players)), 0),
             coalesce((select jsonb_agg(jsonb_build_object('id', cp.player_id, 'name', cp.name, 'score', coalesce(cs.score, 0))) from cap_players cp left join cap_stats cs on cs.day = cp.day and cs.player_id = cp.player_id where cp.day = l.day and cp.player_id = any (l.players)), '[]')
        from cap_lineups l where l.day = dy and coalesce(array_length(l.players, 1), 0) > 0 on conflict do nothing;
    select max(score), count(*) into top, cnt from cap_nights where day = dy;
    prize := x_cfg_int('cap_night_prize');
    if cnt >= 2 and top > 0 then
      for r in select user_id from cap_nights where day = dy and score = top loop perform x_pay(r.user_id, 'cap_night', dy::text, prize, 'Cap Night winner'); end loop;
    end if;
    insert into cap_days (day) values (dy);
    n := n + 1;
  end loop;
  -- a week closes once it is over and all of its nights are scored
  for wk in select distinct x_week_start(cd.day) from cap_days cd where x_week_start(cd.day) + 6 < x_et(x_now()) and not exists (select 1 from cap_weeks w where w.week = x_week_start(cd.day)) order by 1 loop
    continue when exists (select 1 from cap_players cp where cp.day between wk and wk + 6 and not exists (select 1 from cap_days d2 where d2.day = cp.day));
    with rk as (select user_id, score, row_number() over (partition by user_id order by score desc) rn from cap_nights where day between wk and wk + 6),
         t as (select user_id, sum(score) total from rk where rn <= 5 group by user_id)
    select max(total), count(*) into top, cnt from t;
    if cnt >= 2 and top > 0 then
      for r in with q as (select user_id, score, row_number() over (partition by user_id order by score desc) rn from cap_nights where day between wk and wk + 6),
                    t as (select user_id, sum(score) total from q where rn <= 5 group by user_id) select user_id from t where total = top loop
        perform x_pay(r.user_id, 'cap_week', wk::text, x_cfg_int('cap_week_prize'), 'Cap Night weekly winner');
      end loop;
    end if;
    insert into cap_weeks (week) values (wk);
  end loop;
  return n;
end $$;

/* ------------------------------------------------------------- settle (bots call these) */
create or replace function x_settle_games() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare g games; n int := 0;
begin
  -- a game nobody reported for 3 days is treated as called off
  update games set status = 'void', final_at = x_now() - interval '1 hour' where final_at is null and settled_at is null and start_at < x_now() - interval '3 days';
  for g in select * from games where final_at is not null and settled_at is null and final_at + interval '30 minutes' <= x_now() for update skip locked loop
    update games set settled_at = x_now() where league = g.league and game_id = g.game_id;
    if g.status = 'void' or g.home_score is null or g.away_score is null then
      update cards set status = 'void', settled_at = x_now() where league = g.league and game_id = g.game_id and status = 'open';
    else
      update cards c set status = 'final', settled_at = x_now(),
        actual = case c.kind when 'winner' then g.home_score - g.away_score when 'total' then g.home_score + g.away_score
                             when 'team_total' then case c.subject when 'home' then g.home_score else g.away_score end else c.actual end,
        outcome = case c.kind
          when 'winner' then case when g.home_score > g.away_score then 'a' when g.home_score < g.away_score then 'b' else 'push' end
          when 'total' then case when g.home_score + g.away_score > c.line then 'a' when g.home_score + g.away_score < c.line then 'b' else 'push' end
          when 'team_total' then case when (case c.subject when 'home' then g.home_score else g.away_score end) > c.line then 'a' when (case c.subject when 'home' then g.home_score else g.away_score end) < c.line then 'b' else 'push' end
          else case when c.actual > c.line then 'a' when c.actual < c.line then 'b' else 'push' end end
       where c.league = g.league and c.game_id = g.game_id and c.status = 'open' and (c.kind <> 'player' or c.actual is not null);
      update cards set status = 'void', settled_at = x_now() where league = g.league and game_id = g.game_id and status = 'open' and kind = 'player' and actual is null;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function x_settle_all() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare g int; d int; s int; e int; c int; w int;
begin
  e := x_expire_duels();
  g := x_settle_games();
  w := x_fill_week_duels();
  d := x_settle_duels();
  s := x_settle_solo();
  perform x_survivor_tick();
  c := x_cap_finalize();
  delete from throttle where at < x_now() - interval '1 day';
  return jsonb_build_object('games', g, 'duels', d, 'solo', s, 'cap_nights', c, 'expired', e, 'week_fill', w);
end $$;

-- 8am: publish today's games, cards and Cap Night players. Existing cards are never changed, so lines stay frozen.
create or replace function bot_publish(p_games jsonb, p_cards jsonb default '[]', p_cap jsonb default '[]') returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare g jsonb; c jsonb; n_games int := 0; n_cards int := 0; n_cap int := 0; ts timestamptz; k int;
begin
  for g in select * from jsonb_array_elements(coalesce(p_games, '[]')) loop
    ts := (g ->> 'start_at')::timestamptz;
    insert into games (league, game_id, day, start_at, home, away, fav_team, fav_prob, ou, home_spread)
    values (g ->> 'league', g ->> 'game_id', x_et(ts), ts, g -> 'home', g -> 'away', g ->> 'fav_team', (g ->> 'fav_prob')::numeric, (g ->> 'ou')::numeric, (g ->> 'home_spread')::numeric)
    on conflict (league, game_id) do update set
      day = case when games.start_at > x_now() then excluded.day else games.day end,
      start_at = case when games.start_at > x_now() then excluded.start_at else games.start_at end,
      fav_team = case when games.start_at > x_now() then excluded.fav_team else games.fav_team end,
      fav_prob = case when games.start_at > x_now() then excluded.fav_prob else games.fav_prob end,
      ou = case when games.start_at > x_now() then excluded.ou else games.ou end,
      home_spread = case when games.start_at > x_now() then excluded.home_spread else games.home_spread end;
    n_games := n_games + 1;
  end loop;
  for c in select * from jsonb_array_elements(coalesce(p_cards, '[]')) loop
    insert into cards (day, league, game_id, kind, subject, title, a_label, b_label, line, start_at, meta)
    select gm.day, gm.league, gm.game_id, c ->> 'kind', c ->> 'subject', c ->> 'title', c ->> 'a', c ->> 'b', (c ->> 'line')::numeric, gm.start_at, coalesce(c -> 'meta', '{}')
      from games gm where gm.league = c ->> 'league' and gm.game_id = c ->> 'game_id' and gm.status = 'pre' and gm.start_at > x_now()
    on conflict (league, game_id, kind, subject) do update set line = excluded.line, title = excluded.title
      where cards.status = 'open' and cards.kind = 'team_total' and cards.line < 0; -- repairs the bad team lines an earlier version wrote
    get diagnostics k = row_count;
    n_cards := n_cards + k;
  end loop;
  -- a game that moved: carry the new start time to its open cards
  update cards c set start_at = g2.start_at, day = g2.day from games g2 where g2.league = c.league and g2.game_id = c.game_id and c.status = 'open' and g2.start_at > x_now() and (c.start_at <> g2.start_at or c.day <> g2.day);
  for c in select * from jsonb_array_elements(coalesce(p_cap, '[]')) loop
    insert into cap_players (day, player_id, league, game_id, name, team_id, team_abbr, pos, face, price, avg)
    select gm.day, c ->> 'player_id', gm.league, gm.game_id, c ->> 'name', c ->> 'team_id', c ->> 'team_abbr', c ->> 'pos', c ->> 'face', (c ->> 'price')::int, (c ->> 'avg')::numeric
      from games gm where gm.league = coalesce(c ->> 'league', 'nba') and gm.game_id = c ->> 'game_id' and gm.start_at > x_now()
    on conflict (day, player_id) do nothing;
    get diagnostics k = row_count;
    n_cap := n_cap + k;
  end loop;
  perform x_fill_week_duels();
  perform x_survivor_tick();
  return jsonb_build_object('games', n_games, 'cards_new', n_cards, 'cap_new', n_cap);
end $$;

-- What the settle bot has to look at: games that have started and are not scored yet.
create or replace function bot_pending() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return jsonb_build_object(
    'games', coalesce((select jsonb_agg(jsonb_build_object('league', league, 'game_id', game_id, 'day', day, 'start_at', start_at, 'final_at', final_at)) from games
                        where settled_at is null and start_at <= x_now() and start_at > x_now() - interval '3 days'), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'league', c.league, 'game_id', c.game_id, 'subject', c.subject, 'line', c.line, 'meta', c.meta)) from cards c
                        join games g on g.league = c.league and g.game_id = c.game_id
                       where c.kind = 'player' and c.status = 'open' and g.settled_at is null and g.start_at <= x_now()), '[]'::jsonb),
    'cap', coalesce((select jsonb_agg(jsonb_build_object('day', cp.day, 'player_id', cp.player_id, 'league', cp.league, 'game_id', cp.game_id, 'name', cp.name)) from cap_players cp
                      join games g on g.league = cp.league and g.game_id = cp.game_id
                     where g.settled_at is null and g.start_at <= x_now() and not exists (select 1 from cap_days cd where cd.day = cp.day)), '[]'::jsonb));
end $$;

-- Results from the settle bot. p_games: [{league, game_id, state, home_score, away_score, void}]
-- p_actuals: [{card_id, actual}]   p_cap: [{day, player_id, dnp, stats:{pts,reb,ast,stl,blk,to}}]
create or replace function bot_results(p_games jsonb default '[]', p_actuals jsonb default '[]', p_cap jsonb default '[]') returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare g jsonb; a jsonb; p jsonb;
begin
  for g in select * from jsonb_array_elements(coalesce(p_games, '[]')) loop
    update games set
      status = case when (g ->> 'void')::boolean then 'void' when g ->> 'state' = 'post' then 'post' when g ->> 'state' = 'in' then 'in' else status end,
      home_score = case when g ->> 'state' in ('in', 'post') then coalesce((g ->> 'home_score')::int, home_score) else home_score end,
      away_score = case when g ->> 'state' in ('in', 'post') then coalesce((g ->> 'away_score')::int, away_score) else away_score end,
      final_at = case when final_at is null and ((g ->> 'state') = 'post' or (g ->> 'void')::boolean) then x_now() else final_at end
     where league = g ->> 'league' and game_id = g ->> 'game_id' and settled_at is null;
  end loop;
  for a in select * from jsonb_array_elements(coalesce(p_actuals, '[]')) loop
    update cards set actual = (a ->> 'actual')::numeric where id = (a ->> 'card_id')::uuid and status = 'open' and kind = 'player';
  end loop;
  for p in select * from jsonb_array_elements(coalesce(p_cap, '[]')) loop
    insert into cap_stats (day, player_id, stats, dnp, score)
    values ((p ->> 'day')::date, p ->> 'player_id', coalesce(p -> 'stats', '{}'), coalesce((p ->> 'dnp')::boolean, false), case when coalesce((p ->> 'dnp')::boolean, false) then 0 else x_fantasy(p -> 'stats') end)
    on conflict (day, player_id) do update set stats = excluded.stats, dnp = excluded.dnp, score = excluded.score
      where not exists (select 1 from cap_days cd where cd.day = cap_stats.day);
  end loop;
  return x_settle_all();
end $$;

/* ------------------------------------------------------------- lock everything down */
do $$
declare r record;
begin
  for r in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('revoke all on table public.%I from anon, authenticated', r.relname);
  end loop;
  for r in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'hf\_%' or p.proname like 'x\_%' or p.proname like 'bot\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.proname like 'hf\_%' then
      execute format('grant execute on function %s to anon, authenticated, service_role', r.sig);
    else
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
  end loop;
end $$;

/* ------------------------------------------------------------- your crew and first invite */
insert into crews (name) select 'Crew' where not exists (select 1 from crews);
insert into invites (code, crew_id, owner, max_uses)
select 'HF' || substr(x_norm(encode(extensions.gen_random_bytes(8), 'base64')), 1, 6), (select id from crews order by created_at limit 1), true, 1
where not exists (select 1 from invites where owner) and not exists (select 1 from profiles where is_owner);

-- The last result shown is your first invite code. Open the app, tap Crew, and paste it to make your account.
select coalesce((select code from invites where owner and uses = 0 and not revoked order by created_at limit 1),
                '(already used: your account exists. Use Crew > Invite a friend in the app)') as your_first_invite_code;
