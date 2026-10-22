-- Fixes account deletion.
--
-- Deleting an auth user cascades to vaults, credentials, and audit rows. The
-- credential audit trigger fired during that cascade and tried to insert a
-- `vault_events` row for a user that no longer existed, which violated the
-- `vault_events_user_id_fkey` foreign key and failed the whole delete with a
-- 500. The audit trail of a deleted account is cascade-deleted with it, so the
-- event is not worth writing in that case.

create or replace function public.keyhold_log_credential_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    -- NEW is not assigned on delete, so this branch is checked first.
    if exists (select 1 from auth.users where id = old.user_id) then
      insert into public.vault_events (user_id, credential_id, event_type)
      values (old.user_id, old.id, 'deleted');
    end if;
    return old;
  end if;

  if not exists (select 1 from auth.users where id = new.user_id) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.vault_events (user_id, credential_id, event_type)
    values (new.user_id, new.id, 'created');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.ciphertext is distinct from old.ciphertext
       or new.iv is distinct from old.iv then
      insert into public.vault_events (user_id, credential_id, event_type)
      values (new.user_id, new.id, 'updated');
    end if;
    return new;
  end if;

  return null;
end;
$$;
