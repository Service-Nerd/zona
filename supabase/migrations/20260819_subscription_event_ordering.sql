-- Subscription webhook ordering / idempotency guard (security audit finding 10).
--
-- Stripe (and RevenueCat) do not guarantee delivery order. A stale
-- `customer.subscription.updated` arriving AFTER a `deleted` could re-activate a
-- cancelled subscription via the plain upsert. This records the source event's
-- timestamp and only applies a write when the incoming event is newer than the
-- last one applied — making the webhook both idempotent (duplicate deliveries
-- are no-ops) and order-independent.

alter table subscriptions add column if not exists last_event_at timestamptz;

-- Atomic conditional upsert. Returns TRUE if the event was applied, FALSE if it
-- was suppressed as stale/out-of-order. The whole check-and-write is one
-- statement so concurrent deliveries can't race.
create or replace function apply_subscription_event(
  p_user_id    uuid,
  p_provider   text,
  p_status     text,
  p_period_end timestamptz,
  p_event_at   timestamptz
) returns boolean
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into subscriptions as s
    (user_id, provider, status, current_period_end, last_event_at, updated_at)
  values
    (p_user_id, p_provider, p_status, p_period_end, p_event_at, now())
  on conflict (user_id) do update
    set provider           = excluded.provider,
        status             = excluded.status,
        current_period_end = excluded.current_period_end,
        last_event_at      = excluded.last_event_at,
        updated_at         = now()
    where s.last_event_at is null
       or excluded.last_event_at is null
       or s.last_event_at <= excluded.last_event_at;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
