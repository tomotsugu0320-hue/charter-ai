-- Micro board tables.
-- This migration creates only micro_* objects and does not modify existing forum tables.

create extension if not exists pgcrypto;

create or replace function micro_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists micro_source_data (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  source_type text not null default 'free_log',
  title text,
  raw_content text not null,
  normalized_content text,
  status text not null default 'draft',
  pinned boolean not null default false,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  author_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint micro_source_data_source_type_check
    check (source_type in (
      'free_log',
      'smart_note',
      'chat_log',
      'imported_text',
      'manual',
      'voice',
      'chatgpt_share',
      'line',
      'web_clip'
    )),
  constraint micro_source_data_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint micro_source_data_usage_count_check
    check (usage_count >= 0)
);

create table if not exists micro_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  pinned boolean not null default false,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint micro_groups_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint micro_groups_usage_count_check
    check (usage_count >= 0)
);

create table if not exists micro_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  target_type text not null,
  target_id uuid not null,
  version_type text not null,
  input_snapshot jsonb,
  output_snapshot jsonb,
  diff_summary text,
  prompt_name text,
  model_name text,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint micro_versions_target_type_check
    check (target_type in ('source_data', 'summary', 'group', 'todo')),
  constraint micro_versions_version_type_check
    check (version_type in (
      'ai_generated',
      'todo_extract',
      'group_assign',
      'user_edit',
      'status_change',
      'archive_restore'
    )),
  constraint micro_versions_created_by_check
    check (created_by in ('ai', 'user', 'system'))
);

create table if not exists micro_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  target_type text not null,
  target_id uuid not null,
  summary_type text not null default 'short',
  content text not null,
  created_by text not null,
  version_id uuid references micro_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint micro_summaries_target_type_check
    check (target_type in ('source_data', 'group')),
  constraint micro_summaries_summary_type_check
    check (summary_type in ('short', 'structured', 'todo_context', 'custom')),
  constraint micro_summaries_created_by_check
    check (created_by in ('ai', 'user'))
);

create table if not exists micro_group_items (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  group_id uuid not null references micro_groups(id),
  source_data_id uuid not null references micro_source_data(id),
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint micro_group_items_created_by_check
    check (created_by in ('ai', 'user'))
);

create table if not exists micro_todos (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  source_data_id uuid references micro_source_data(id) on delete set null,
  group_id uuid references micro_groups(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft',
  todo_state text not null default 'open',
  due_at timestamptz,
  pinned boolean not null default false,
  usage_count integer not null default 0,
  created_by text not null,
  version_id uuid references micro_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint micro_todos_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint micro_todos_todo_state_check
    check (todo_state in ('open', 'done', 'blocked')),
  constraint micro_todos_created_by_check
    check (created_by in ('ai', 'user')),
  constraint micro_todos_usage_count_check
    check (usage_count >= 0)
);

create index if not exists micro_source_data_tenant_status_order_idx
  on micro_source_data (tenant_slug, status, pinned desc, updated_at desc, usage_count desc);

create index if not exists micro_source_data_tenant_source_type_idx
  on micro_source_data (tenant_slug, source_type);

create index if not exists micro_source_data_tenant_author_key_idx
  on micro_source_data (tenant_slug, author_key);

create index if not exists micro_source_data_last_used_at_idx
  on micro_source_data (tenant_slug, last_used_at desc);

create index if not exists micro_summaries_target_idx
  on micro_summaries (tenant_slug, target_type, target_id);

create index if not exists micro_summaries_summary_type_idx
  on micro_summaries (tenant_slug, summary_type);

create index if not exists micro_summaries_version_id_idx
  on micro_summaries (version_id);

create index if not exists micro_groups_tenant_status_order_idx
  on micro_groups (tenant_slug, status, pinned desc, updated_at desc, usage_count desc);

create index if not exists micro_groups_last_used_at_idx
  on micro_groups (tenant_slug, last_used_at desc);

create unique index if not exists micro_group_items_unique_group_source_idx
  on micro_group_items (tenant_slug, group_id, source_data_id);

create index if not exists micro_group_items_group_idx
  on micro_group_items (tenant_slug, group_id);

create index if not exists micro_group_items_source_data_idx
  on micro_group_items (tenant_slug, source_data_id);

create index if not exists micro_todos_tenant_status_order_idx
  on micro_todos (tenant_slug, status, pinned desc, updated_at desc, usage_count desc);

create index if not exists micro_todos_todo_state_idx
  on micro_todos (tenant_slug, todo_state);

create index if not exists micro_todos_source_data_idx
  on micro_todos (tenant_slug, source_data_id);

create index if not exists micro_todos_group_idx
  on micro_todos (tenant_slug, group_id);

create index if not exists micro_todos_due_at_idx
  on micro_todos (tenant_slug, due_at);

create index if not exists micro_todos_version_id_idx
  on micro_todos (version_id);

create index if not exists micro_versions_target_timeline_idx
  on micro_versions (tenant_slug, target_type, target_id, created_at desc);

create index if not exists micro_versions_version_type_idx
  on micro_versions (tenant_slug, version_type, created_at desc);

drop trigger if exists micro_source_data_set_updated_at on micro_source_data;

create trigger micro_source_data_set_updated_at
before update on micro_source_data
for each row
execute function micro_set_updated_at();

drop trigger if exists micro_summaries_set_updated_at on micro_summaries;

create trigger micro_summaries_set_updated_at
before update on micro_summaries
for each row
execute function micro_set_updated_at();

drop trigger if exists micro_groups_set_updated_at on micro_groups;

create trigger micro_groups_set_updated_at
before update on micro_groups
for each row
execute function micro_set_updated_at();

drop trigger if exists micro_todos_set_updated_at on micro_todos;

create trigger micro_todos_set_updated_at
before update on micro_todos
for each row
execute function micro_set_updated_at();
