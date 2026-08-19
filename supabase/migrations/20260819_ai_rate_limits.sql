-- AI-route rate limiting (security audit finding 4).
--
-- A durable, cross-instance rate-limit counter. Serverless functions are
-- ephemeral and horizontally scaled, so an in-memory limiter can't reliably
-- cap a single user's request loop — this table + the atomic RPC below give a
-- global fixed-window counter shared by every instance.
--
-- Accessed ONLY via the service-role client (lib/ai/rateLimit.ts). RLS is
-- enabled with no policies so the anon/authenticated roles cannot read or
-- write it directly.

create table if not exists ai_rate_limits (
  bucket_key   text primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

alter table ai_rate_limits enable row level security;
-- No policies: deny all to anon/authenticated. Service role bypasses RLS.

-- Atomic fixed-window check-and-increment. Returns TRUE if the caller is within
-- the limit for the current window, FALSE if it should be rejected. The whole
-- read-modify-write happens in a single statement so concurrent calls can't
-- race past the limit.
create or replace function check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into ai_rate_limits as r (bucket_key, window_start, count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
    set
      count = case
                when r.window_start < now() - make_interval(secs => p_window_seconds)
                then 1
                else r.count + 1
              end,
      window_start = case
                when r.window_start < now() - make_interval(secs => p_window_seconds)
                then now()
                else r.window_start
              end
  returning r.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Opportunistic cleanup helper: callable from a cron to drop stale buckets.
-- Not required for correctness (stale rows are simply reset in place).
create or replace function prune_ai_rate_limits(p_older_than_seconds integer default 86400)
returns void
language sql
as $$
  delete from ai_rate_limits
  where window_start < now() - make_interval(secs => p_older_than_seconds);
$$;
