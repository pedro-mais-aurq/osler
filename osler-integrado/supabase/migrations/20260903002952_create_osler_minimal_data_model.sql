create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  create type public.app_role as enum ('student', 'teacher', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.course_code as enum ('nursing', 'clinical_analysis');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.simulation_status as enum ('in_progress', 'completed', 'abandoned');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.case_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  course public.course_code,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  age_years smallint,
  sex_or_anatomy_context text,
  pronouns text,
  visual_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_display_name_not_blank check (btrim(display_name) <> ''),
  constraint patients_age_years_nonnegative check (age_years is null or age_years >= 0),
  constraint patients_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.clinical_cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  slug text not null unique,
  title text not null,
  course public.course_code not null,
  description text not null,
  educational_objective text,
  status public.case_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_cases_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint clinical_cases_title_not_blank check (btrim(title) <> ''),
  constraint clinical_cases_description_not_blank check (btrim(description) <> ''),
  constraint clinical_cases_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.case_truth_models (
  case_id uuid primary key references public.clinical_cases (id) on delete cascade,
  truth_model jsonb not null,
  initial_state jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_truth_models_truth_is_object check (jsonb_typeof(truth_model) = 'object'),
  constraint case_truth_models_initial_state_is_object check (jsonb_typeof(initial_state) = 'object'),
  constraint case_truth_models_version_positive check (version > 0)
);

create table if not exists public.case_steps (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.clinical_cases (id) on delete cascade,
  position integer not null,
  step_key text not null,
  step_type text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  options jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_steps_case_position_key unique (case_id, position),
  constraint case_steps_case_step_key_key unique (case_id, step_key),
  constraint case_steps_id_case_id_key unique (id, case_id),
  constraint case_steps_position_positive check (position > 0),
  constraint case_steps_step_key_not_blank check (btrim(step_key) <> ''),
  constraint case_steps_step_type_not_blank check (btrim(step_type) <> ''),
  constraint case_steps_title_not_blank check (title is null or btrim(title) <> ''),
  constraint case_steps_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint case_steps_options_is_array check (jsonb_typeof(options) = 'array'),
  constraint case_steps_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.case_step_rules (
  step_id uuid primary key references public.case_steps (id) on delete cascade,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_step_rules_rules_is_object check (jsonb_typeof(rules) = 'object')
);

create table if not exists public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  case_id uuid not null references public.clinical_cases (id) on delete restrict,
  status public.simulation_status not null default 'in_progress',
  current_step_id uuid,
  score_total integer not null default 0,
  score_dimensions jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint simulation_sessions_id_user_id_key unique (id, user_id),
  constraint simulation_sessions_current_step_case_fkey
    foreign key (current_step_id, case_id)
    references public.case_steps (id, case_id)
    on delete restrict,
  constraint simulation_sessions_score_dimensions_is_object
    check (jsonb_typeof(score_dimensions) = 'object'),
  constraint simulation_sessions_completed_at_matches_status
    check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.simulation_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  step_id uuid not null references public.case_steps (id) on delete restrict,
  selected_option_id text not null,
  outcome jsonb,
  score_delta integer not null default 0,
  created_at timestamptz not null default now(),
  constraint simulation_actions_session_owner_fkey
    foreign key (session_id, user_id)
    references public.simulation_sessions (id, user_id)
    on delete cascade,
  constraint simulation_actions_selected_option_not_blank
    check (btrim(selected_option_id) <> ''),
  constraint simulation_actions_outcome_is_object
    check (outcome is null or jsonb_typeof(outcome) = 'object')
);

create index if not exists clinical_cases_course_status_idx
  on public.clinical_cases (course, status);
create index if not exists clinical_cases_patient_status_idx
  on public.clinical_cases (patient_id, status);
create index if not exists simulation_sessions_user_started_idx
  on public.simulation_sessions (user_id, started_at desc);
create index if not exists simulation_sessions_case_id_idx
  on public.simulation_sessions (case_id);
create index if not exists simulation_sessions_current_step_case_idx
  on public.simulation_sessions (current_step_id, case_id)
  where current_step_id is not null;
create index if not exists simulation_actions_session_created_idx
  on public.simulation_actions (session_id, created_at);
create index if not exists simulation_actions_user_created_idx
  on public.simulation_actions (user_id, created_at desc);
create index if not exists simulation_actions_step_id_idx
  on public.simulation_actions (step_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'student'::public.app_role)
  on conflict (user_id) do nothing;

  insert into public.students (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function private.set_updated_at();

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
before update on public.patients
for each row execute function private.set_updated_at();

drop trigger if exists clinical_cases_set_updated_at on public.clinical_cases;
create trigger clinical_cases_set_updated_at
before update on public.clinical_cases
for each row execute function private.set_updated_at();

drop trigger if exists case_truth_models_set_updated_at on public.case_truth_models;
create trigger case_truth_models_set_updated_at
before update on public.case_truth_models
for each row execute function private.set_updated_at();

drop trigger if exists case_steps_set_updated_at on public.case_steps;
create trigger case_steps_set_updated_at
before update on public.case_steps
for each row execute function private.set_updated_at();

drop trigger if exists case_step_rules_set_updated_at on public.case_step_rules;
create trigger case_step_rules_set_updated_at
before update on public.case_step_rules
for each row execute function private.set_updated_at();

drop trigger if exists simulation_sessions_set_updated_at on public.simulation_sessions;
create trigger simulation_sessions_set_updated_at
before update on public.simulation_sessions
for each row execute function private.set_updated_at();

drop trigger if exists on_auth_user_created_osler on auth.users;
create trigger on_auth_user_created_osler
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.admins enable row level security;
alter table public.patients enable row level security;
alter table public.clinical_cases enable row level security;
alter table public.case_truth_models enable row level security;
alter table public.case_steps enable row level security;
alter table public.case_step_rules enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.simulation_actions enable row level security;

revoke all privileges on table
  public.profiles,
  public.students,
  public.teachers,
  public.admins,
  public.patients,
  public.clinical_cases,
  public.case_truth_models,
  public.case_steps,
  public.case_step_rules,
  public.simulation_sessions,
  public.simulation_actions
from public, anon, authenticated;

revoke all privileges on type
  public.app_role,
  public.course_code,
  public.simulation_status,
  public.case_status
from public, anon;

grant usage on schema public to authenticated, service_role;
grant usage on type
  public.app_role,
  public.course_code,
  public.simulation_status,
  public.case_status
to authenticated, service_role;

grant select on table
  public.profiles,
  public.students,
  public.teachers,
  public.admins,
  public.patients,
  public.clinical_cases,
  public.case_steps,
  public.simulation_sessions,
  public.simulation_actions
to authenticated;

grant update (course) on public.students to authenticated;
grant insert (user_id, case_id) on public.simulation_sessions to authenticated;
grant update (status, current_step_id, completed_at)
  on public.simulation_sessions to authenticated;
grant insert (session_id, user_id, step_id, selected_option_id)
  on public.simulation_actions to authenticated;

grant all privileges on table
  public.profiles,
  public.students,
  public.teachers,
  public.admins,
  public.patients,
  public.clinical_cases,
  public.case_truth_models,
  public.case_steps,
  public.case_step_rules,
  public.simulation_sessions,
  public.simulation_actions
to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists students_select_own on public.students;
create policy students_select_own
on public.students
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists students_update_own on public.students;
create policy students_update_own
on public.students
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists teachers_select_own on public.teachers;
create policy teachers_select_own
on public.teachers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists admins_select_own on public.admins;
create policy admins_select_own
on public.admins
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists patients_select_published_case on public.patients;
create policy patients_select_published_case
on public.patients
for select
to authenticated
using (
  exists (
    select 1
    from public.clinical_cases visible_case
    where visible_case.patient_id = patients.id
      and visible_case.status = 'published'
  )
);

drop policy if exists clinical_cases_select_published on public.clinical_cases;
create policy clinical_cases_select_published
on public.clinical_cases
for select
to authenticated
using (status = 'published');

drop policy if exists case_steps_select_published_case on public.case_steps;
create policy case_steps_select_published_case
on public.case_steps
for select
to authenticated
using (
  exists (
    select 1
    from public.clinical_cases visible_case
    where visible_case.id = case_steps.case_id
      and visible_case.status = 'published'
  )
);

drop policy if exists simulation_sessions_select_own on public.simulation_sessions;
create policy simulation_sessions_select_own
on public.simulation_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists simulation_sessions_insert_own_published_case on public.simulation_sessions;
create policy simulation_sessions_insert_own_published_case
on public.simulation_sessions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.clinical_cases visible_case
    where visible_case.id = simulation_sessions.case_id
      and visible_case.status = 'published'
  )
);

drop policy if exists simulation_sessions_update_own on public.simulation_sessions;
create policy simulation_sessions_update_own
on public.simulation_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists simulation_actions_select_own on public.simulation_actions;
create policy simulation_actions_select_own
on public.simulation_actions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists simulation_actions_insert_own_session on public.simulation_actions;
create policy simulation_actions_insert_own_session
on public.simulation_actions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.simulation_sessions own_session
    join public.case_steps visible_step
      on visible_step.id = simulation_actions.step_id
      and visible_step.case_id = own_session.case_id
    where own_session.id = simulation_actions.session_id
      and own_session.user_id = (select auth.uid())
      and own_session.status = 'in_progress'
      and exists (
        select 1
        from jsonb_array_elements(visible_step.options) as visible_option
        where visible_option ->> 'id' = simulation_actions.selected_option_id
      )
  )
);
