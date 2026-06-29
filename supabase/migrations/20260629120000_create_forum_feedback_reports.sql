create table if not exists forum_feedback_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  page_url text null,
  report_type text not null,
  device_type text null,
  message text not null,
  contact text null,
  user_agent text null,
  status text not null default 'new',
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forum_feedback_reports_report_type_check
    check (
      report_type in (
        'bug',
        'display',
        'unclear',
        'link',
        'ai_output',
        'request',
        'other'
      )
    ),
  constraint forum_feedback_reports_device_type_check
    check (
      device_type is null
      or device_type in ('pc', 'smartphone', 'tablet', 'unknown')
    ),
  constraint forum_feedback_reports_status_check
    check (status in ('new', 'reviewing', 'resolved', 'ignored')),
  constraint forum_feedback_reports_message_check
    check (char_length(btrim(message)) > 0)
);

alter table forum_feedback_reports enable row level security;

create index if not exists forum_feedback_reports_tenant_status_idx
  on forum_feedback_reports (tenant_id, status);

create index if not exists forum_feedback_reports_report_type_idx
  on forum_feedback_reports (report_type);

create index if not exists forum_feedback_reports_created_at_idx
  on forum_feedback_reports (created_at desc);

create or replace function forum_feedback_reports_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists forum_feedback_reports_set_updated_at
  on forum_feedback_reports;

create trigger forum_feedback_reports_set_updated_at
before update on forum_feedback_reports
for each row
execute function forum_feedback_reports_set_updated_at();
