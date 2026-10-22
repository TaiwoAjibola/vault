-- Keyhold MVP schema
--
-- Threat model note: all secret material (application name, URL, username,
-- password, notes) is encrypted in the browser before it reaches Postgres.
-- The columns below store only ciphertext plus the minimum metadata needed for
-- ownership, ordering, and audit display.

create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  kdf_salt text not null,
  kdf_iterations integer not null default 600000
    check (kdf_iterations between 100000 and 2000000),
  wrapped_dek text not null,
  wrapped_dek_iv text not null,
  recovery_salt text not null,
  recovery_iterations integer not null default 600000
    check (recovery_iterations between 100000 and 2000000),
  recovery_wrapped_dek text not null,
  recovery_wrapped_dek_iv text not null,
  encryption_version smallint not null default 1 check (encryption_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vaults_wrapped_dek_length check (length(wrapped_dek) between 24 and 4096),
  constraint vaults_wrapped_dek_iv_length check (length(wrapped_dek_iv) between 12 and 64),
  constraint vaults_recovery_wrapped_dek_length check (length(recovery_wrapped_dek) between 24 and 4096),
  constraint vaults_recovery_wrapped_dek_iv_length check (length(recovery_wrapped_dek_iv) between 12 and 64)
);

create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vault_id uuid not null references public.vaults (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  encryption_version smallint not null default 1 check (encryption_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_retrieved_at timestamptz,
  constraint credentials_ciphertext_length check (length(ciphertext) between 24 and 65536),
  constraint credentials_iv_length check (length(iv) between 12 and 64)
);

create table if not exists public.vault_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  credential_id uuid,
  event_type text not null check (event_type in ('created', 'updated', 'retrieved', 'deleted')),
  created_at timestamptz not null default now()
);

create index if not exists credentials_user_updated_idx
  on public.credentials (user_id, updated_at desc);
create index if not exists credentials_user_last_retrieved_idx
  on public.credentials (user_id, last_retrieved_at desc nulls last);
create index if not exists vault_events_user_created_idx
  on public.vault_events (user_id, created_at desc);
create index if not exists vault_events_credential_idx
  on public.vault_events (credential_id, created_at desc);

-- ---------------------------------------------------------------- functions

create or replace function public.keyhold_touch_vault()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.keyhold_touch_credential()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Retrieval should not masquerade as a content edit.
  if new.ciphertext is distinct from old.ciphertext
     or new.iv is distinct from old.iv then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.keyhold_guard_credential()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.vault_id is distinct from old.vault_id then
      raise exception 'credential ownership is immutable' using errcode = '42501';
    end if;
  end if;

  select user_id into owner_id from public.vaults where id = new.vault_id;
  if owner_id is null or owner_id is distinct from new.user_id then
    raise exception 'credential vault does not belong to user' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.keyhold_log_credential_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.vault_events (user_id, credential_id, event_type)
    values (new.user_id, new.id, 'created');
    return new;
  elsif tg_op = 'UPDATE' then
    if new.ciphertext is distinct from old.ciphertext
       or new.iv is distinct from old.iv then
      insert into public.vault_events (user_id, credential_id, event_type)
      values (new.user_id, new.id, 'updated');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.vault_events (user_id, credential_id, event_type)
    values (old.user_id, old.id, 'deleted');
    return old;
  end if;
  return null;
end;
$$;

create or replace trigger vaults_touch_updated_at
  before update on public.vaults
  for each row execute function public.keyhold_touch_vault();

create or replace trigger credentials_touch_updated_at
  before update on public.credentials
  for each row execute function public.keyhold_touch_credential();

create or replace trigger credentials_guard_ownership
  before insert or update on public.credentials
  for each row execute function public.keyhold_guard_credential();

create or replace trigger credentials_audit
  after insert or update or delete on public.credentials
  for each row execute function public.keyhold_log_credential_event();

-- Records a deliberate reveal/copy/fill and returns the fresh timestamp.
create or replace function public.mark_credential_retrieved(p_credential_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  stamped timestamptz := now();
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.credentials
     set last_retrieved_at = stamped
   where id = p_credential_id
     and user_id = caller;

  if not found then
    raise exception 'credential not found' using errcode = 'P0002';
  end if;

  insert into public.vault_events (user_id, credential_id, event_type)
  values (caller, p_credential_id, 'retrieved');

  return stamped;
end;
$$;

-- Hard-deletes a user's entire vault. Runs as a single transaction so audit
-- rows cannot be left behind pointing at removed credentials.
create or replace function public.delete_vault_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Delete credentials first so their audit triggers run, then clear the
  -- events they just wrote.
  delete from public.credentials where user_id = caller;
  delete from public.vault_events where user_id = caller;
  delete from public.vaults where user_id = caller;
end;
$$;

-- ---------------------------------------------------------------- privileges

alter table public.vaults enable row level security;
alter table public.credentials enable row level security;
alter table public.vault_events enable row level security;

revoke all on public.vaults from anon;
revoke all on public.credentials from anon;
revoke all on public.vault_events from anon;

grant select, insert, update, delete on public.vaults to authenticated;
grant select, insert, update, delete on public.credentials to authenticated;
grant select on public.vault_events to authenticated;

revoke insert, update, delete on public.vault_events from authenticated;
revoke all on public.vault_events from anon;

revoke all on function public.keyhold_guard_credential() from public, anon, authenticated;
revoke all on function public.keyhold_log_credential_event() from public, anon, authenticated;
revoke all on function public.keyhold_touch_vault() from public, anon, authenticated;
revoke all on function public.keyhold_touch_credential() from public, anon, authenticated;
revoke all on function public.mark_credential_retrieved(uuid) from public, anon;
revoke all on function public.delete_vault_data() from public, anon;
grant execute on function public.mark_credential_retrieved(uuid) to authenticated;
grant execute on function public.delete_vault_data() to authenticated;

drop policy if exists "vaults_select_own" on public.vaults;
drop policy if exists "vaults_insert_own" on public.vaults;
drop policy if exists "vaults_update_own" on public.vaults;
create policy "vaults_select_own"
  on public.vaults for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "vaults_insert_own" on public.vaults;
create policy "vaults_insert_own"
  on public.vaults for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "vaults_update_own" on public.vaults;
create policy "vaults_update_own"
  on public.vaults for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "credentials_select_own" on public.credentials;
drop policy if exists "credentials_insert_own" on public.credentials;
drop policy if exists "credentials_update_own" on public.credentials;
drop policy if exists "credentials_delete_own" on public.credentials;
create policy "credentials_select_own"
  on public.credentials for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "credentials_insert_own"
  on public.credentials for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "credentials_update_own"
  on public.credentials for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "credentials_delete_own"
  on public.credentials for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "vault_events_select_own" on public.vault_events;
create policy "vault_events_select_own"
  on public.vault_events for select to authenticated
  using ((select auth.uid()) = user_id);
