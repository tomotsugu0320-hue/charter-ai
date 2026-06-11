create extension if not exists pgcrypto;

create table if not exists forum_beta_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  login_id_normalized text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
