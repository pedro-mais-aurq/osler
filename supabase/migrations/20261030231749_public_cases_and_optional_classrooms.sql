-- Optional classroom participation and explicit case visibility.
-- Existing teacher-authored material stays private. No production users/cases are seeded.
alter table public.clinical_cases add column visibility text not null default 'private'
  check (visibility in ('private', 'public'));
update public.clinical_cases set visibility = 'public' where owner_teacher_id is null and status = 'published';
update public.teaching_case_drafts d set draft = d.draft || jsonb_build_object('visibility', c.visibility)
  from public.clinical_cases c where c.id = d.case_id;
create index clinical_cases_public_catalogue_idx on public.clinical_cases(course, created_at, id)
  where visibility = 'public' and status = 'published';

create or replace function private.can_read_case(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.clinical_cases cc where cc.id = p_id and (
      cc.owner_teacher_id = private.teacher_id() or
      (cc.status = 'published' and (cc.visibility = 'public' or exists (
        select 1 from public.classroom_assignments a join public.classrooms c on c.id = a.classroom_id
        where a.case_id = cc.id and a.status = 'open' and not c.archived and private.is_class_member(c.id)
      )))
    )
  );
$$;

create or replace function private.require_assignment(p_case_id uuid, p_assignment_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if p_assignment_id is null then
    if not exists (select 1 from public.clinical_cases cc where cc.id = p_case_id and cc.status = 'published' and cc.visibility = 'public') then
      raise exception 'Caso indisponível para prática individual.' using errcode = '42501';
    end if;
    return;
  end if;
  if not exists (
    select 1 from public.classroom_assignments a join public.classrooms c on c.id = a.classroom_id
      join public.clinical_cases cc on cc.id = a.case_id
    where a.id = p_assignment_id and a.case_id = p_case_id and a.status = 'open' and not c.archived
      and cc.status = 'published' and cc.owner_teacher_id = c.teacher_id and cc.course = c.course
      and private.is_class_member(c.id)
  ) then raise exception 'Atividade indisponível para esta conta.' using errcode = '42501'; end if;
end;
$$;

create or replace function private.require_case_access(p_case_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_case(p_case_id) then
    raise exception 'Caso indisponível para esta conta.' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.guard_classroom_session() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Tentativa indisponível.' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    if new.assignment_id is distinct from old.assignment_id or new.case_id is distinct from old.case_id
      or new.user_id is distinct from old.user_id or new.classroom_student_email is distinct from old.classroom_student_email
      then raise exception 'O vínculo da tentativa é imutável.' using errcode = '42501'; end if;
    -- An owner may abandon a session after its case or classroom was archived.
    if new.status = 'abandoned' then return new; end if;
  end if;
  perform private.require_assignment(new.case_id, new.assignment_id);
  if tg_op = 'INSERT' then
    new.classroom_student_email := case when new.assignment_id is null then null else private.google_email() end;
  end if;
  return new;
end;
$$;

create or replace function private.guard_classroom_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.simulation_sessions%rowtype;
begin
  select * into s from public.simulation_sessions where id = new.session_id;
  if not found or auth.uid() is null or s.user_id is distinct from auth.uid() then raise exception 'Tentativa indisponível.' using errcode = '42501'; end if;
  perform private.require_assignment(s.case_id, s.assignment_id);
  return new;
end;
$$;

-- Reuse the validated P11 publication path, including immutable versions and private rules.
alter function private.teaching_save_case(jsonb, uuid, boolean) rename to teaching_save_case_p11;
revoke all on function private.teaching_save_case_p11(jsonb, uuid, boolean) from public, anon, authenticated;
create function private.teaching_save_case(p_draft jsonb, p_id uuid default null, p_publish boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_visibility text := coalesce(p_draft->>'visibility', 'private'); v_id uuid;
begin
  perform private.require_teacher();
  if v_visibility not in ('private', 'public') or (p_draft ? 'visibility' and jsonb_typeof(p_draft->'visibility') is distinct from 'string') then
    raise exception 'Selecione a visibilidade pública ou privada do caso.' using errcode = '22023';
  end if;
  v_id := private.teaching_save_case_p11(p_draft || jsonb_build_object('visibility', v_visibility), p_id, p_publish);
  update public.clinical_cases set visibility = v_visibility where id = v_id;
  return v_id;
end;
$$;
create or replace function public.teaching_save_case(p_draft jsonb, p_id uuid default null, p_publish boolean default false) returns uuid
language sql security invoker set search_path = '' as $$ select private.teaching_save_case(p_draft, p_id, p_publish); $$;
revoke all on function private.teaching_save_case(jsonb, uuid, boolean), public.teaching_save_case(jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function private.teaching_save_case(jsonb, uuid, boolean), public.teaching_save_case(jsonb, uuid, boolean) to authenticated;

-- Codes are credentials for joining a classroom, so they are never exposed as table columns.
create table private.classroom_join_codes (
  classroom_id uuid primary key references public.classrooms(id) on delete cascade,
  join_code text not null unique check (join_code ~ '^OSLER-[A-F0-9]{16}$'),
  created_at timestamptz not null default now()
);
alter table private.classroom_join_codes enable row level security;
revoke all on private.classroom_join_codes from public, anon, authenticated;
grant all on private.classroom_join_codes to service_role;
insert into private.classroom_join_codes(classroom_id, join_code)
  select id, 'OSLER-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)) from public.classrooms;
create function private.create_classroom_join_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.classroom_join_codes(classroom_id, join_code)
    values (new.id, 'OSLER-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)));
  return new;
end;
$$;
revoke all on function private.create_classroom_join_code() from public, anon, authenticated;
create trigger classroom_join_code_created after insert on public.classrooms
  for each row execute function private.create_classroom_join_code();

alter function private.teaching_workspace() rename to teaching_workspace_p11;
revoke all on function private.teaching_workspace_p11() from public, anon, authenticated;
create function private.teaching_workspace() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_data jsonb; v_classrooms jsonb;
begin
  perform private.require_teacher();
  v_data := private.teaching_workspace_p11();
  select coalesce(jsonb_agg(item || jsonb_build_object('joinCode', code.join_code) order by position), '[]'::jsonb)
    into v_classrooms from jsonb_array_elements(v_data->'classrooms') with ordinality as rooms(item, position)
    left join private.classroom_join_codes code on code.classroom_id = (item->>'id')::uuid;
  return jsonb_set(v_data, '{classrooms}', v_classrooms);
end;
$$;
create or replace function public.teaching_workspace() returns jsonb
language sql security invoker set search_path = '' as $$ select private.teaching_workspace(); $$;
revoke all on function private.teaching_workspace(), public.teaching_workspace() from public, anon, authenticated;
grant execute on function private.teaching_workspace(), public.teaching_workspace() to authenticated;

create function private.student_join_classroom(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text := private.google_email(); v_class public.classrooms%rowtype; v_enrollment uuid;
begin
  if auth.uid() is null or v_email is null or not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'student') then
    raise exception 'Entre como aluno com sua conta Google.' using errcode = '42501';
  end if;
  if p_code is null or length(p_code) > 32 then raise exception 'Código de turma inválido ou indisponível.' using errcode = '22023'; end if;
  select c.* into v_class from public.classrooms c join private.classroom_join_codes code on code.classroom_id = c.id
    where code.join_code = upper(btrim(p_code)) and not c.archived for share of c;
  if not found then raise exception 'Código de turma inválido ou indisponível. Confira com o professor.' using errcode = '22023'; end if;
  insert into public.classroom_enrollments(classroom_id, email, student_id, status)
    values (v_class.id, v_email, auth.uid(), 'active')
    on conflict (classroom_id, email) do update set student_id = excluded.student_id, status = 'active'
      where public.classroom_enrollments.status <> 'revoked'
    returning id into v_enrollment;
  if v_enrollment is null then raise exception 'Seu acesso foi revogado. Peça ao professor para liberar sua entrada novamente.' using errcode = 'P0001'; end if;
  return private.classroom_json(v_class);
end;
$$;
create function public.student_join_classroom(p_code text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.student_join_classroom(p_code); $$;
revoke all on function private.student_join_classroom(text), public.student_join_classroom(text) from public, anon, authenticated;
grant execute on function private.student_join_classroom(text), public.student_join_classroom(text) to authenticated;

create function private.public_case_catalogue(p_course public.course_code) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'student') then
    raise exception 'Entre como aluno para praticar.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'cases', coalesce((select jsonb_agg(jsonb_build_object(
      'id', cc.id, 'title', cc.title, 'course', cc.course, 'description', cc.description, 'objective', cc.educational_objective,
      'stepCount', (select count(*) from public.case_steps where case_id = cc.id),
      'expectedDecisions', (select count(*) from public.case_steps where case_id = cc.id and step_type = 'decision')
    ) order by cc.created_at, cc.id) from public.clinical_cases cc where cc.visibility = 'public' and cc.status = 'published' and cc.course = p_course), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(private.attempt_json(s) || jsonb_build_object('caseId', s.case_id, 'feedback', '') order by s.started_at desc, s.id)
      from public.simulation_sessions s join public.clinical_cases cc on cc.id = s.case_id
      where s.user_id = auth.uid() and s.assignment_id is null and cc.course = p_course), '[]'::jsonb)
  );
end;
$$;
create function public.public_case_catalogue(p_course public.course_code) returns jsonb
language sql security invoker set search_path = '' as $$ select private.public_case_catalogue(p_course); $$;
revoke all on function private.public_case_catalogue(public.course_code), public.public_case_catalogue(public.course_code) from public, anon, authenticated;
grant execute on function private.public_case_catalogue(public.course_code), public.public_case_catalogue(public.course_code) to authenticated;

comment on column public.clinical_cases.visibility is 'Published public cases support independent student attempts; private cases require an authorized classroom assignment. Visibility never publishes a draft.';
comment on table private.classroom_join_codes is 'Join codes are returned only to the owning teacher. Student enrollment always uses the verified Google email; revoked access cannot be restored with a code.';
notify pgrst, 'reload schema';
