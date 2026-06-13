create extension if not exists pgcrypto;

create table if not exists forum_api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  route_path text,
  model text,
  prompt_version text,
  target_type text,
  target_id text,
  user_id uuid,
  input_token_estimate integer,
  output_token_estimate integer,
  total_token_estimate integer,
  estimated_cost numeric,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

alter table forum_api_usage_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_api_usage_logs_status_check'
  ) then
    alter table forum_api_usage_logs
      add constraint forum_api_usage_logs_status_check
      check (status in ('success', 'error'));
  end if;
end $$;

create index if not exists forum_api_usage_logs_created_at_idx
  on forum_api_usage_logs (created_at desc);

create index if not exists forum_api_usage_logs_feature_key_idx
  on forum_api_usage_logs (feature_key);

create index if not exists forum_api_usage_logs_model_idx
  on forum_api_usage_logs (model);

create index if not exists forum_api_usage_logs_status_idx
  on forum_api_usage_logs (status);

create index if not exists forum_api_usage_logs_target_idx
  on forum_api_usage_logs (target_type, target_id);
