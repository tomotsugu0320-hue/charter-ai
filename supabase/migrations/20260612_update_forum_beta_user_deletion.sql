alter table forum_beta_users
  add column if not exists status text not null default 'active',
  add column if not exists disabled_at timestamptz,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_beta_users_status_check'
  ) then
    alter table forum_beta_users
      add constraint forum_beta_users_status_check
      check (status in ('active', 'disabled', 'deleted'));
  end if;
end $$;

create index if not exists forum_beta_users_status_idx
  on forum_beta_users (status);
