create table if not exists forum_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null default 'post',
  thread_id uuid null,
  post_id uuid not null,
  reason_type text not null,
  reason_detail text null,
  reporter_user_id uuid null,
  reporter_author_key text null,
  status text not null default 'pending',
  admin_note text null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_reports_target_type_check
    check (target_type in ('post', 'thread')),
  constraint forum_reports_reason_type_check
    check (
      reason_type in (
        'personal_info',
        'harassment',
        'spam',
        'illegal_or_dangerous',
        'wrong_publication',
        'other'
      )
    ),
  constraint forum_reports_status_check
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists forum_reports_status_idx
  on forum_reports (status);

create index if not exists forum_reports_post_id_idx
  on forum_reports (post_id);

create index if not exists forum_reports_thread_id_idx
  on forum_reports (thread_id);

create index if not exists forum_reports_created_at_idx
  on forum_reports (created_at desc);

create or replace function forum_reports_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists forum_reports_set_updated_at on forum_reports;

create trigger forum_reports_set_updated_at
before update on forum_reports
for each row
execute function forum_reports_set_updated_at();
