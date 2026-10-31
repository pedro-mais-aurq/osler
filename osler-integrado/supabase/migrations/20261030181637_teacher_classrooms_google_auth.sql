-- Classroom management and Google identity. No production users or cases are seeded.
-- Existing public cases, engine outcomes and historical decisions are preserved.
alter default privileges in schema private revoke execute on functions from public;

create table private.teacher_allowlist (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.teacher_allowlist enable row level security;
revoke all on private.teacher_allowlist from public, anon, authenticated;
grant all on private.teacher_allowlist to service_role;

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(user_id),
  name text not null check (length(btrim(name)) between 1 and 120),
  course public.course_code not null,
  description text not null default '' check (length(description) <= 2000),
  term text not null default '' check (length(term) <= 120),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index classrooms_teacher_idx on public.classrooms(teacher_id);
create table public.classroom_enrollments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  student_id uuid references public.profiles(user_id),
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  created_at timestamptz not null default now(),
  unique(classroom_id, email),
  check ((status = 'active') <= (student_id is not null))
);
create index classroom_enrollments_student_idx on public.classroom_enrollments(student_id, classroom_id);
create index classroom_enrollments_email_idx on public.classroom_enrollments(email);
alter table public.clinical_cases add column owner_teacher_id uuid references public.profiles(user_id);
create index clinical_cases_owner_idx on public.clinical_cases(owner_teacher_id);
create table public.teaching_case_drafts (
  case_id uuid primary key references public.clinical_cases(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id),
  draft jsonb not null check (jsonb_typeof(draft) = 'object')
);
create index teaching_case_drafts_teacher_idx on public.teaching_case_drafts(teacher_id);
create table public.classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id),
  case_id uuid not null references public.clinical_cases(id),
  title text not null check (length(btrim(title)) between 1 and 160),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index classroom_assignments_class_idx on public.classroom_assignments(classroom_id);
create index classroom_assignments_case_idx on public.classroom_assignments(case_id);
alter table public.simulation_sessions add column assignment_id uuid references public.classroom_assignments(id);
alter table public.simulation_sessions add column classroom_student_email text;
create index simulation_sessions_assignment_idx on public.simulation_sessions(assignment_id);
drop index public.simulation_sessions_one_active_per_user_case_idx;
create unique index simulation_sessions_one_active_per_activity_idx on public.simulation_sessions(user_id,case_id,coalesce(assignment_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status = 'in_progress';
create table public.teacher_feedback (
  session_id uuid primary key references public.simulation_sessions(id),
  teacher_id uuid not null references public.profiles(user_id),
  feedback text not null default '' check (length(feedback) <= 5000),
  updated_at timestamptz not null default now()
);
create index teacher_feedback_teacher_idx on public.teacher_feedback(teacher_id);

-- Email and authorization are read from trusted Auth tables, never user_metadata.
create function private.google_email() returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
      and i.identity_data->>'email_verified' = 'true' and lower(i.identity_data->>'email') = lower(u.email));
$$;
create function private.teacher_id() returns uuid language sql stable security definer set search_path = '' as $$
  select p.user_id from public.profiles p where p.user_id = auth.uid()
    and private.google_email() is not null and (
      (p.role = 'teacher' and exists(select 1 from private.teacher_allowlist t where t.email = private.google_email() and t.enabled))
      or (p.role = 'admin' and exists(select 1 from public.admins a where a.user_id = p.user_id)));
$$;
create function private.require_teacher() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := private.teacher_id(); begin
  if v_id is null then raise exception 'Acesso docente não autorizado.' using errcode = '42501'; end if;
  return v_id;
end $$;
create function private.owns_classroom(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.classrooms c where c.id = p_id and c.teacher_id = private.teacher_id());
$$;
create function private.is_class_member(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.classroom_enrollments e
    where e.classroom_id = p_id and e.student_id = auth.uid() and e.email = private.google_email() and e.status = 'active'
      and exists(select 1 from public.classrooms c where c.id=p_id and not c.archived));
$$;
create function private.can_read_case(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.clinical_cases cc where cc.id = p_id and (
    cc.owner_teacher_id = private.teacher_id() or (cc.status = 'published' and (
      cc.owner_teacher_id is null or exists(select 1 from public.classroom_assignments a join public.classrooms c on c.id = a.classroom_id
        where a.case_id = cc.id and a.status = 'open' and not c.archived and private.is_class_member(c.id))))));
$$;
create function private.require_assignment(p_case_id uuid, p_assignment_id uuid) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if not exists(select 1 from public.clinical_cases cc where cc.id = p_case_id and cc.owner_teacher_id is not null) and p_assignment_id is null then return; end if;
  if p_assignment_id is null or not exists (
    select 1 from public.classroom_assignments a join public.classrooms c on c.id = a.classroom_id
    join public.clinical_cases cc on cc.id = a.case_id
    where a.id = p_assignment_id and a.case_id = p_case_id and a.status = 'open' and not c.archived
      and cc.status = 'published' and cc.owner_teacher_id = c.teacher_id and cc.course = c.course
      and private.is_class_member(c.id)
  ) then raise exception 'Atividade indisponível para esta conta.' using errcode = '42501'; end if;
end $$;
create function private.require_case_access(p_case_id uuid) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if exists(select 1 from public.clinical_cases where id=p_case_id and owner_teacher_id is not null) and (auth.uid() is null or not private.can_read_case(p_case_id)) then
    raise exception 'Caso indisponível para esta conta.' using errcode = '42501';
  end if;
end $$;

create function private.teaching_bootstrap() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := private.google_email(); v_role public.app_role; v_name text;
begin
  if auth.uid() is null or v_email is null then raise exception 'Entre com uma conta Google com e-mail confirmado.' using errcode = '42501'; end if;
  -- Serialize bootstrap calls from the shell and the page during OAuth recovery.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 731));
  if exists(select 1 from public.admins where user_id = auth.uid()) then v_role := 'admin';
  elsif exists(select 1 from private.teacher_allowlist where email = v_email and enabled) then v_role := 'teacher';
  else v_role := 'student'; end if;
  update public.profiles set role = v_role where user_id = auth.uid();
  if v_role = 'teacher' then insert into public.teachers(user_id) values(auth.uid()) on conflict do nothing; end if;
  if v_role = 'student' then
    insert into public.students(user_id) values(auth.uid()) on conflict do nothing;
    update public.classroom_enrollments set student_id = auth.uid(), status = 'active'
      where email = v_email and status <> 'revoked' and (student_id is distinct from auth.uid() or status <> 'active');
  end if;
  -- A display name is cosmetic only. It never grants permissions.
  select coalesce(nullif(left(raw_user_meta_data->>'full_name',120),''),split_part(v_email,'@',1)) into v_name from auth.users where id = auth.uid();
  return jsonb_build_object('userId',auth.uid(),'email',v_email,'displayName',v_name,'role',v_role);
end $$;

