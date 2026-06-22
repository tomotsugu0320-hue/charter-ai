create extension if not exists pgcrypto;

create table if not exists forum_policy_proposals (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  tenant_slug text,
  title text not null,
  one_line_proposal text,
  policy_area text,
  priority_area text,
  priority_decision text,
  proposal_json jsonb not null,
  prompt_version text not null,
  model text,
  source_summary_updated_at timestamptz,
  status text not null default 'draft',
  content_hash text not null,
  created_by_admin text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table forum_policy_proposals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'forum_policy_proposals_status_check'
  ) then
    alter table forum_policy_proposals
      add constraint forum_policy_proposals_status_check
      check (status in ('draft', 'review', 'published', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'forum_policy_proposals_policy_area_check'
  ) then
    alter table forum_policy_proposals
      add constraint forum_policy_proposals_policy_area_check
      check (
        policy_area is null or policy_area in (
          'fiscal', 'monetary', 'other', 'combined', 'unclassified'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'forum_policy_proposals_priority_area_check'
  ) then
    alter table forum_policy_proposals
      add constraint forum_policy_proposals_priority_area_check
      check (
        priority_area is null or priority_area in (
          'fiscal', 'monetary', 'other', 'combined', 'hold', 'insufficient'
        )
      );
  end if;
end $$;

create index if not exists forum_policy_proposals_thread_created_idx
  on forum_policy_proposals (thread_id, created_at desc);

create index if not exists forum_policy_proposals_status_created_idx
  on forum_policy_proposals (status, created_at desc);

create unique index if not exists forum_policy_proposals_thread_hash_unique_idx
  on forum_policy_proposals (thread_id, content_hash);
