create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text check (role in ('candidate', 'company', 'university')),
  intake_completed boolean not null default false,
  candidate_domain text,
  target_direction text,
  candidate_graph jsonb,
  company_profile jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists intake_completed boolean not null default false;

alter table public.profiles
  add column if not exists candidate_domain text;

alter table public.profiles
  add column if not exists target_direction text;

alter table public.profiles
  add column if not exists candidate_graph jsonb;

alter table public.profiles
  add column if not exists company_profile jsonb;

alter table public.profiles
  alter column role drop not null;

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  company_name text not null,
  title text not null,
  description text not null,
  salary_min integer,
  salary_max integer,
  salary_currency text not null default 'MYR',
  company_intro text,
  location text,
  employment_type text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'shortlisted', 'rejected')),
  fit_score integer not null default 80,
  candidate_email text,
  candidate_name text,
  created_at timestamptz not null default now(),
  unique(job_id, candidate_id)
);

alter table public.job_applications
  add column if not exists candidate_email text;

alter table public.job_applications
  add column if not exists candidate_name text;

create table if not exists public.company_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  candidate_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.job_postings(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  candidate_email text,
  candidate_name text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.company_notifications
  add column if not exists candidate_email text;

alter table public.company_notifications
  add column if not exists candidate_name text;

-- One-time cleanup for duplicate rows created during repeated local testing.
delete from public.company_notifications n
using public.company_notifications keep
where n.id <> keep.id
  and n.company_id = keep.company_id
  and coalesce(n.candidate_id, '00000000-0000-0000-0000-000000000000'::uuid)
    = coalesce(keep.candidate_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and coalesce(n.job_id, '00000000-0000-0000-0000-000000000000'::uuid)
    = coalesce(keep.job_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and n.type = keep.type
  and n.title = keep.title
  and n.message = keep.message
  and n.created_at < keep.created_at;

delete from public.job_applications a
using public.job_applications keep
where a.id <> keep.id
  and a.job_id = keep.job_id
  and a.candidate_id = keep.candidate_id
  and a.created_at < keep.created_at;

delete from public.job_postings j
using public.job_postings keep
where j.id <> keep.id
  and j.company_id = keep.company_id
  and lower(j.company_name) = lower(keep.company_name)
  and lower(j.title) = lower(keep.title)
  and lower(j.description) = lower(keep.description)
  and j.created_at < keep.created_at;

delete from public.profiles p
using public.profiles keep
where p.id <> keep.id
  and lower(p.email) = lower(keep.email)
  and (
    (p.intake_completed::int + case when p.role is not null then 1 else 0 end)
    <
    (keep.intake_completed::int + case when keep.role is not null then 1 else 0 end)
    or (
      (p.intake_completed::int + case when p.role is not null then 1 else 0 end)
      =
      (keep.intake_completed::int + case when keep.role is not null then 1 else 0 end)
      and p.created_at < keep.created_at
    )
  );

create unique index if not exists profiles_unique_email_idx
  on public.profiles (lower(email));

create unique index if not exists job_postings_unique_company_role_idx
  on public.job_postings (company_id, lower(company_name), lower(title), lower(description));

create unique index if not exists company_notifications_unique_application_idx
  on public.company_notifications (
    company_id,
    coalesce(candidate_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(job_id, '00000000-0000-0000-0000-000000000000'::uuid),
    type,
    title,
    message
  );

alter table public.profiles enable row level security;
alter table public.job_postings enable row level security;
alter table public.job_applications enable row level security;
alter table public.company_notifications enable row level security;

drop policy if exists "profiles can read own profile" on public.profiles;
create policy "profiles can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles can upsert own profile" on public.profiles;
create policy "profiles can upsert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles can update own profile" on public.profiles;
create policy "profiles can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "open jobs are readable" on public.job_postings;
create policy "open jobs are readable"
  on public.job_postings for select
  using (status = 'open');

drop policy if exists "companies can create own job postings" on public.job_postings;
create policy "companies can create own job postings"
  on public.job_postings for insert
  with check (auth.uid() = company_id);

drop policy if exists "companies can update own job postings" on public.job_postings;
create policy "companies can update own job postings"
  on public.job_postings for update
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

drop policy if exists "candidates can apply to jobs" on public.job_applications;
create policy "candidates can apply to jobs"
  on public.job_applications for insert
  with check (auth.uid() = candidate_id);

drop policy if exists "candidates can read own applications" on public.job_applications;
create policy "candidates can read own applications"
  on public.job_applications for select
  using (auth.uid() = candidate_id);

drop policy if exists "companies can read applications to own jobs" on public.job_applications;
create policy "companies can read applications to own jobs"
  on public.job_applications for select
  using (auth.uid() = company_id);

drop policy if exists "candidates can create company notifications for applications" on public.company_notifications;
create policy "candidates can create company notifications for applications"
  on public.company_notifications for insert
  with check (auth.uid() = candidate_id);

drop policy if exists "companies can read own notifications" on public.company_notifications;
create policy "companies can read own notifications"
  on public.company_notifications for select
  using (auth.uid() = company_id);


create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.job_postings(id) on delete set null,
  job_title text,
  company_name text not null,
  candidate_name text,
  candidate_email text,
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists message_threads_unique_participants_job_idx
  on public.message_threads (
    company_id,
    candidate_id,
    coalesce(job_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('candidate', 'company')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.message_threads enable row level security;
alter table public.thread_messages enable row level security;

drop policy if exists "participants can read own message threads" on public.message_threads;
create policy "participants can read own message threads"
  on public.message_threads for select
  using (auth.uid() = company_id or auth.uid() = candidate_id);

drop policy if exists "participants can create own message threads" on public.message_threads;
create policy "participants can create own message threads"
  on public.message_threads for insert
  with check (auth.uid() = company_id or auth.uid() = candidate_id);

drop policy if exists "participants can update own message threads" on public.message_threads;
create policy "participants can update own message threads"
  on public.message_threads for update
  using (auth.uid() = company_id or auth.uid() = candidate_id)
  with check (auth.uid() = company_id or auth.uid() = candidate_id);

drop policy if exists "participants can read own thread messages" on public.thread_messages;
create policy "participants can read own thread messages"
  on public.thread_messages for select
  using (
    exists (
      select 1 from public.message_threads t
      where t.id = thread_id
        and (auth.uid() = t.company_id or auth.uid() = t.candidate_id)
    )
  );

drop policy if exists "participants can send own thread messages" on public.thread_messages;
create policy "participants can send own thread messages"
  on public.thread_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.message_threads t
      where t.id = thread_id
        and (auth.uid() = t.company_id or auth.uid() = t.candidate_id)
    )
  );

-- Required for Supabase Realtime postgres_changes subscriptions.
do $$
begin
  alter publication supabase_realtime add table public.thread_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, intake_completed, candidate_graph)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    null,
    false,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