create function private.teaching_save_classroom(p_input jsonb, p_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid := private.require_teacher(); v_id uuid;
begin
  if p_id is null then
    insert into public.classrooms(teacher_id,name,course,description,term) values(v_teacher,btrim(p_input->>'name'),(p_input->>'course')::public.course_code,coalesce(p_input->>'description',''),coalesce(p_input->>'term','')) returning id into v_id;
  else
    perform 1 from public.classrooms c where c.id = p_id and c.teacher_id = v_teacher for update;
    if not found then raise exception 'Turma indisponível.' using errcode='42501'; end if;
    if exists(select 1 from public.classrooms c where c.id=p_id and c.course::text is distinct from p_input->>'course') and exists(select 1 from public.classroom_assignments a where a.classroom_id=p_id) then
      raise exception 'O curso de uma turma com atividades não pode ser alterado.' using errcode='22023';
    end if;
    update public.classrooms set name=btrim(p_input->>'name'), course=(p_input->>'course')::public.course_code, description=coalesce(p_input->>'description',''),term=coalesce(p_input->>'term','') where id=p_id;
    v_id := p_id;
  end if;
  return v_id;
end $$;
create function private.teaching_archive_classroom(p_id uuid,p_archived boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_teacher();
  update public.classrooms set archived=p_archived where id=p_id and teacher_id=private.teacher_id();
  if not found then raise exception 'Turma indisponível.' using errcode='42501'; end if;
end $$;
create function private.teaching_enroll(p_classroom_id uuid,p_emails text[]) returns void language plpgsql security definer set search_path = '' as $$
declare v_email text; v_student uuid;
begin
  perform private.require_teacher();
  perform 1 from public.classrooms where id=p_classroom_id and teacher_id=private.teacher_id() and not archived for update;
  if not found then raise exception 'Turma indisponível.' using errcode='42501'; end if;
  if coalesce(cardinality(p_emails),0) not between 1 and 100 then raise exception 'Informe até 100 e-mails válidos.' using errcode='22023'; end if;
  foreach v_email in array p_emails loop
    v_email := lower(btrim(v_email));
    if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido. Nenhum aluno foi adicionado.' using errcode='22023'; end if;
    select u.id into v_student from auth.users u join public.profiles p on p.user_id=u.id
      where lower(u.email)=v_email and u.email_confirmed_at is not null and p.role='student'
        and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google' and i.identity_data->>'email_verified'='true' and lower(i.identity_data->>'email')=v_email);
    insert into public.classroom_enrollments(classroom_id,email,student_id,status) values(p_classroom_id,v_email,v_student,case when v_student is null then 'invited' else 'active' end)
      on conflict(classroom_id,email) do update set student_id=excluded.student_id,status=excluded.status;
  end loop;
end $$;
create function private.teaching_revoke_enrollment(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_teacher();
  update public.classroom_enrollments e set status='revoked' where e.id=p_id and private.owns_classroom(e.classroom_id);
  if not found then raise exception 'Vínculo indisponível.' using errcode='42501'; end if;
end $$;

create function private.validate_teaching_draft(p_draft jsonb,p_publish boolean) returns void language plpgsql set search_path = '' as $$
declare s jsonb; o jsonb; v_pos bigint; v_count integer; v_target bigint; k text; v_seen text[] := '{}'; v_option_ids text[]; v_has_decision boolean := false;
begin
  if jsonb_typeof(p_draft) is distinct from 'object' then raise exception 'Caso inválido.' using errcode='22023'; end if;
  foreach k in array array['title','description','objective','patientName','pronouns','reference'] loop
    if jsonb_typeof(p_draft->k) is distinct from 'string' then raise exception 'Preencha os campos de texto do caso.' using errcode='22023'; end if;
  end loop;
  if length(btrim(p_draft->>'title')) not between 1 and 160
    or length(p_draft->>'description')>4000 or (p_publish and btrim(p_draft->>'description')='')
    or length(p_draft->>'objective')>2000 or (p_publish and btrim(p_draft->>'objective')='')
    or length(p_draft->>'patientName')>120 or (p_publish and btrim(p_draft->>'patientName')='')
    or length(p_draft->>'pronouns')>80 or length(p_draft->>'reference')>4000
    or coalesce(p_draft->>'course','') not in ('nursing','clinical_analysis')
    or jsonb_typeof(p_draft->'reviewed') is distinct from 'boolean'
    or coalesce(p_draft->>'patientAge','') !~ '^[0-9]{1,3}$' then raise exception 'Revise o contexto, o curso e a idade do paciente.' using errcode='22023'; end if;
  if (p_draft->>'patientAge')::integer >120 then raise exception 'Idade fora do intervalo permitido.' using errcode='22023'; end if;
  if p_publish and (p_draft->>'reviewed' is distinct from 'true' or btrim(p_draft->>'reference')='') then raise exception 'Informe as referências e confirme a revisão antes de publicar.' using errcode='22023'; end if;
  if jsonb_typeof(p_draft->'steps') is distinct from 'array' then raise exception 'As etapas são obrigatórias.' using errcode='22023'; end if;
  v_count := jsonb_array_length(p_draft->'steps');
  if v_count>30 or (p_publish and v_count<1) then raise exception 'Inclua entre 1 e 30 etapas.' using errcode='22023'; end if;
  for s,v_pos in select value,ordinality from jsonb_array_elements(p_draft->'steps') with ordinality loop
    if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'key','') !~ '^[a-zA-Z0-9-]{1,80}$' or s->>'key'=any(v_seen)
      or coalesce(s->>'type','') not in ('information','decision') or coalesce(s->>'presentationState','') not in ('stable','warning','critical','recovery')
      or jsonb_typeof(s->'title') is distinct from 'string' or length(s->>'title')>160 or (p_publish and btrim(s->>'title')='')
      or jsonb_typeof(s->'body') is distinct from 'string' or length(s->>'body')>8000 or (p_publish and btrim(s->>'body')='')
      or jsonb_typeof(s->'observations') is distinct from 'array' or jsonb_typeof(s->'options') is distinct from 'array'
      then raise exception 'Etapa inválida: %.',v_pos using errcode='22023'; end if;
    v_seen := array_append(v_seen,s->>'key');
    if jsonb_array_length(s->'observations')>20 or exists(select 1 from jsonb_array_elements(s->'observations') obs where jsonb_typeof(obs) <> 'string' or length(obs#>>'{}')>1000) then raise exception 'Revise as observações da etapa %.',v_pos using errcode='22023'; end if;
    if s->>'type'='information' then continue; end if;
    v_has_decision := true; v_option_ids := '{}';
    if jsonb_array_length(s->'options') not between 2 and 8 then raise exception 'Inclua entre 2 e 8 alternativas na etapa %.',v_pos using errcode='22023'; end if;
    for o in select value from jsonb_array_elements(s->'options') loop
      if jsonb_typeof(o) is distinct from 'object' or coalesce(o->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or o->>'id'=any(v_option_ids)
        or jsonb_typeof(o->'label') is distinct from 'string' or length(o->>'label')>2000 or (p_publish and btrim(o->>'label')='')
        or jsonb_typeof(o->'feedback') is distinct from 'string' or length(o->>'feedback')>4000 or (p_publish and btrim(o->>'feedback')='')
        or jsonb_typeof(o->'consequence') is distinct from 'string' or length(o->>'consequence')>2000
        or coalesce(o->>'classification','') not in ('ideal','acceptable','needs_improvement','unsafe')
        or coalesce(o->>'presentationState','') not in ('stable','warning','critical','recovery')
        or jsonb_typeof(o->'scoreDelta') is distinct from 'number' or coalesce(o->>'scoreDelta','') !~ '^-?[0-9]{1,3}$'
        or jsonb_typeof(o->'nextStepKey') is distinct from 'string' then raise exception 'Revise as alternativas da etapa %.',v_pos using errcode='22023'; end if;
      v_option_ids := array_append(v_option_ids,o->>'id');
      if abs((o->>'scoreDelta')::integer)>100 then raise exception 'Pontuação fora do intervalo permitido.' using errcode='22023'; end if;
      if o->>'nextStepKey' not in ('next','complete') then
        select ordinality into v_target from jsonb_array_elements(p_draft->'steps') with ordinality where value->>'key'=o->>'nextStepKey';
        if v_target is null or v_target<=v_pos then raise exception 'A ramificação deve apontar para uma etapa posterior.' using errcode='22023'; end if;
      end if;
    end loop;
  end loop;
  if p_publish and not v_has_decision then raise exception 'Inclua pelo menos uma decisão.' using errcode='22023'; end if;
end $$;

create function private.teaching_save_case(p_draft jsonb,p_id uuid default null,p_publish boolean default false) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid := private.require_teacher(); v_id uuid := coalesce(p_id,gen_random_uuid()); v_patient uuid; v_status public.case_status; s jsonb; o jsonb; v_step uuid; v_position bigint; v_options jsonb; v_rules jsonb; v_rule jsonb;
begin
  if p_publish is null or pg_column_size(p_draft)>262144 then raise exception 'Caso inválido ou muito grande.' using errcode='22023'; end if;
  perform private.validate_teaching_draft(p_draft,p_publish);
  if p_id is not null then
    select patient_id,status into v_patient,v_status from public.clinical_cases where id=p_id and owner_teacher_id=v_teacher for update;
    if not found then raise exception 'Caso indisponível.' using errcode='42501'; end if;
    if v_status <> 'draft' or exists(select 1 from public.simulation_sessions where case_id=p_id) then raise exception 'Esta versão está preservada. Duplique o caso para alterá-lo.' using errcode='22023'; end if;
    update public.patients set display_name=coalesce(nullif(btrim(p_draft->>'patientName'),''),'Paciente fictício'),age_years=(p_draft->>'patientAge')::smallint,pronouns=nullif(btrim(p_draft->>'pronouns'),'') where id=v_patient;
  else
    insert into public.patients(display_name,age_years,pronouns) values(coalesce(nullif(btrim(p_draft->>'patientName'),''),'Paciente fictício'),(p_draft->>'patientAge')::smallint,nullif(btrim(p_draft->>'pronouns'),'')) returning id into v_patient;
    insert into public.clinical_cases(id,patient_id,slug,title,course,description,owner_teacher_id) values(v_id,v_patient,'docente-'||v_id::text,btrim(p_draft->>'title'),(p_draft->>'course')::public.course_code,coalesce(nullif(btrim(p_draft->>'description'),''),'Rascunho em elaboração.'),v_teacher);
  end if;
  update public.clinical_cases set title=btrim(p_draft->>'title'),course=(p_draft->>'course')::public.course_code,description=coalesce(nullif(btrim(p_draft->>'description'),''),'Rascunho em elaboração.'),educational_objective=btrim(p_draft->>'objective'),status=case when p_publish then 'published'::public.case_status else 'draft'::public.case_status end,metadata=jsonb_build_object('teacher_reviewed',p_publish) where id=v_id;
  insert into public.teaching_case_drafts(case_id,teacher_id,draft) values(v_id,v_teacher,p_draft) on conflict(case_id) do update set draft=excluded.draft;
  delete from public.case_steps where case_id=v_id;
  for s,v_position in select value,ordinality from jsonb_array_elements(p_draft->'steps') with ordinality loop
    select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','label',value->>'label')),'[]'::jsonb) into v_options from jsonb_array_elements(s->'options');
    insert into public.case_steps(case_id,position,step_key,step_type,title,content,options,metadata)
      values(v_id,v_position,s->>'key',s->>'type',nullif(btrim(s->>'title'),''),jsonb_build_object('body',s->>'body','observations',s->'observations'),case when s->>'type'='decision' then v_options else '[]'::jsonb end,jsonb_build_object('presentation_state',s->>'presentationState')) returning id into v_step;
    if s->>'type'='decision' then
      v_rules := '{}'::jsonb;
      for o in select value from jsonb_array_elements(s->'options') loop
        v_rule := jsonb_build_object('classification',o->>'classification','score_delta',(o->>'scoreDelta')::integer,'feedback',o->>'feedback','consequence',nullif(btrim(o->>'consequence'),''),'presentation_state',o->>'presentationState');
        if o->>'nextStepKey'='complete' then v_rule := v_rule || jsonb_build_object('transition',jsonb_build_object('type','complete'));
        elsif o->>'nextStepKey'<>'next' then v_rule := v_rule || jsonb_build_object('transition',jsonb_build_object('type','step','step_key',o->>'nextStepKey')); end if;
        v_rules := v_rules || jsonb_build_object(o->>'id',v_rule);
      end loop;
      insert into public.case_step_rules(step_id,rules) values(v_step,jsonb_build_object('options',v_rules));
    end if;
  end loop;
  insert into public.case_truth_models(case_id,truth_model,reviewed_at) values(v_id,jsonb_build_object('evidence',case when btrim(p_draft->>'reference')='' then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id','referencia-docente','authority','Referência informada pelo docente','title',p_draft->>'reference')) end),case when p_publish then now() else null end)
    on conflict(case_id) do update set truth_model=excluded.truth_model,reviewed_at=excluded.reviewed_at,version=public.case_truth_models.version+1;
  return v_id;
end $$;
create function private.teaching_archive_case(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_teacher();
  update public.clinical_cases set status='archived' where id=p_id and owner_teacher_id=private.teacher_id();
  if not found then raise exception 'Caso indisponível.' using errcode='42501'; end if;
  update public.classroom_assignments set status='closed' where case_id=p_id;
end $$;
create function private.teaching_assign_case(p_classroom_id uuid,p_case_id uuid,p_title text,p_due_at timestamptz default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_teacher();
  if not exists(select 1 from public.classrooms c join public.clinical_cases cc on cc.course=c.course
    where c.id=p_classroom_id and cc.id=p_case_id and c.teacher_id=private.teacher_id() and cc.owner_teacher_id=c.teacher_id and cc.status='published' and not c.archived) then raise exception 'Escolha um caso publicado do mesmo curso e uma turma ativa.' using errcode='42501'; end if;
  insert into public.classroom_assignments(classroom_id,case_id,title,due_at) values(p_classroom_id,p_case_id,btrim(p_title),p_due_at) returning id into v_id;
  return v_id;
end $$;
create function private.teaching_set_assignment_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_teacher();
  if p_status is null or p_status not in ('open','closed') then raise exception 'Situação inválida.' using errcode='22023'; end if;
  update public.classroom_assignments a set status=p_status from public.classrooms c,public.clinical_cases cc
    where a.id=p_id and c.id=a.classroom_id and cc.id=a.case_id and c.teacher_id=private.teacher_id()
      and (p_status='closed' or (not c.archived and cc.status='published'));
  if not found then raise exception 'Atividade indisponível.' using errcode='42501'; end if;
end $$;

-- The engine remains authoritative; bind every authored-case attempt to its class activity.
create function private.guard_classroom_session() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignment_id is null and not exists(select 1 from public.clinical_cases where id=new.case_id and owner_teacher_id is not null) then return new; end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Tentativa indisponível.' using errcode='42501'; end if;
  if tg_op='UPDATE' then
    if new.assignment_id is distinct from old.assignment_id or new.case_id is distinct from old.case_id or new.user_id is distinct from old.user_id or new.classroom_student_email is distinct from old.classroom_student_email then raise exception 'O vínculo da tentativa é imutável.' using errcode='42501'; end if;
    if new.status='abandoned' then return new; end if;
  end if;
  perform private.require_assignment(new.case_id,new.assignment_id);
  if tg_op='INSERT' then new.classroom_student_email := private.google_email(); end if;
  return new;
end $$;
create trigger classroom_session_guard before insert or update on public.simulation_sessions for each row execute function private.guard_classroom_session();
create function private.guard_classroom_action() returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.simulation_sessions%rowtype;
begin
  select * into s from public.simulation_sessions where id=new.session_id;
  if s.assignment_id is not null then perform private.require_assignment(s.case_id,s.assignment_id); end if;
  return new;
end $$;
create trigger classroom_action_guard before insert on public.simulation_actions for each row execute function private.guard_classroom_action();

-- Same P8 implementation, now scoped by assignment as well as user and case.
create or replace function private.start_classroom_simulation(
  p_case_id uuid,
  p_assignment_id uuid default null
)
returns table (
  session_id uuid,
  case_id uuid,
  status public.simulation_status,
  current_step_id uuid,
  current_step_key text,
  score_total integer,
  decision_count integer,
  started_at timestamptz,
  resumed boolean,
  selected_option_id text,
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  transition_completed boolean,
  presentation_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_course public.course_code;
  v_case_id uuid;
  v_first_step_id uuid;
  v_session public.simulation_sessions%rowtype;
  v_action public.simulation_actions%rowtype;
  v_current_step_key text;
  v_current_step_state text;
  v_decision_count integer;
  v_resumed boolean := false;
begin
  perform private.require_assignment(p_case_id,p_assignment_id);
  if v_user_id is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = v_user_id
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de iniciar a simulação.'
      using errcode = '42501';
  end if;

  select clinical_case.id
  into v_case_id
  from public.clinical_cases as clinical_case
  where clinical_case.id = p_case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  select case_step.id
  into v_first_step_id
  from public.case_steps as case_step
  where case_step.case_id = v_case_id
    and case_step.step_type in ('information', 'decision')
  order by case_step.position asc
  limit 1;

  if not found then
    raise exception 'O caso publicado não possui uma primeira etapa.'
      using errcode = 'P0001';
  end if;

  select simulation_session.*
  into v_session
  from public.simulation_sessions as simulation_session
  where simulation_session.user_id = v_user_id
    and simulation_session.case_id = v_case_id
    and simulation_session.assignment_id is not distinct from p_assignment_id
    and simulation_session.status = 'in_progress'::public.simulation_status
  for update;

  if found then
    v_resumed := true;
  else
    begin
      insert into public.simulation_sessions (
        user_id,
        case_id,
        assignment_id,
        status,
        current_step_id,
        score_total,
        started_at,
        completed_at
      )
      values (
        v_user_id,
        v_case_id,
        p_assignment_id,
        'in_progress'::public.simulation_status,
        v_first_step_id,
        0,
        now(),
        null
      )
      returning * into v_session;
    exception
      when unique_violation then
      select simulation_session.*
      into v_session
      from public.simulation_sessions as simulation_session
      where simulation_session.user_id = v_user_id
        and simulation_session.case_id = v_case_id
    and simulation_session.assignment_id is not distinct from p_assignment_id
        and simulation_session.status = 'in_progress'::public.simulation_status
      for update;

      if not found then
        raise exception 'Não foi possível criar ou retomar a sessão.'
          using errcode = 'P0001';
      end if;

      v_resumed := true;
    end;
  end if;

  select
    case_step.step_key,
    case
      when case_step.metadata ->> 'presentation_state' in (
        'stable', 'warning', 'critical', 'recovery'
      ) then case_step.metadata ->> 'presentation_state'
      else 'stable'
    end
  into v_current_step_key, v_current_step_state
  from public.case_steps as case_step
  where case_step.id = v_session.current_step_id
    and case_step.case_id = v_session.case_id;

  if not found then
    raise exception 'A sessão aponta para uma etapa inválida.'
      using errcode = 'P0001';
  end if;

  select simulation_action.*
  into v_action
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id
    and simulation_action.step_id = v_session.current_step_id;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id;

  if v_action.id is not null and (
    v_action.outcome is null
    or jsonb_typeof(v_action.outcome) is distinct from 'object'
    or v_action.outcome ->> 'schema_version' is distinct from '1'
    or v_action.outcome ->> 'classification' is null
    or v_action.outcome ->> 'classification' not in (
      'ideal', 'acceptable', 'needs_improvement', 'unsafe'
    )
    or jsonb_typeof(v_action.outcome -> 'feedback') is distinct from 'string'
    or nullif(btrim(v_action.outcome ->> 'feedback'), '') is null
    or jsonb_typeof(v_action.outcome -> 'completed') is distinct from 'boolean'
    or (
      v_action.outcome -> 'consequence' is not null
      and jsonb_typeof(v_action.outcome -> 'consequence') not in ('string', 'null')
    )
    or (
      v_action.outcome -> 'next_step_key' is not null
      and jsonb_typeof(v_action.outcome -> 'next_step_key') not in ('string', 'null')
    )
    or (
      v_action.outcome -> 'presentation_state' is not null
      and jsonb_typeof(v_action.outcome -> 'presentation_state') not in ('string', 'null')
    )
    or (
      nullif(v_action.outcome ->> 'presentation_state', '') is not null
      and v_action.outcome ->> 'presentation_state' not in (
        'stable', 'warning', 'critical', 'recovery'
      )
    )
    or (
      v_action.outcome ->> 'completed' = 'true'
      and nullif(v_action.outcome ->> 'next_step_key', '') is not null
    )
    or (
      v_action.outcome ->> 'completed' = 'false'
      and nullif(v_action.outcome ->> 'next_step_key', '') is null
    )
  ) then
    raise exception
      'A ação existente não possui um snapshot P8 válido; saneamento explícito é necessário.'
      using errcode = 'P0001';
  end if;

  return query
  select
    v_session.id,
    v_session.case_id,
    v_session.status,
    v_session.current_step_id,
    v_current_step_key,
    v_session.score_total,
    v_decision_count,
    v_session.started_at,
    v_resumed,
    v_action.selected_option_id,
    v_action.outcome ->> 'classification',
    case when v_action.id is null then null else v_action.score_delta end,
    v_action.outcome ->> 'feedback',
    nullif(v_action.outcome ->> 'consequence', ''),
    nullif(v_action.outcome ->> 'next_step_key', ''),
    case
      when v_action.id is null then null
      else (v_action.outcome ->> 'completed')::boolean
    end,
    coalesce(
      nullif(v_action.outcome ->> 'presentation_state', ''),
      v_current_step_state
    );
end;
$$;


drop function public.start_or_resume_simulation_session(uuid);
create function public.start_or_resume_simulation_session(p_case_id uuid,p_assignment_id uuid default null)
returns table (
  session_id uuid,
  case_id uuid,
  status public.simulation_status,
  current_step_id uuid,
  current_step_key text,
  score_total integer,
  decision_count integer,
  started_at timestamptz,
  resumed boolean,
  selected_option_id text,
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  transition_completed boolean,
  presentation_state text
)
language sql security invoker set search_path = '' as $$ select * from private.start_classroom_simulation(p_case_id,p_assignment_id); $$;

create or replace function private.resolve_simulation_transition_internal(
  p_case_id uuid,
  p_step_id uuid,
  p_option_id text default null
)
returns table (
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  completed boolean,
  presentation_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_course public.course_code;
  v_step_type text;
  v_step_position integer;
  v_selected_rule jsonb;
  v_transition jsonb;
  v_target_metadata jsonb;
begin
  perform private.require_case_access(p_case_id);
  if auth.uid() is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = auth.uid()
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de iniciar a simulação.'
      using errcode = '42501';
  end if;

  perform 1
  from public.clinical_cases as clinical_case
  where clinical_case.id = p_case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  select case_step.step_type, case_step.position
  into v_step_type, v_step_position
  from public.case_steps as case_step
  where case_step.id = p_step_id
    and case_step.case_id = p_case_id;

  if not found or v_step_type not in ('information', 'decision') then
    raise exception 'Etapa inválida ou não suportada para este caso.'
      using errcode = 'P0001';
  end if;

  classification := null;
  score_delta := 0;
  feedback := null;
  consequence := null;
  next_step_key := null;
  completed := false;
  presentation_state := null;

  if v_step_type = 'information' then
    if p_option_id is not null then
      raise exception 'Etapas informativas não aceitam opção.' using errcode = 'P0001';
    end if;

    select next_step.step_key, next_step.metadata
    into next_step_key, v_target_metadata
    from public.case_steps as next_step
    where next_step.case_id = p_case_id
      and next_step.position > v_step_position
    order by next_step.position asc
    limit 1;

    completed := not found;
  else
    if p_option_id is null or btrim(p_option_id) = '' then
      raise exception 'Etapas de decisão exigem uma opção.' using errcode = 'P0001';
    end if;

    perform 1
    from public.case_steps as visible_step
    cross join lateral jsonb_array_elements(visible_step.options) as visible_option
    where visible_step.id = p_step_id
      and visible_step.case_id = p_case_id
      and jsonb_typeof(visible_option) = 'object'
      and visible_option ->> 'id' = p_option_id;

    if not found then
      raise exception 'Opção inválida para esta etapa.' using errcode = 'P0001';
    end if;

    select step_rule.rules -> 'options' -> p_option_id
    into v_selected_rule
    from public.case_step_rules as step_rule
    where step_rule.step_id = p_step_id;

    if not found
      or v_selected_rule is null
      or jsonb_typeof(v_selected_rule) <> 'object'
      or v_selected_rule ->> 'classification' not in (
        'ideal',
        'acceptable',
        'needs_improvement',
        'unsafe'
      )
      or jsonb_typeof(v_selected_rule -> 'score_delta') <> 'number'
      or (v_selected_rule ->> 'score_delta') !~ '^-?[0-9]+$'
      or jsonb_typeof(v_selected_rule -> 'feedback') <> 'string'
      or nullif(btrim(v_selected_rule ->> 'feedback'), '') is null
      or (
        v_selected_rule ? 'consequence'
        and jsonb_typeof(v_selected_rule -> 'consequence') not in ('string', 'null')
      )
    then
      raise exception 'Regra de avaliação indisponível para esta opção.'
        using errcode = 'P0001';
    end if;

    classification := v_selected_rule ->> 'classification';
    score_delta := (v_selected_rule ->> 'score_delta')::integer;
    feedback := v_selected_rule ->> 'feedback';
    consequence := nullif(btrim(v_selected_rule ->> 'consequence'), '');
    v_transition := v_selected_rule -> 'transition';

    if v_transition is null or jsonb_typeof(v_transition) = 'null' then
      select next_step.step_key, next_step.metadata
      into next_step_key, v_target_metadata
      from public.case_steps as next_step
      where next_step.case_id = p_case_id
        and next_step.position > v_step_position
      order by next_step.position asc
      limit 1;

      completed := not found;
    elsif jsonb_typeof(v_transition) <> 'object' then
      raise exception 'Transição inválida para esta opção.' using errcode = 'P0001';
    elsif v_transition ->> 'type' = 'step' then
      if jsonb_typeof(v_transition -> 'step_key') <> 'string'
        or nullif(btrim(v_transition ->> 'step_key'), '') is null
      then
        raise exception 'Transição de etapa sem destino válido.' using errcode = 'P0001';
      end if;

      select target_step.step_key, target_step.metadata
      into next_step_key, v_target_metadata
      from public.case_steps as target_step
      where target_step.case_id = p_case_id
        and target_step.step_key = v_transition ->> 'step_key';

      if not found then
        raise exception 'Destino da transição não pertence a este caso.'
          using errcode = 'P0001';
      end if;
    elsif v_transition ->> 'type' = 'complete' then
      completed := true;
      next_step_key := null;
    else
      raise exception 'Tipo de transição inválido.' using errcode = 'P0001';
    end if;

    if v_selected_rule ? 'presentation_state' then
      if jsonb_typeof(v_selected_rule -> 'presentation_state') <> 'string' then
        raise exception 'Estado de apresentação inválido.' using errcode = 'P0001';
      end if;

      presentation_state := v_selected_rule ->> 'presentation_state';
    end if;
  end if;

  if presentation_state is null and v_target_metadata ? 'presentation_state' then
    if jsonb_typeof(v_target_metadata -> 'presentation_state') <> 'string' then
      raise exception 'Estado de apresentação inválido.' using errcode = 'P0001';
    end if;

    presentation_state := v_target_metadata ->> 'presentation_state';
  end if;

  if presentation_state is not null
    and presentation_state not in ('stable', 'warning', 'critical', 'recovery')
  then
    raise exception 'Estado de apresentação inválido.' using errcode = 'P0001';
  end if;

  return next;
end;
$$;

create or replace function public.evaluate_case_step(
  p_case_id uuid,
  p_step_id uuid,
  p_option_id text
)
returns table (
  classification text,
  score_delta integer,
  feedback text,
  consequence text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_course public.course_code;
  v_rules jsonb;
  v_selected_rule jsonb;
begin
  if exists(select 1 from public.clinical_cases where id=p_case_id and owner_teacher_id is not null) then raise exception 'Registre sua escolha pela atividade da turma.' using errcode='42501'; end if;
  perform private.require_case_access(p_case_id);
  if auth.uid() is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = auth.uid()
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de iniciar a simulação.'
      using errcode = '42501';
  end if;

  perform 1
  from public.clinical_cases as clinical_case
  where clinical_case.id = p_case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  perform 1
  from public.case_steps as case_step
  where case_step.id = p_step_id
    and case_step.case_id = p_case_id
    and case_step.step_type = 'decision';

  if not found then
    raise exception 'Etapa de decisão inválida para este caso.'
      using errcode = 'P0001';
  end if;

  if p_option_id is null or btrim(p_option_id) = '' or not exists (
    select 1
    from public.case_steps as visible_step
    cross join lateral jsonb_array_elements(visible_step.options) as visible_option
    where visible_step.id = p_step_id
      and visible_step.case_id = p_case_id
      and visible_option ->> 'id' = p_option_id
  ) then
    raise exception 'Opção inválida para esta etapa.' using errcode = 'P0001';
  end if;

  select step_rule.rules
  into v_rules
  from public.case_step_rules as step_rule
  where step_rule.step_id = p_step_id;

  if not found then
    raise exception 'Regra de avaliação indisponível para esta etapa.'
      using errcode = 'P0001';
  end if;

  v_selected_rule := v_rules -> 'options' -> p_option_id;

  if v_selected_rule is null
    or jsonb_typeof(v_selected_rule) <> 'object'
    or v_selected_rule ->> 'classification' not in (
      'ideal',
      'acceptable',
      'needs_improvement',
      'unsafe'
    )
    or jsonb_typeof(v_selected_rule -> 'score_delta') <> 'number'
    or (v_selected_rule ->> 'score_delta') !~ '^-?[0-9]+$'
    or nullif(btrim(v_selected_rule ->> 'feedback'), '') is null
  then
    raise exception 'Regra de avaliação indisponível para esta opção.'
      using errcode = 'P0001';
  end if;

  return query
  select
    v_selected_rule ->> 'classification',
    (v_selected_rule ->> 'score_delta')::integer,
    v_selected_rule ->> 'feedback',
    nullif(btrim(v_selected_rule ->> 'consequence'), '');
end;
$$;

-- Shared sanitizer. No browser role can execute this builder.
create or replace function private.build_simulation_debrief(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_session public.simulation_sessions%rowtype;
  v_case public.clinical_cases%rowtype;
  v_decision_count integer;
  v_decisions jsonb;
  v_references jsonb;
begin
  if v_user_id is null then
    raise exception 'Este resultado não está disponível.' using errcode = '42501';
  end if;

  select simulation_session.*
  into v_session
  from public.simulation_sessions as simulation_session
  where simulation_session.id = p_session_id
    and simulation_session.user_id = v_user_id
    and simulation_session.status = 'completed'::public.simulation_status;

  if not found or v_session.completed_at is null then
    raise exception 'Este resultado não está disponível.' using errcode = 'P0001';
  end if;

  -- Historical ownership is sufficient. A completed result remains available
  -- when its case is archived, so this lookup intentionally has no status gate.
  select clinical_case.*
  into v_case
  from public.clinical_cases as clinical_case
  where clinical_case.id = v_session.case_id;

  if not found then
    raise exception 'Este resultado não está disponível.' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id
    and simulation_action.user_id = v_user_id;

  if exists (
    select 1
    from public.simulation_actions as simulation_action
    left join public.case_steps as case_step
      on case_step.id = simulation_action.step_id
      and case_step.case_id = v_session.case_id
    where simulation_action.session_id = v_session.id
      and simulation_action.user_id = v_user_id
      and (
        case_step.id is null
        or case_step.step_type <> 'decision'
        or simulation_action.outcome is null
        or jsonb_typeof(simulation_action.outcome) is distinct from 'object'
        or simulation_action.outcome ->> 'schema_version' is distinct from '1'
        or not (simulation_action.outcome ? 'selected_option_label')
        or jsonb_typeof(
          simulation_action.outcome -> 'selected_option_label'
        ) is distinct from 'string'
        or nullif(
          btrim(simulation_action.outcome ->> 'selected_option_label'),
          ''
        ) is null
        or not (simulation_action.outcome ? 'classification')
        or simulation_action.outcome ->> 'classification' not in (
          'ideal',
          'acceptable',
          'needs_improvement',
          'unsafe'
        )
        or not (simulation_action.outcome ? 'feedback')
        or jsonb_typeof(
          simulation_action.outcome -> 'feedback'
        ) is distinct from 'string'
        or nullif(btrim(simulation_action.outcome ->> 'feedback'), '') is null
        or not (simulation_action.outcome ? 'consequence')
        or jsonb_typeof(
          simulation_action.outcome -> 'consequence'
        ) not in ('string', 'null')
        or (
          jsonb_typeof(simulation_action.outcome -> 'consequence') = 'string'
          and nullif(
            btrim(simulation_action.outcome ->> 'consequence'),
            ''
          ) is null
        )
      )
  ) then
    raise exception 'Não foi possível carregar este debrief.'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action_id', simulation_action.id,
        'step_id', case_step.id,
        'step_key', case_step.step_key,
        'step_title', case_step.title,
        'position', case_step.position,
        'selected_option_id', simulation_action.selected_option_id,
        'selected_option_label',
          simulation_action.outcome ->> 'selected_option_label',
        'classification', simulation_action.outcome ->> 'classification',
        'score_delta', simulation_action.score_delta,
        'feedback', simulation_action.outcome ->> 'feedback',
        'consequence',
          case
            when jsonb_typeof(
              simulation_action.outcome -> 'consequence'
            ) = 'string'
              then simulation_action.outcome ->> 'consequence'
            else null
          end,
        'created_at', simulation_action.created_at
      )
      order by simulation_action.created_at, simulation_action.id
    ),
    '[]'::jsonb
  )
  into v_decisions
  from public.simulation_actions as simulation_action
  join public.case_steps as case_step
    on case_step.id = simulation_action.step_id
    and case_step.case_id = v_session.case_id
  where simulation_action.session_id = v_session.id
    and simulation_action.user_id = v_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', evidence_item.item ->> 'id',
          'authority', evidence_item.item ->> 'authority',
          'title', evidence_item.item ->> 'title',
          'year',
            case
              when jsonb_typeof(evidence_item.item -> 'year') = 'number'
                and evidence_item.item ->> 'year' ~ '^[0-9]{4}$'
                then (evidence_item.item ->> 'year')::integer
              else null
            end,
          'url',
            case
              when jsonb_typeof(evidence_item.item -> 'url') = 'string'
                and evidence_item.item ->> 'url' ~* '^https?://'
                then evidence_item.item ->> 'url'
              else null
            end,
          'verified_on',
            case
              when jsonb_typeof(evidence_item.item -> 'verified_on') = 'string'
                and evidence_item.item ->> 'verified_on'
                  ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                then evidence_item.item ->> 'verified_on'
              else null
            end
        )
      )
      order by evidence_item.ordinal
    ),
    '[]'::jsonb
  )
  into v_references
  from public.case_truth_models as truth_model
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(truth_model.truth_model -> 'evidence') = 'array'
        then truth_model.truth_model -> 'evidence'
      else '[]'::jsonb
    end
  ) with ordinality as evidence_item(item, ordinal)
  where truth_model.case_id = v_session.case_id
    and jsonb_typeof(evidence_item.item) = 'object'
    and jsonb_typeof(evidence_item.item -> 'id') = 'string'
    and nullif(btrim(evidence_item.item ->> 'id'), '') is not null
    and jsonb_typeof(evidence_item.item -> 'authority') = 'string'
    and nullif(btrim(evidence_item.item ->> 'authority'), '') is not null
    and jsonb_typeof(evidence_item.item -> 'title') = 'string'
    and nullif(btrim(evidence_item.item ->> 'title'), '') is not null;

  return jsonb_build_object(
    'schema_version', 1,
    'session', jsonb_build_object(
      'id', v_session.id,
      'status', v_session.status,
      'score_total', v_session.score_total,
      'decision_count', v_decision_count,
      'started_at', v_session.started_at,
      'completed_at', v_session.completed_at
    ),
    'case', jsonb_build_object(
      'id', v_case.id,
      'title', v_case.title,
      'educational_objective', nullif(btrim(v_case.educational_objective), '')
    ),
    'decisions', v_decisions,
    'references', v_references
  );
end;
$$;


create function private.student_debrief(p_session_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Este resultado não está disponível.' using errcode='42501'; end if;
  return private.build_simulation_debrief(p_session_id,auth.uid());
end $$;
create or replace function public.get_simulation_debrief(p_session_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.student_debrief(p_session_id); $$;

create function private.teaching_get_debrief(p_session_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.simulation_sessions%rowtype; v_email text; v_feedback text;
begin
  perform private.require_teacher();
  select ss.* into s from public.simulation_sessions ss join public.classroom_assignments a on a.id=ss.assignment_id
    join public.classrooms c on c.id=a.classroom_id where ss.id=p_session_id and c.teacher_id=private.teacher_id() and ss.status='completed';
  if not found then raise exception 'Este resultado não está disponível.' using errcode='42501'; end if;
  select coalesce(s.classroom_student_email,lower(email)) into v_email from auth.users where id=s.user_id;
  select feedback into v_feedback from public.teacher_feedback where session_id=s.id;
  return jsonb_build_object('debrief',private.build_simulation_debrief(s.id,s.user_id),'email',v_email,'feedback',coalesce(v_feedback,''));
end $$;
create function private.teaching_save_feedback(p_session_id uuid,p_feedback text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.teaching_get_debrief(p_session_id);
  if p_feedback is null or length(p_feedback)>5000 then raise exception 'Escreva até 5.000 caracteres.' using errcode='22023'; end if;
  insert into public.teacher_feedback(session_id,teacher_id,feedback) values(p_session_id,private.teacher_id(),p_feedback)
    on conflict(session_id) do update set feedback=excluded.feedback,updated_at=now();
end $$;

-- Small JSON projections shared by the two workspace APIs. They are not entry points.
create function private.classroom_json(c public.classrooms) returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object('id',c.id,'teacherId',c.teacher_id,'name',c.name,'course',c.course,'description',c.description,'term',c.term,'archived',c.archived,'createdAt',c.created_at);
$$;
create function private.assignment_json(a public.classroom_assignments) returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object('id',a.id,'classroomId',a.classroom_id,'caseId',a.case_id,'title',a.title,'dueAt',a.due_at,'status',a.status,'createdAt',a.created_at);
$$;
create function private.attempt_json(s public.simulation_sessions) returns jsonb language sql stable set search_path = '' as $$
 select jsonb_build_object('id',s.id,'assignmentId',s.assignment_id,'studentId',s.user_id,'email',coalesce(s.classroom_student_email,(select lower(u.email) from auth.users u where u.id=s.user_id)),
 'caseTitle',(select title from public.clinical_cases where id=s.case_id),'status',s.status,'scoreTotal',s.score_total,
 'decisionCount',(select count(*) from public.simulation_actions where session_id=s.id),'startedAt',s.started_at,'completedAt',s.completed_at,
 'feedback',coalesce((select feedback from public.teacher_feedback where session_id=s.id),''));
$$;
create function private.teaching_workspace() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_teacher uuid := private.require_teacher();
begin
 return jsonb_build_object(
  'classrooms',coalesce((select jsonb_agg(private.classroom_json(c) order by c.created_at desc,c.id) from public.classrooms c where c.teacher_id=v_teacher),'[]'::jsonb),
  'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'classroomId',e.classroom_id,'email',e.email,'studentId',e.student_id,'status',e.status,'createdAt',e.created_at) order by e.email) from public.classroom_enrollments e join public.classrooms c on c.id=e.classroom_id where c.teacher_id=v_teacher),'[]'::jsonb),
  'cases',coalesce((select jsonb_agg(jsonb_build_object('id',cc.id,'teacherId',d.teacher_id,'status',cc.status,'draft',d.draft,'createdAt',cc.created_at) order by cc.created_at desc,cc.id) from public.teaching_case_drafts d join public.clinical_cases cc on cc.id=d.case_id where d.teacher_id=v_teacher),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(private.assignment_json(a) order by a.created_at desc,a.id) from public.classroom_assignments a join public.classrooms c on c.id=a.classroom_id where c.teacher_id=v_teacher),'[]'::jsonb),
  'attempts',coalesce((select jsonb_agg(private.attempt_json(s) order by s.started_at desc,s.id) from public.simulation_sessions s join public.classroom_assignments a on a.id=s.assignment_id join public.classrooms c on c.id=a.classroom_id where c.teacher_id=v_teacher),'[]'::jsonb));
end $$;
create function private.student_workspace() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or private.google_email() is null or not exists(select 1 from public.profiles where user_id=auth.uid() and role='student') then raise exception 'Entre como aluno com sua conta Google.' using errcode='42501'; end if;
 return jsonb_build_object(
 'classrooms',coalesce((select jsonb_agg(private.classroom_json(c) order by c.created_at,c.id) from public.classrooms c where not c.archived and private.is_class_member(c.id)),'[]'::jsonb),
 'assignments',coalesce((select jsonb_agg(private.assignment_json(a)||jsonb_build_object('classroomName',c.name,'course',c.course,'caseTitle',cc.title,'description',cc.description,'objective',cc.educational_objective) order by a.created_at desc,a.id)
   from public.classroom_assignments a join public.classrooms c on c.id=a.classroom_id join public.clinical_cases cc on cc.id=a.case_id where not c.archived and private.is_class_member(c.id)),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(private.attempt_json(s) order by s.started_at desc,s.id) from public.simulation_sessions s where s.user_id=auth.uid() and s.assignment_id is not null),'[]'::jsonb));
end $$;

-- All exposed tables have RLS and read-only API grants. Writes use checked RPCs.
alter table public.classrooms enable row level security;
alter table public.classroom_enrollments enable row level security;
alter table public.teaching_case_drafts enable row level security;
alter table public.classroom_assignments enable row level security;
alter table public.teacher_feedback enable row level security;
revoke all on public.classrooms,public.classroom_enrollments,public.teaching_case_drafts,public.classroom_assignments,public.teacher_feedback from public,anon,authenticated;
grant select on public.classrooms,public.classroom_enrollments,public.teaching_case_drafts,public.classroom_assignments,public.teacher_feedback to authenticated;
grant all on public.classrooms,public.classroom_enrollments,public.teaching_case_drafts,public.classroom_assignments,public.teacher_feedback to service_role;
create policy classrooms_read on public.classrooms for select to authenticated using (teacher_id=private.teacher_id() or (not archived and private.is_class_member(id)));
create policy enrollments_read on public.classroom_enrollments for select to authenticated using (private.owns_classroom(classroom_id) or (student_id=(select auth.uid()) and email=private.google_email()));
create policy teaching_drafts_read on public.teaching_case_drafts for select to authenticated using (teacher_id=private.teacher_id());
create policy assignments_read on public.classroom_assignments for select to authenticated using (private.owns_classroom(classroom_id) or private.is_class_member(classroom_id));
create policy feedback_read on public.teacher_feedback for select to authenticated using (teacher_id=private.teacher_id() or exists(select 1 from public.simulation_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
drop policy clinical_cases_select_published on public.clinical_cases;
create policy clinical_cases_read on public.clinical_cases for select to authenticated using (private.can_read_case(id));
drop policy patients_select_published_case on public.patients;
create policy patients_read on public.patients for select to authenticated using (exists(select 1 from public.clinical_cases cc where cc.patient_id=patients.id and private.can_read_case(cc.id)));
drop policy case_steps_select_published_case on public.case_steps;
create policy steps_read on public.case_steps for select to authenticated using (private.can_read_case(case_id));

-- Internal trigger functions/builders are never executable by browser roles.
revoke all on function private.build_simulation_debrief(uuid,uuid),private.classroom_json(public.classrooms),private.assignment_json(public.classroom_assignments),private.attempt_json(public.simulation_sessions),private.guard_classroom_action(),private.guard_classroom_session(),private.validate_teaching_draft(jsonb,boolean) from public,anon,authenticated;

-- Public endpoints are invokers; all privileged bodies stay in the private schema.
create function public.teaching_bootstrap() returns jsonb language sql security invoker set search_path = '' as $$ select private.teaching_bootstrap(); $$;
revoke all on function private.teaching_bootstrap(),public.teaching_bootstrap() from public,anon,authenticated;
grant execute on function private.teaching_bootstrap(),public.teaching_bootstrap() to authenticated;
create function public.teaching_save_classroom(p_input jsonb,p_id uuid default null) returns uuid language sql security invoker set search_path = '' as $$ select private.teaching_save_classroom(p_input,p_id); $$;
revoke all on function private.teaching_save_classroom(jsonb,uuid),public.teaching_save_classroom(jsonb,uuid) from public,anon,authenticated;
grant execute on function private.teaching_save_classroom(jsonb,uuid),public.teaching_save_classroom(jsonb,uuid) to authenticated;
create function public.teaching_archive_classroom(p_id uuid,p_archived boolean) returns void language sql security invoker set search_path = '' as $$ select private.teaching_archive_classroom(p_id,p_archived); $$;
revoke all on function private.teaching_archive_classroom(uuid,boolean),public.teaching_archive_classroom(uuid,boolean) from public,anon,authenticated;
grant execute on function private.teaching_archive_classroom(uuid,boolean),public.teaching_archive_classroom(uuid,boolean) to authenticated;
create function public.teaching_enroll(p_classroom_id uuid,p_emails text[]) returns void language sql security invoker set search_path = '' as $$ select private.teaching_enroll(p_classroom_id,p_emails); $$;
revoke all on function private.teaching_enroll(uuid,text[]),public.teaching_enroll(uuid,text[]) from public,anon,authenticated;
grant execute on function private.teaching_enroll(uuid,text[]),public.teaching_enroll(uuid,text[]) to authenticated;
create function public.teaching_revoke_enrollment(p_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.teaching_revoke_enrollment(p_id); $$;
revoke all on function private.teaching_revoke_enrollment(uuid),public.teaching_revoke_enrollment(uuid) from public,anon,authenticated;
grant execute on function private.teaching_revoke_enrollment(uuid),public.teaching_revoke_enrollment(uuid) to authenticated;
create function public.teaching_save_case(p_draft jsonb,p_id uuid default null,p_publish boolean default false) returns uuid language sql security invoker set search_path = '' as $$ select private.teaching_save_case(p_draft,p_id,p_publish); $$;
revoke all on function private.teaching_save_case(jsonb,uuid,boolean),public.teaching_save_case(jsonb,uuid,boolean) from public,anon,authenticated;
grant execute on function private.teaching_save_case(jsonb,uuid,boolean),public.teaching_save_case(jsonb,uuid,boolean) to authenticated;
create function public.teaching_archive_case(p_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.teaching_archive_case(p_id); $$;
revoke all on function private.teaching_archive_case(uuid),public.teaching_archive_case(uuid) from public,anon,authenticated;
grant execute on function private.teaching_archive_case(uuid),public.teaching_archive_case(uuid) to authenticated;
create function public.teaching_assign_case(p_classroom_id uuid,p_case_id uuid,p_title text,p_due_at timestamptz default null) returns uuid language sql security invoker set search_path = '' as $$ select private.teaching_assign_case(p_classroom_id,p_case_id,p_title,p_due_at); $$;
revoke all on function private.teaching_assign_case(uuid,uuid,text,timestamptz),public.teaching_assign_case(uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function private.teaching_assign_case(uuid,uuid,text,timestamptz),public.teaching_assign_case(uuid,uuid,text,timestamptz) to authenticated;
create function public.teaching_set_assignment_status(p_id uuid,p_status text) returns void language sql security invoker set search_path = '' as $$ select private.teaching_set_assignment_status(p_id,p_status); $$;
revoke all on function private.teaching_set_assignment_status(uuid,text),public.teaching_set_assignment_status(uuid,text) from public,anon,authenticated;
grant execute on function private.teaching_set_assignment_status(uuid,text),public.teaching_set_assignment_status(uuid,text) to authenticated;
create function public.teaching_get_debrief(p_session_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.teaching_get_debrief(p_session_id); $$;
revoke all on function private.teaching_get_debrief(uuid),public.teaching_get_debrief(uuid) from public,anon,authenticated;
grant execute on function private.teaching_get_debrief(uuid),public.teaching_get_debrief(uuid) to authenticated;
create function public.teaching_save_feedback(p_session_id uuid,p_feedback text) returns void language sql security invoker set search_path = '' as $$ select private.teaching_save_feedback(p_session_id,p_feedback); $$;
revoke all on function private.teaching_save_feedback(uuid,text),public.teaching_save_feedback(uuid,text) from public,anon,authenticated;
grant execute on function private.teaching_save_feedback(uuid,text),public.teaching_save_feedback(uuid,text) to authenticated;
create function public.teaching_workspace() returns jsonb language sql security invoker set search_path = '' as $$ select private.teaching_workspace(); $$;
revoke all on function private.teaching_workspace(),public.teaching_workspace() from public,anon,authenticated;
grant execute on function private.teaching_workspace(),public.teaching_workspace() to authenticated;
create function public.student_workspace() returns jsonb language sql security invoker set search_path = '' as $$ select private.student_workspace(); $$;
revoke all on function private.student_workspace(),public.student_workspace() from public,anon,authenticated;
grant execute on function private.student_workspace(),public.student_workspace() to authenticated;
revoke all on function private.google_email() from public,anon,authenticated;
grant execute on function private.google_email() to authenticated;
revoke all on function private.teacher_id() from public,anon,authenticated;
grant execute on function private.teacher_id() to authenticated;
revoke all on function private.require_teacher() from public,anon,authenticated;
grant execute on function private.require_teacher() to authenticated;
revoke all on function private.owns_classroom(uuid) from public,anon,authenticated;
grant execute on function private.owns_classroom(uuid) to authenticated;
revoke all on function private.is_class_member(uuid) from public,anon,authenticated;
grant execute on function private.is_class_member(uuid) to authenticated;
revoke all on function private.can_read_case(uuid) from public,anon,authenticated;
grant execute on function private.can_read_case(uuid) to authenticated;
revoke all on function private.require_assignment(uuid,uuid) from public,anon,authenticated;
grant execute on function private.require_assignment(uuid,uuid) to authenticated;
revoke all on function private.require_case_access(uuid) from public,anon,authenticated;
grant execute on function private.require_case_access(uuid) to authenticated;
revoke all on function private.student_debrief(uuid) from public,anon,authenticated;
grant execute on function private.student_debrief(uuid) to authenticated;
revoke all on function private.start_classroom_simulation(uuid,uuid) from public,anon,authenticated;
grant execute on function private.start_classroom_simulation(uuid,uuid) to authenticated;
revoke all on function public.start_or_resume_simulation_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_or_resume_simulation_session(uuid,uuid) to authenticated;
comment on table private.teacher_allowlist is 'Institution-controlled list. A browser cannot grant itself a teacher role. Email is matched against a verified Google identity.';

-- Legacy evaluation APIs may not be used to enumerate an authored case's answers.
-- P8 decision/advance routines invoke the internal resolver as their owner.
create function private.resolve_legacy_simulation_transition(p_case_id uuid,p_step_id uuid,p_option_id text default null)
returns table(classification text,score_delta integer,feedback text,consequence text,next_step_key text,completed boolean,presentation_state text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação de estudante necessária.' using errcode='42501'; end if;
  if exists(select 1 from public.clinical_cases where id=p_case_id and owner_teacher_id is not null) then
    raise exception 'Registre sua escolha pela atividade da turma.' using errcode='42501';
  end if;
  return query select * from private.resolve_simulation_transition_internal(p_case_id,p_step_id,p_option_id);
end $$;
create or replace function public.resolve_simulation_transition(p_case_id uuid,p_step_id uuid,p_option_id text default null)
returns table(classification text,score_delta integer,feedback text,consequence text,next_step_key text,completed boolean,presentation_state text)
language sql security invoker set search_path = '' as $$ select * from private.resolve_legacy_simulation_transition(p_case_id,p_step_id,p_option_id); $$;
revoke all on function private.resolve_simulation_transition_internal(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.resolve_legacy_simulation_transition(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.resolve_legacy_simulation_transition(uuid,uuid,text) to authenticated;

notify pgrst, 'reload schema';
