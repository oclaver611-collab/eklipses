-- Eklipses: user progress table
-- Run this in the Supabase SQL Editor for your project.

create table if not exists public.user_progress (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  lesson1_complete boolean not null default false,
  lesson2_complete boolean not null default false,
  lesson3_complete boolean not null default false,
  lesson1_progress text,
  lesson2_progress text,
  lesson3_progress text,
  lesson1_cert     jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Row-level security: users can only read and write their own row.
alter table public.user_progress enable row level security;

create policy "users manage own progress"
  on public.user_progress
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger user_progress_updated_at
  before update on public.user_progress
  for each row execute procedure public.set_updated_at();
