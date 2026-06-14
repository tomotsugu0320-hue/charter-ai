create extension if not exists pgcrypto;

create table if not exists forum_bulk_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  target_type text not null,
  filter_json jsonb not null default '{}'::jsonb,
  max_items integer not null default 10,
  estimated_api_calls integer,
  estimated_input_tokens integer,
  estimated_output_tokens integer,
  estimated_total_tokens integer,
  estimated_cost_usd numeric,
  actual_api_calls integer not null default 0,
  actual_input_tokens integer not null default 0,
  actual_output_tokens integer not null default 0,
  actual_total_tokens integer not null default 0,
  actual_cost_usd numeric not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists forum_bulk_refresh_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references forum_bulk_refresh_jobs(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  status text not null default 'pending',
  previous_version_id uuid,
  new_version_id uuid,
  actual_input_tokens integer not null default 0,
  actual_output_tokens integer not null default 0,
  actual_total_tokens integer not null default 0,
  actual_cost_usd numeric not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists forum_thread_ai_structure_versions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  source_structure_id uuid,
  job_id uuid references forum_bulk_refresh_jobs(id) on delete set null,
  job_item_id uuid references forum_bulk_refresh_job_items(id) on delete set null,
  prompt_version text not null,
  model text,
  summary_text text,
  provisional_answer text,
  evidence_text text,
  counterargument_text text,
  related_topics jsonb,
  structure_json jsonb,
  raw_result jsonb,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric,
  actual_cost_usd numeric,
  is_applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists forum_post_logic_score_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  job_id uuid references forum_bulk_refresh_jobs(id) on delete set null,
  job_item_id uuid references forum_bulk_refresh_job_items(id) on delete set null,
  prompt_version text not null,
  model text,
  logic_score integer,
  logic_score_reason text,
  logic_break_type text,
  logic_break_note text,
  raw_result jsonb,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric,
  actual_cost_usd numeric,
  is_applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table forum_bulk_refresh_jobs enable row level security;
alter table forum_bulk_refresh_job_items enable row level security;
alter table forum_thread_ai_structure_versions enable row level security;
alter table forum_post_logic_score_versions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_bulk_refresh_jobs_status_check'
  ) then
    alter table forum_bulk_refresh_jobs
      add constraint forum_bulk_refresh_jobs_status_check
      check (status in ('draft', 'running', 'completed', 'failed', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_bulk_refresh_jobs_target_type_check'
  ) then
    alter table forum_bulk_refresh_jobs
      add constraint forum_bulk_refresh_jobs_target_type_check
      check (target_type in ('thread_summary', 'logic_score'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_bulk_refresh_jobs_max_items_check'
  ) then
    alter table forum_bulk_refresh_jobs
      add constraint forum_bulk_refresh_jobs_max_items_check
      check (max_items between 1 and 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_bulk_refresh_job_items_status_check'
  ) then
    alter table forum_bulk_refresh_job_items
      add constraint forum_bulk_refresh_job_items_status_check
      check (status in ('pending', 'running', 'completed', 'failed', 'skipped'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_bulk_refresh_job_items_target_type_check'
  ) then
    alter table forum_bulk_refresh_job_items
      add constraint forum_bulk_refresh_job_items_target_type_check
      check (target_type in ('thread_summary', 'logic_score'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_post_logic_score_versions_score_check'
  ) then
    alter table forum_post_logic_score_versions
      add constraint forum_post_logic_score_versions_score_check
      check (logic_score is null or logic_score between 0 and 100);
  end if;
end $$;

create index if not exists forum_bulk_refresh_jobs_status_idx
  on forum_bulk_refresh_jobs (status);

create index if not exists forum_bulk_refresh_jobs_created_at_idx
  on forum_bulk_refresh_jobs (created_at desc);

create index if not exists forum_bulk_refresh_job_items_job_id_idx
  on forum_bulk_refresh_job_items (job_id);

create index if not exists forum_bulk_refresh_job_items_status_idx
  on forum_bulk_refresh_job_items (status);

create index if not exists forum_bulk_refresh_job_items_target_idx
  on forum_bulk_refresh_job_items (target_type, target_id);

create unique index if not exists forum_bulk_refresh_job_items_job_target_unique_idx
  on forum_bulk_refresh_job_items (job_id, target_type, target_id);

create index if not exists forum_thread_ai_structure_versions_thread_id_idx
  on forum_thread_ai_structure_versions (thread_id);

create index if not exists forum_thread_ai_structure_versions_prompt_version_idx
  on forum_thread_ai_structure_versions (prompt_version);

create index if not exists forum_thread_ai_structure_versions_created_at_idx
  on forum_thread_ai_structure_versions (created_at desc);

create index if not exists forum_thread_ai_structure_versions_is_applied_idx
  on forum_thread_ai_structure_versions (is_applied);

create unique index if not exists forum_thread_ai_structure_versions_job_prompt_unique_idx
  on forum_thread_ai_structure_versions (thread_id, prompt_version, job_id)
  where job_id is not null;

create index if not exists forum_post_logic_score_versions_post_id_idx
  on forum_post_logic_score_versions (post_id);

create index if not exists forum_post_logic_score_versions_prompt_version_idx
  on forum_post_logic_score_versions (prompt_version);

create index if not exists forum_post_logic_score_versions_created_at_idx
  on forum_post_logic_score_versions (created_at desc);

create index if not exists forum_post_logic_score_versions_is_applied_idx
  on forum_post_logic_score_versions (is_applied);

create unique index if not exists forum_post_logic_score_versions_job_prompt_unique_idx
  on forum_post_logic_score_versions (post_id, prompt_version, job_id)
  where job_id is not null;
