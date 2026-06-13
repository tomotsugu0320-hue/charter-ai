create extension if not exists pgcrypto;

create table if not exists forum_discussion_map_previews (
  id uuid primary key default gen_random_uuid(),
  preview_json jsonb not null,
  source_thread_count integer,
  source_post_count integer,
  prompt_version text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  rejected_at timestamptz
);

create table if not exists forum_discussion_map_versions (
  id uuid primary key default gen_random_uuid(),
  map_json jsonb not null,
  source_preview_id uuid references forum_discussion_map_previews(id),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table forum_discussion_map_previews enable row level security;
alter table forum_discussion_map_versions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_discussion_map_previews_status_check'
  ) then
    alter table forum_discussion_map_previews
      add constraint forum_discussion_map_previews_status_check
      check (status in ('draft', 'applied', 'rejected'));
  end if;
end $$;

create index if not exists forum_discussion_map_previews_created_at_idx
  on forum_discussion_map_previews (created_at desc);

create index if not exists forum_discussion_map_previews_status_idx
  on forum_discussion_map_previews (status);

create index if not exists forum_discussion_map_versions_created_at_idx
  on forum_discussion_map_versions (created_at desc);

create unique index if not exists forum_discussion_map_versions_active_one_idx
  on forum_discussion_map_versions (is_active)
  where is_active = true;
