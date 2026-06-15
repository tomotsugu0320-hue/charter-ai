create extension if not exists pgcrypto;

create table if not exists forum_post_ai_classifications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  thread_id uuid not null,
  classification text not null,
  confidence numeric,
  reason text,
  extracted_premise text,
  extracted_evidence text,
  suggested_metrics jsonb,
  raw_result jsonb,
  prompt_version text not null,
  model text,
  api_usage_log_id uuid,
  created_at timestamptz not null default now(),
  created_by_admin text,
  is_active boolean not null default true,
  superseded_at timestamptz
);

alter table forum_post_ai_classifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'forum_post_ai_classifications_classification_check'
  ) then
    alter table forum_post_ai_classifications
      add constraint forum_post_ai_classifications_classification_check
      check (
        classification in (
          'agreement',
          'rebuttal',
          'premise_addition',
          'evidence_addition',
          'case_addition',
          'metric_suggestion',
          'topic_shift',
          'emotional_reaction',
          'needs_review_or_misinformation_risk'
        )
      );
  end if;
end $$;

create index if not exists forum_post_ai_classifications_post_id_idx
  on forum_post_ai_classifications (post_id);

create index if not exists forum_post_ai_classifications_thread_id_idx
  on forum_post_ai_classifications (thread_id);

create index if not exists forum_post_ai_classifications_classification_idx
  on forum_post_ai_classifications (classification);

create index if not exists forum_post_ai_classifications_is_active_idx
  on forum_post_ai_classifications (is_active);

create index if not exists forum_post_ai_classifications_created_at_idx
  on forum_post_ai_classifications (created_at desc);

create index if not exists forum_post_ai_classifications_thread_active_idx
  on forum_post_ai_classifications (thread_id, is_active);

create index if not exists forum_post_ai_classifications_post_active_idx
  on forum_post_ai_classifications (post_id, is_active);
