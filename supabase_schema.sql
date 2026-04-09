-- Supabase schema for the OJT Tracking app

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null check (role in ('admin','student')),
  picture text,
  approved boolean not null default false,
  registration_date date not null default current_date,
  location text,
  last_active timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users disable row level security;

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  email text not null,
  date date not null,
  task text not null,
  hours integer not null,
  proof text,
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.logs disable row level security;

-- Create storage bucket for images
insert into storage.buckets (id, name, public) values ('ojt-images', 'ojt-images', true) on conflict do nothing;

-- Storage policies for ojt-images bucket
create policy "Allow anon upload to ojt-images" on storage.objects for insert with check (bucket_id = 'ojt-images');
create policy "Allow public access to ojt-images" on storage.objects for select using (bucket_id = 'ojt-images');

create index if not exists idx_logs_user_id on public.logs(user_id);
create index if not exists idx_users_role on public.users(role);

insert into public.users (
  student_number,
  name,
  email,
  password,
  role,
  approved,
  registration_date,
  location,
  is_active
) values (
  'ad-minss',
  'Admin',
  'admin@ojt.com',
  'admin',
  'admin',
  true,
  current_date,
  'Admin Office',
  false
) on conflict (student_number) do nothing;
