-- Frog Quest: jalankan seluruh isi file ini di Supabase > SQL Editor > New query > Run

-- 1. Pengaturan (1 baris per user)
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  tz text not null default 'Asia/Jakarta',
  mode text not null default 'routine' check (mode in ('routine','task')),
  routine_time time not null default '07:30',
  routine_days int[] not null default '{1,2,3,4,5}',
  routine_msg text not null default 'Frog lu hari ini: {frog}',
  report_enabled boolean not null default true,
  report_every int not null default 3 check (report_every >= 1),
  nudge_enabled boolean not null default true,
  nudge_time time not null default '15:00',
  points int not null default 0,
  streak int not null default 0,
  last_active_day date,
  theme text not null default 'salju',
  accent text,
  font text not null default 'ios',
  view text not null default 'grid',
  tile_w int not null default 80,
  updated_at timestamptz not null default now()
);

-- 2. Tugas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  frog boolean not null default false,
  done boolean not null default false,
  day date not null,
  remind_time time,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_day on public.tasks (user_id, day);

-- 3. Log email (biar reminder/laporan tidak terkirim dobel)
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, key)
);

-- 4. Keamanan (RLS): data cuma bisa dibaca/ditulis oleh pemiliknya
alter table public.settings  enable row level security;
alter table public.tasks     enable row level security;
alter table public.email_log enable row level security;

drop policy if exists "settings owner" on public.settings;
create policy "settings owner" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks owner" on public.tasks;
create policy "tasks owner" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- email_log sengaja tanpa policy: hanya server (service role) yang boleh akses.
